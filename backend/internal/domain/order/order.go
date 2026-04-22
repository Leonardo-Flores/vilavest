package order

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/domain/audit"
	"github.com/vilavest/backend/internal/httpx"
	"github.com/vilavest/backend/internal/middleware"
)

// ============================================================
// Models
// ============================================================

// Status is the lifecycle state of an order.
type Status string

const (
	StatusPending    Status = "pending"
	StatusPaid       Status = "paid"
	StatusProcessing Status = "processing"
	StatusShipped    Status = "shipped"
	StatusInTransit  Status = "in_transit"
	StatusDelivered  Status = "delivered"
	StatusCancelled  Status = "cancelled"
	StatusRefunded   Status = "refunded"
)

// PaymentMethod enumerates accepted payment methods.
type PaymentMethod string

const (
	PayCreditCard PaymentMethod = "credit_card"
	PayDebitCard  PaymentMethod = "debit_card"
	PayPix        PaymentMethod = "pix"
	PayBoleto     PaymentMethod = "boleto"
)

// Address is a shipping address snapshot stored with the order.
type Address struct {
	FullName     string `json:"full_name"`
	Phone        string `json:"phone"`
	Street       string `json:"street"`
	Number       string `json:"number"`
	Complement   string `json:"complement,omitempty"`
	Neighborhood string `json:"neighborhood"`
	City         string `json:"city"`
	State        string `json:"state"`
	ZipCode      string `json:"zip_code"`
}

// Order represents a customer order.
type Order struct {
	ID              uuid.UUID      `json:"id"`
	OrderNumber     string         `json:"order_number"`
	UserID          uuid.UUID      `json:"user_id"`
	CustomerName    string         `json:"customer_name,omitempty"`
	CustomerEmail   string         `json:"customer_email,omitempty"`
	Status          Status         `json:"status"`
	Subtotal        float64        `json:"subtotal"`
	ShippingCost    float64        `json:"shipping_cost"`
	Discount        float64        `json:"discount"`
	Total           float64        `json:"total"`
	PaymentMethod   PaymentMethod  `json:"payment_method,omitempty"`
	ShippingAddress Address        `json:"shipping_address"`
	Items           []Item         `json:"items,omitempty"`
	Shipment        *ShipmentInfo  `json:"shipment,omitempty"`
	Notes           string         `json:"notes,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// Item is a line in an order.
type Item struct {
	ID          uuid.UUID  `json:"id"`
	ProductID   uuid.UUID  `json:"product_id"`
	VariantID   *uuid.UUID `json:"variant_id,omitempty"`
	ProductName string     `json:"product_name"`
	SKU         string     `json:"sku"`
	Quantity    int        `json:"quantity"`
	UnitPrice   float64    `json:"unit_price"`
	TotalPrice  float64    `json:"total_price"`
	ProductSlug string     `json:"product_slug,omitempty"`
	Image       string     `json:"image,omitempty"`
}

// ShipmentInfo is the summary tracking info attached to an order.
type ShipmentInfo struct {
	ID                uuid.UUID  `json:"id"`
	TrackingCode      string     `json:"tracking_code"`
	Carrier           string     `json:"carrier"`
	Status            string     `json:"status"`
	EstimatedDelivery *time.Time `json:"estimated_delivery,omitempty"`
	ShippedAt         *time.Time `json:"shipped_at,omitempty"`
	DeliveredAt       *time.Time `json:"delivered_at,omitempty"`
}

// CreateRequest is the payload for POST /orders.
type CreateRequest struct {
	ShippingAddress Address       `json:"shipping_address"`
	PaymentMethod   PaymentMethod `json:"payment_method"`
	Notes           string        `json:"notes"`
}

// UpdateStatusRequest is the payload for PATCH /admin/orders/{id}/status.
type UpdateStatusRequest struct {
	Status Status `json:"status"`
}

// ============================================================
// Repository
// ============================================================

// Repository persists orders and their shipments.
type Repository struct{ pool *pgxpool.Pool }

// NewRepository creates a new order repository.
func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// CreateFromCart materializes an order from the user's cart, then clears the cart.
func (r *Repository) CreateFromCart(ctx context.Context, userID uuid.UUID, req CreateRequest) (*Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Cart items
	rows, err := tx.Query(ctx, `
		SELECT ci.product_id, ci.variant_id, ci.quantity,
		       p.name, p.sku, COALESCE(pv.price_override, p.price)
		FROM cart_items ci
		JOIN carts c ON c.id = ci.cart_id
		JOIN products p ON p.id = ci.product_id
		LEFT JOIN product_variants pv ON pv.id = ci.variant_id
		WHERE c.user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}

	var (
		items    []Item
		subtotal float64
	)
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ProductID, &it.VariantID, &it.Quantity, &it.ProductName, &it.SKU, &it.UnitPrice); err != nil {
			rows.Close()
			return nil, err
		}
		it.TotalPrice = it.UnitPrice * float64(it.Quantity)
		subtotal += it.TotalPrice
		items = append(items, it)
	}
	rows.Close()

	if len(items) == 0 {
		return nil, fmt.Errorf("cart is empty")
	}

	// Simple shipping cost heuristic
	shipping := 19.90
	if subtotal >= 399.0 {
		shipping = 0
	}
	total := subtotal + shipping

	number := generateOrderNumber()
	addrJSON, _ := json.Marshal(req.ShippingAddress)

	// Simulated payment: PIX / boleto stays pending, cards go straight to paid
	initialStatus := StatusPending
	if req.PaymentMethod == PayCreditCard || req.PaymentMethod == PayDebitCard {
		initialStatus = StatusPaid
	}

	var orderID uuid.UUID
	var createdAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (order_number, user_id, status, subtotal, shipping_cost, discount, total,
		                    payment_method, shipping_address, notes)
		VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, NULLIF($9, ''))
		RETURNING id, created_at, updated_at
	`, number, userID, initialStatus, subtotal, shipping, total,
		req.PaymentMethod, addrJSON, req.Notes).
		Scan(&orderID, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	// Order items + stock decrement
	for i := range items {
		err = tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, product_id, variant_id, product_name, sku, quantity, unit_price, total_price)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, orderID, items[i].ProductID, items[i].VariantID, items[i].ProductName,
			items[i].SKU, items[i].Quantity, items[i].UnitPrice, items[i].TotalPrice).
			Scan(&items[i].ID)
		if err != nil {
			return nil, err
		}

		// Decrement available stock (best-effort)
		_, _ = tx.Exec(ctx, `
			UPDATE stock SET quantity = GREATEST(quantity - $3, 0)
			WHERE product_id = $1 AND variant_id IS NOT DISTINCT FROM $2
		`, items[i].ProductID, items[i].VariantID, items[i].Quantity)
	}

	// Shipment (tracking code + estimated delivery 5 business days)
	tracking := generateTrackingCode()
	eta := time.Now().Add(5 * 24 * time.Hour)
	_, err = tx.Exec(ctx, `
		INSERT INTO shipments (order_id, tracking_code, carrier, status, estimated_delivery)
		VALUES ($1, $2, 'VilaVest Express', 'preparing', $3)
	`, orderID, tracking, eta)
	if err != nil {
		return nil, err
	}

	// Notification
	_, _ = tx.Exec(ctx, `
		INSERT INTO notifications (user_id, channel, status, title, body, metadata)
		VALUES ($1, 'in_app', 'sent', $2, $3, $4)
	`, userID, "Pedido confirmado",
		fmt.Sprintf("Seu pedido %s foi recebido. Acompanhe o status na sua conta.", number),
		[]byte(fmt.Sprintf(`{"order_id":"%s","order_number":"%s"}`, orderID, number)))

	// Clear the cart
	_, _ = tx.Exec(ctx, `
		DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)
	`, userID)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetByID(ctx, orderID, &userID)
}

// GetByID loads an order with items and shipment. userID may be nil for admin.
func (r *Repository) GetByID(ctx context.Context, orderID uuid.UUID, userID *uuid.UUID) (*Order, error) {
	query := `
		SELECT o.id, o.order_number, o.user_id, u.full_name, u.email,
		       o.status, o.subtotal, o.shipping_cost, o.discount, o.total,
		       COALESCE(o.payment_method::text, ''), o.shipping_address,
		       COALESCE(o.notes, ''), o.created_at, o.updated_at
		FROM orders o
		JOIN users u ON u.id = o.user_id
		WHERE o.id = $1
	`
	args := []interface{}{orderID}
	if userID != nil {
		query += ` AND o.user_id = $2`
		args = append(args, *userID)
	}

	var o Order
	var addrJSON []byte
	var pm string
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&o.ID, &o.OrderNumber, &o.UserID, &o.CustomerName, &o.CustomerEmail,
		&o.Status, &o.Subtotal, &o.ShippingCost, &o.Discount, &o.Total,
		&pm, &addrJSON, &o.Notes, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	o.PaymentMethod = PaymentMethod(pm)
	_ = json.Unmarshal(addrJSON, &o.ShippingAddress)

	// Items
	itemRows, err := r.pool.Query(ctx, `
		SELECT oi.id, oi.product_id, oi.variant_id, oi.product_name, oi.sku,
		       oi.quantity, oi.unit_price, oi.total_price,
		       COALESCE(p.slug, ''),
		       COALESCE((SELECT url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, sort_order LIMIT 1), '')
		FROM order_items oi
		LEFT JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var it Item
		if err := itemRows.Scan(&it.ID, &it.ProductID, &it.VariantID, &it.ProductName,
			&it.SKU, &it.Quantity, &it.UnitPrice, &it.TotalPrice,
			&it.ProductSlug, &it.Image); err != nil {
			return nil, err
		}
		o.Items = append(o.Items, it)
	}

	// Shipment
	var sh ShipmentInfo
	err = r.pool.QueryRow(ctx, `
		SELECT id, COALESCE(tracking_code,''), carrier, status,
		       estimated_delivery, shipped_at, delivered_at
		FROM shipments WHERE order_id = $1
		ORDER BY created_at DESC LIMIT 1
	`, orderID).Scan(&sh.ID, &sh.TrackingCode, &sh.Carrier, &sh.Status,
		&sh.EstimatedDelivery, &sh.ShippedAt, &sh.DeliveredAt)
	if err == nil {
		o.Shipment = &sh
	} else if err != pgx.ErrNoRows {
		slog.Warn("load shipment", "error", err)
	}

	return &o, nil
}

// ListForUser returns a user's orders, newest first.
func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]Order, int, error) {
	return r.list(ctx, `o.user_id = $1`, []interface{}{userID}, limit, offset)
}

// ListAll returns all orders for admin, optionally filtered by status.
func (r *Repository) ListAll(ctx context.Context, status string, limit, offset int) ([]Order, int, error) {
	where := `1=1`
	args := []interface{}{}
	if status != "" {
		where = `o.status = $1`
		args = append(args, status)
	}
	return r.list(ctx, where, args, limit, offset)
}

func (r *Repository) list(ctx context.Context, where string, args []interface{}, limit, offset int) ([]Order, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders o WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	nextArg := len(args) + 1
	q := fmt.Sprintf(`
		SELECT o.id, o.order_number, o.user_id, u.full_name, u.email,
		       o.status, o.subtotal, o.shipping_cost, o.discount, o.total,
		       COALESCE(o.payment_method::text,''), o.shipping_address,
		       COALESCE(o.notes,''), o.created_at, o.updated_at
		FROM orders o JOIN users u ON u.id = o.user_id
		WHERE %s
		ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d
	`, where, nextArg, nextArg+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []Order{}
	for rows.Next() {
		var o Order
		var addrJSON []byte
		var pm string
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.UserID, &o.CustomerName, &o.CustomerEmail,
			&o.Status, &o.Subtotal, &o.ShippingCost, &o.Discount, &o.Total,
			&pm, &addrJSON, &o.Notes, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		o.PaymentMethod = PaymentMethod(pm)
		_ = json.Unmarshal(addrJSON, &o.ShippingAddress)
		out = append(out, o)
	}
	return out, total, nil
}

// UpdateStatus changes the order status and mirrors the shipment lifecycle.
func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, newStatus Status) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE orders SET status=$2 WHERE id=$1`, id, newStatus); err != nil {
		return err
	}

	// Sync shipment state
	shipmentStatus, eventDesc, setShipped, setDelivered := mapStatusToShipment(newStatus)
	if shipmentStatus != "" {
		var shipmentID uuid.UUID
		if err := tx.QueryRow(ctx, `SELECT id FROM shipments WHERE order_id = $1`, id).Scan(&shipmentID); err == nil {
			sets := []string{"status=$2"}
			args := []interface{}{shipmentID, shipmentStatus}
			if setShipped {
				sets = append(sets, fmt.Sprintf("shipped_at=COALESCE(shipped_at, NOW())"))
			}
			if setDelivered {
				sets = append(sets, fmt.Sprintf("delivered_at=COALESCE(delivered_at, NOW())"))
			}
			updateQ := fmt.Sprintf(`UPDATE shipments SET %s WHERE id=$1`, strings.Join(sets, ", "))
			if _, err := tx.Exec(ctx, updateQ, args...); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO shipment_events (shipment_id, status, description)
				VALUES ($1, $2, $3)
			`, shipmentID, shipmentStatus, eventDesc); err != nil {
				return err
			}
		}
	}

	// Notify customer
	var userID uuid.UUID
	var orderNumber string
	_ = tx.QueryRow(ctx, `SELECT user_id, order_number FROM orders WHERE id = $1`, id).Scan(&userID, &orderNumber)
	if userID != uuid.Nil {
		_, _ = tx.Exec(ctx, `
			INSERT INTO notifications (user_id, channel, status, title, body, metadata)
			VALUES ($1, 'in_app', 'sent', $2, $3, $4)
		`, userID,
			fmt.Sprintf("Atualização do pedido %s", orderNumber),
			statusMessage(newStatus, orderNumber),
			[]byte(fmt.Sprintf(`{"order_id":"%s","status":"%s"}`, id, newStatus)))
	}

	return tx.Commit(ctx)
}

// ============================================================
// Handler
// ============================================================

// Handler exposes order HTTP endpoints.
type Handler struct {
	repo      *Repository
	auditRepo *audit.Repository
}

// NewHandler creates a new order handler.
func NewHandler(repo *Repository, auditRepo ...*audit.Repository) *Handler {
	h := &Handler{repo: repo}
	if len(auditRepo) > 0 {
		h.auditRepo = auditRepo[0]
	}
	return h
}

// UserRoutes returns the customer-facing order routes (requires auth).
func (h *Handler) UserRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.Create)
	r.Get("/", h.List)
	r.Get("/{id}", h.GetOne)
	r.Post("/{id}/cancel", h.Cancel)
	return r
}

// AdminRoutes returns the admin order management routes.
func (h *Handler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.AdminList)
	r.Get("/{id}", h.AdminGetOne)
	r.Patch("/{id}/status", h.UpdateStatus)
	return r
}

// Create creates a new order from the user's current cart.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	var req CreateRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.ShippingAddress.ZipCode == "" || req.PaymentMethod == "" {
		httpx.WriteError(w, 400, "shipping_address and payment_method are required")
		return
	}
	order, err := h.repo.CreateFromCart(r.Context(), userID, req)
	if err != nil {
		slog.Error("create order", "error", err)
		httpx.WriteError(w, 400, err.Error())
		return
	}

	if h.auditRepo != nil {
		meta, _ := json.Marshal(map[string]interface{}{"order_number": order.OrderNumber, "total": order.Total})
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionCreate,
			Resource:   "order",
			ResourceID: &order.ID,
			NewValues:  meta,
		})
	}

	httpx.WriteJSON(w, 201, order)
}

// List returns the authenticated user's orders.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	_, limit, offset := httpx.Pagination(r)
	items, total, err := h.repo.ListForUser(r.Context(), userID, limit, offset)
	if err != nil {
		httpx.WriteError(w, 500, "failed to list orders")
		return
	}
	httpx.WriteJSON(w, 200, map[string]interface{}{"data": items, "total": total})
}

// GetOne returns one of the user's orders.
func (h *Handler) GetOne(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, 400, "invalid id")
		return
	}
	o, err := h.repo.GetByID(r.Context(), id, &userID)
	if err != nil {
		httpx.WriteError(w, 404, "order not found")
		return
	}
	httpx.WriteJSON(w, 200, o)
}

// Cancel cancels a pending order.
func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, 400, "invalid id")
		return
	}

	// Only allow cancelling pending or paid orders for the same user
	tag, err := h.repo.pool.Exec(r.Context(), `
		UPDATE orders SET status='cancelled'
		WHERE id=$1 AND user_id=$2 AND status IN ('pending','paid')
	`, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.WriteError(w, 400, "order cannot be cancelled")
		return
	}

	if h.auditRepo != nil {
		meta, _ := json.Marshal(map[string]string{"new_status": "cancelled"})
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionUpdate,
			Resource:   "order",
			ResourceID: &id,
			NewValues:  meta,
		})
	}

	httpx.WriteJSON(w, 200, map[string]string{"status": "cancelled"})
}

// AdminList returns all orders filtered by status.
func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := httpx.Pagination(r)
	items, total, err := h.repo.ListAll(r.Context(), r.URL.Query().Get("status"), limit, offset)
	if err != nil {
		httpx.WriteError(w, 500, "failed to list orders")
		return
	}
	httpx.WriteJSON(w, 200, map[string]interface{}{"data": items, "total": total})
}

// AdminGetOne returns any order by id.
func (h *Handler) AdminGetOne(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, 400, "invalid id")
		return
	}
	o, err := h.repo.GetByID(r.Context(), id, nil)
	if err != nil {
		httpx.WriteError(w, 404, "order not found")
		return
	}
	httpx.WriteJSON(w, 200, o)
}

// UpdateStatus transitions an order through the lifecycle.
func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, 400, "invalid id")
		return
	}
	var req UpdateStatusRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if !isValidStatus(req.Status) {
		httpx.WriteError(w, 400, "invalid status")
		return
	}
	if err := h.repo.UpdateStatus(r.Context(), id, req.Status); err != nil {
		slog.Error("update order status", "error", err)
		httpx.WriteError(w, 500, "failed to update status")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		meta, _ := json.Marshal(map[string]string{"new_status": string(req.Status)})
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionUpdate,
			Resource:   "order",
			ResourceID: &id,
			NewValues:  meta,
		})
	}

	httpx.WriteJSON(w, 200, map[string]string{"status": string(req.Status)})
}

// ============================================================
// Helpers
// ============================================================

func generateOrderNumber() string {
	return fmt.Sprintf("VV-%d%04d", time.Now().Unix()%100000000, rand.Intn(10000))
}

func generateTrackingCode() string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	b := make([]byte, 2)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return fmt.Sprintf("%s%09dBR", string(b), rand.Intn(1000000000))
}

func isValidStatus(s Status) bool {
	switch s {
	case StatusPending, StatusPaid, StatusProcessing, StatusShipped,
		StatusInTransit, StatusDelivered, StatusCancelled, StatusRefunded:
		return true
	}
	return false
}

func mapStatusToShipment(s Status) (status, description string, setShipped, setDelivered bool) {
	switch s {
	case StatusProcessing:
		return "preparing", "Pedido sendo preparado", false, false
	case StatusShipped:
		return "shipped", "Pacote enviado ao transportador", true, false
	case StatusInTransit:
		return "in_transit", "Pacote em trânsito", false, false
	case StatusDelivered:
		return "delivered", "Pacote entregue", false, true
	case StatusCancelled:
		return "cancelled", "Envio cancelado", false, false
	}
	return "", "", false, false
}

func statusMessage(s Status, number string) string {
	switch s {
	case StatusPaid:
		return fmt.Sprintf("O pagamento do pedido %s foi confirmado.", number)
	case StatusProcessing:
		return fmt.Sprintf("Seu pedido %s está sendo preparado.", number)
	case StatusShipped:
		return fmt.Sprintf("Seu pedido %s foi enviado. Acompanhe o rastreio.", number)
	case StatusInTransit:
		return fmt.Sprintf("Seu pedido %s está a caminho.", number)
	case StatusDelivered:
		return fmt.Sprintf("Pedido %s entregue. Aproveite! 🎉", number)
	case StatusCancelled:
		return fmt.Sprintf("Pedido %s foi cancelado.", number)
	}
	return fmt.Sprintf("Status do pedido %s atualizado para %s.", number, s)
}
