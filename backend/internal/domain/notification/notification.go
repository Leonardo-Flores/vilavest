// Package notification owns the in-app notification feed for authenticated users.
package notification

import (
	"context"
	"encoding/json"
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

// Notification is a single in-app notification row for a user.
type Notification struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	Channel   string          `json:"channel"`
	Status    string          `json:"status"`
	Title     string          `json:"title"`
	Body      string          `json:"body"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	ReadAt    *time.Time      `json:"read_at,omitempty"`
	SentAt    *time.Time      `json:"sent_at,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

// ============================================================
// Repository
// ============================================================

// Repository persists notifications.
type Repository struct{ pool *pgxpool.Pool }

// NewRepository creates a new notification repository.
func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// ListForUser returns the most recent notifications for a user.
func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID, onlyUnread bool, limit int) ([]Notification, int, error) {
	where := `user_id = $1`
	if onlyUnread {
		where += ` AND status != 'read'`
	}

	var unread int
	_ = r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND status != 'read'`,
		userID,
	).Scan(&unread)

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, channel::text, status::text, title, body,
		       COALESCE(metadata::text, 'null')::jsonb,
		       read_at, sent_at, created_at
		FROM notifications
		WHERE `+where+`
		ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, unread, err
	}
	defer rows.Close()
	out := []Notification{}
	for rows.Next() {
		var n Notification
		var meta []byte
		if err := rows.Scan(&n.ID, &n.UserID, &n.Channel, &n.Status, &n.Title, &n.Body,
			&meta, &n.ReadAt, &n.SentAt, &n.CreatedAt); err != nil {
			return nil, unread, err
		}
		n.Metadata = meta
		out = append(out, n)
	}
	return out, unread, nil
}

// MarkAsRead marks a single notification as read, scoped to the user.
func (r *Repository) MarkAsRead(ctx context.Context, userID, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE notifications SET status='read', read_at=NOW()
		WHERE id=$1 AND user_id=$2
	`, id, userID)
	return err
}

// MarkAllAsRead marks every unread notification for the user as read.
func (r *Repository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE notifications SET status='read', read_at=NOW()
		WHERE user_id=$1 AND status != 'read'
	`, userID)
	return err
}

// ============================================================
// Handler
// ============================================================

// Handler exposes notification HTTP endpoints (all require auth).
type Handler struct{ repo *Repository }

// NewHandler creates a new notification handler.
func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

// Routes returns the authenticated notification routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.List)
	r.Post("/read-all", h.ReadAll)
	r.Patch("/{id}/read", h.Read)
	return r
}

// List returns the user's notifications and unread count.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	onlyUnread := r.URL.Query().Get("unread") == "true"
	limit := httpx.QueryInt(r, "limit", 50)
	if limit < 1 || limit > 200 {
		limit = 50
	}
	items, unread, err := h.repo.ListForUser(r.Context(), userID, onlyUnread, limit)
	if err != nil {
		slog.Error("list notifications", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to load notifications")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"data":   items,
		"unread": unread,
	})
}

// Read marks a single notification as read.
func (h *Handler) Read(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.MarkAsRead(r.Context(), userID, id); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to mark as read")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

// ReadAll marks all unread notifications as read.
func (h *Handler) ReadAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if err := h.repo.MarkAllAsRead(r.Context(), userID); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to mark all as read")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "all_read"})
}
