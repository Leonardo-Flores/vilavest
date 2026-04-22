package cart

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/httpx"
	"github.com/vilavest/backend/internal/middleware"
)

// ============================================================
// Models
// ============================================================

// Cart is a user's shopping cart (one active cart per user).
type Cart struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Items     []Item     `json:"items"`
	Subtotal  float64    `json:"subtotal"`
	ItemCount int        `json:"item_count"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// Item is a single line in a cart with denormalized product info.
type Item struct {
	ID           uuid.UUID  `json:"id"`
	ProductID    uuid.UUID  `json:"product_id"`
	VariantID    *uuid.UUID `json:"variant_id,omitempty"`
	Quantity     int        `json:"quantity"`
	ProductName  string     `json:"product_name"`
	ProductSlug  string     `json:"product_slug"`
	ProductImage string     `json:"product_image,omitempty"`
	UnitPrice    float64    `json:"unit_price"`
	Subtotal     float64    `json:"subtotal"`
	Stock        int        `json:"stock_available"`
}

// AddItemRequest is the payload for POST /cart/items.
type AddItemRequest struct {
	ProductID uuid.UUID  `json:"product_id"`
	VariantID *uuid.UUID `json:"variant_id,omitempty"`
	Quantity  int        `json:"quantity"`
}

// UpdateItemRequest is the payload for PATCH /cart/items/{id}.
type UpdateItemRequest struct {
	Quantity int `json:"quantity"`
}

// ============================================================
// Repository
// ============================================================

// Repository persists carts.
type Repository struct{ pool *pgxpool.Pool }

// NewRepository creates a new cart repository.
func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// getOrCreate returns the user's active cart, creating one if needed.
func (r *Repository) getOrCreate(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT id FROM carts WHERE user_id = $1 AND expires_at > NOW()
		 ORDER BY created_at DESC LIMIT 1`, userID).Scan(&id)
	if err == nil {
		return id, nil
	}
	err = r.pool.QueryRow(ctx,
		`INSERT INTO carts (user_id) VALUES ($1) RETURNING id`, userID).Scan(&id)
	return id, err
}

// Load returns the full cart with items (denormalized for UI).
func (r *Repository) Load(ctx context.Context, userID uuid.UUID) (*Cart, error) {
	cartID, err := r.getOrCreate(ctx, userID)
	if err != nil {
		return nil, err
	}

	cart := &Cart{ID: cartID, UserID: userID, Items: []Item{}, UpdatedAt: time.Now()}

	rows, err := r.pool.Query(ctx, `
		SELECT ci.id, ci.product_id, ci.variant_id, ci.quantity,
		       p.name, p.slug,
		       COALESCE((SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1), ''),
		       COALESCE(pv.price_override, p.price),
		       COALESCE(s.quantity, 0) - COALESCE(s.reserved, 0)
		FROM cart_items ci
		JOIN products p ON p.id = ci.product_id
		LEFT JOIN product_variants pv ON pv.id = ci.variant_id
		LEFT JOIN stock s ON s.product_id = ci.product_id AND (s.variant_id IS NOT DISTINCT FROM ci.variant_id)
		WHERE ci.cart_id = $1
		ORDER BY ci.added_at
	`, cartID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it Item
		if err := rows.Scan(
			&it.ID, &it.ProductID, &it.VariantID, &it.Quantity,
			&it.ProductName, &it.ProductSlug, &it.ProductImage, &it.UnitPrice, &it.Stock,
		); err != nil {
			return nil, err
		}
		it.Subtotal = it.UnitPrice * float64(it.Quantity)
		cart.Subtotal += it.Subtotal
		cart.ItemCount += it.Quantity
		cart.Items = append(cart.Items, it)
	}
	return cart, nil
}

// AddItem increments existing line or inserts a new one.
func (r *Repository) AddItem(ctx context.Context, userID uuid.UUID, req AddItemRequest) error {
	if req.Quantity < 1 {
		req.Quantity = 1
	}
	cartID, err := r.getOrCreate(ctx, userID)
	if err != nil {
		return err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Try update first (idempotent add of same line)
	tag, err := tx.Exec(ctx, `
		UPDATE cart_items SET quantity = quantity + $4
		WHERE cart_id = $1 AND product_id = $2 AND variant_id IS NOT DISTINCT FROM $3
	`, cartID, req.ProductID, req.VariantID, req.Quantity)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
			VALUES ($1, $2, $3, $4)
		`, cartID, req.ProductID, req.VariantID, req.Quantity)
		if err != nil {
			return err
		}
	}
	_, _ = tx.Exec(ctx, `UPDATE carts SET updated_at = NOW() WHERE id = $1`, cartID)
	return tx.Commit(ctx)
}

// UpdateItem sets a new quantity; 0 removes the line.
func (r *Repository) UpdateItem(ctx context.Context, userID, itemID uuid.UUID, qty int) error {
	if qty <= 0 {
		return r.RemoveItem(ctx, userID, itemID)
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE cart_items ci SET quantity = $3
		FROM carts c WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.id = $2
	`, userID, itemID, qty)
	return err
}

// RemoveItem deletes a line by item ID (scoped to the user's cart).
func (r *Repository) RemoveItem(ctx context.Context, userID, itemID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM cart_items ci
		USING carts c
		WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.id = $2
	`, userID, itemID)
	return err
}

// Clear removes all items in the user's cart.
func (r *Repository) Clear(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM cart_items ci
		USING carts c
		WHERE ci.cart_id = c.id AND c.user_id = $1
	`, userID)
	return err
}

// ============================================================
// Handler
// ============================================================

// Handler exposes cart HTTP endpoints (all require authentication).
type Handler struct{ repo *Repository }

// NewHandler creates a new cart handler.
func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

// Routes returns the authenticated cart routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.Get)
	r.Delete("/", h.Clear)
	r.Post("/items", h.AddItem)
	r.Patch("/items/{id}", h.UpdateItem)
	r.Delete("/items/{id}", h.RemoveItem)
	return r
}

// Get returns the user's current cart.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	cart, err := h.repo.Load(r.Context(), userID)
	if err != nil {
		slog.Error("cart load", "error", err)
		httpx.WriteError(w, 500, "failed to load cart")
		return
	}
	httpx.WriteJSON(w, 200, cart)
}

// AddItem adds (or increments) a product line in the cart.
func (h *Handler) AddItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	var req AddItemRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.ProductID == uuid.Nil {
		httpx.WriteError(w, 400, "product_id is required")
		return
	}
	if err := h.repo.AddItem(r.Context(), userID, req); err != nil {
		slog.Error("cart add", "error", err)
		httpx.WriteError(w, 400, "failed to add item")
		return
	}
	cart, _ := h.repo.Load(r.Context(), userID)
	httpx.WriteJSON(w, 201, cart)
}

// UpdateItem sets the quantity of a cart line.
func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request) {
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
	var req UpdateItemRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if err := h.repo.UpdateItem(r.Context(), userID, id, req.Quantity); err != nil {
		httpx.WriteError(w, 400, "failed to update item")
		return
	}
	cart, _ := h.repo.Load(r.Context(), userID)
	httpx.WriteJSON(w, 200, cart)
}

// RemoveItem deletes a cart line.
func (h *Handler) RemoveItem(w http.ResponseWriter, r *http.Request) {
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
	if err := h.repo.RemoveItem(r.Context(), userID, id); err != nil {
		httpx.WriteError(w, 400, "failed to remove item")
		return
	}
	cart, _ := h.repo.Load(r.Context(), userID)
	httpx.WriteJSON(w, 200, cart)
}

// Clear removes all items from the cart.
func (h *Handler) Clear(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, 401, "authentication required")
		return
	}
	if err := h.repo.Clear(r.Context(), userID); err != nil {
		httpx.WriteError(w, 400, "failed to clear cart")
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{"status": "cleared"})
}
