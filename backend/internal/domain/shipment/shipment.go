// Package shipment exposes public tracking endpoints and an admin-facing
// helper for attaching tracking events to a shipment.
package shipment

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

// Shipment is the tracking record linked to an order.
type Shipment struct {
	ID                uuid.UUID  `json:"id"`
	OrderID           uuid.UUID  `json:"order_id"`
	OrderNumber       string     `json:"order_number"`
	TrackingCode      string     `json:"tracking_code"`
	Carrier           string     `json:"carrier"`
	Status            string     `json:"status"`
	EstimatedDelivery *time.Time `json:"estimated_delivery,omitempty"`
	ShippedAt         *time.Time `json:"shipped_at,omitempty"`
	DeliveredAt       *time.Time `json:"delivered_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	Events            []Event    `json:"events"`
}

// Event is a single tracking update.
type Event struct {
	ID          uuid.UUID `json:"id"`
	Status      string    `json:"status"`
	Location    string    `json:"location,omitempty"`
	Description string    `json:"description"`
	OccurredAt  time.Time `json:"occurred_at"`
}

// AddEventRequest is the payload for admins attaching a new tracking event.
type AddEventRequest struct {
	Status      string `json:"status"`
	Location    string `json:"location"`
	Description string `json:"description"`
}

// ============================================================
// Repository
// ============================================================

// Repository queries shipment data.
type Repository struct{ pool *pgxpool.Pool }

// NewRepository creates a new shipment repository.
func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// GetByTrackingCode returns a shipment + event timeline for a public tracking lookup.
func (r *Repository) GetByTrackingCode(ctx context.Context, code string) (*Shipment, error) {
	s := &Shipment{}
	err := r.pool.QueryRow(ctx, `
		SELECT s.id, s.order_id, o.order_number, COALESCE(s.tracking_code,''), s.carrier, s.status,
		       s.estimated_delivery, s.shipped_at, s.delivered_at, s.created_at
		FROM shipments s JOIN orders o ON o.id = s.order_id
		WHERE s.tracking_code = $1
	`, code).Scan(&s.ID, &s.OrderID, &s.OrderNumber, &s.TrackingCode, &s.Carrier, &s.Status,
		&s.EstimatedDelivery, &s.ShippedAt, &s.DeliveredAt, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	s.Events, _ = r.eventsFor(ctx, s.ID)
	return s, nil
}

// GetByOrderID returns the shipment for an order, scoped to the given user when non-nil.
func (r *Repository) GetByOrderID(ctx context.Context, orderID uuid.UUID, userID *uuid.UUID) (*Shipment, error) {
	query := `
		SELECT s.id, s.order_id, o.order_number, COALESCE(s.tracking_code,''), s.carrier, s.status,
		       s.estimated_delivery, s.shipped_at, s.delivered_at, s.created_at
		FROM shipments s JOIN orders o ON o.id = s.order_id
		WHERE s.order_id = $1
	`
	args := []interface{}{orderID}
	if userID != nil {
		query += ` AND o.user_id = $2`
		args = append(args, *userID)
	}
	s := &Shipment{}
	if err := r.pool.QueryRow(ctx, query, args...).Scan(
		&s.ID, &s.OrderID, &s.OrderNumber, &s.TrackingCode, &s.Carrier, &s.Status,
		&s.EstimatedDelivery, &s.ShippedAt, &s.DeliveredAt, &s.CreatedAt,
	); err != nil {
		return nil, err
	}
	s.Events, _ = r.eventsFor(ctx, s.ID)
	return s, nil
}

func (r *Repository) eventsFor(ctx context.Context, shipmentID uuid.UUID) ([]Event, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, status, COALESCE(location,''), COALESCE(description,''), occurred_at
		FROM shipment_events WHERE shipment_id = $1
		ORDER BY occurred_at DESC
	`, shipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.Status, &e.Location, &e.Description, &e.OccurredAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

// AddEvent appends a tracking event and (optionally) updates the shipment status.
func (r *Repository) AddEvent(ctx context.Context, shipmentID uuid.UUID, req AddEventRequest) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO shipment_events (shipment_id, status, location, description)
		VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''))
	`, shipmentID, req.Status, req.Location, req.Description); err != nil {
		return err
	}
	if req.Status != "" {
		if _, err := tx.Exec(ctx, `UPDATE shipments SET status=$2 WHERE id=$1`, shipmentID, req.Status); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ============================================================
// Handler
// ============================================================

// Handler exposes shipment HTTP endpoints.
type Handler struct{ repo *Repository }

// NewHandler creates a new shipment handler.
func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

// PublicRoutes exposes the public tracking-by-code endpoint.
func (h *Handler) PublicRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/{code}", h.GetByCode)
	return r
}

// UserRoutes returns authenticated endpoints for a customer to look up their own shipments.
// Mounted at /shipments.
func (h *Handler) UserRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/by-order/{orderId}", h.GetForOrder)
	return r
}

// AdminRoutes returns endpoints for admins to append tracking events.
func (h *Handler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/{id}", h.AdminGet)
	r.Post("/{id}/events", h.AddEvent)
	return r
}

// GetByCode godoc
// @Summary  Public shipment tracking
// @Tags     shipments
// @Produce  json
// @Param    code  path  string  true  "Tracking code"
// @Success  200  {object}  Shipment
// @Router   /api/v1/tracking/{code} [get]
func (h *Handler) GetByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		httpx.WriteError(w, http.StatusBadRequest, "code is required")
		return
	}
	s, err := h.repo.GetByTrackingCode(r.Context(), code)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "tracking code not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, s)
}

// GetForOrder returns the shipment for one of the authenticated user's orders.
func (h *Handler) GetForOrder(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	orderID, err := uuid.Parse(chi.URLParam(r, "orderId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid order id")
		return
	}
	s, err := h.repo.GetByOrderID(r.Context(), orderID, &userID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "shipment not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, s)
}

// AdminGet fetches a shipment by ID (admin).
func (h *Handler) AdminGet(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	// reuse eventsFor via an order-scoped lookup: find by id
	row := h.repo.pool.QueryRow(r.Context(), `
		SELECT s.id, s.order_id, o.order_number, COALESCE(s.tracking_code,''), s.carrier, s.status,
		       s.estimated_delivery, s.shipped_at, s.delivered_at, s.created_at
		FROM shipments s JOIN orders o ON o.id = s.order_id
		WHERE s.id = $1
	`, id)
	s := &Shipment{}
	if err := row.Scan(&s.ID, &s.OrderID, &s.OrderNumber, &s.TrackingCode, &s.Carrier, &s.Status,
		&s.EstimatedDelivery, &s.ShippedAt, &s.DeliveredAt, &s.CreatedAt); err != nil {
		httpx.WriteError(w, http.StatusNotFound, "shipment not found")
		return
	}
	s.Events, _ = h.repo.eventsFor(r.Context(), s.ID)
	httpx.WriteJSON(w, http.StatusOK, s)
}

// AddEvent attaches a new tracking event to the shipment (admin).
func (h *Handler) AddEvent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req AddEventRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.Status == "" && req.Description == "" {
		httpx.WriteError(w, http.StatusBadRequest, "status or description is required")
		return
	}
	if err := h.repo.AddEvent(r.Context(), id, req); err != nil {
		slog.Error("add shipment event", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to add event")
		return
	}
	w.WriteHeader(http.StatusCreated)
}
