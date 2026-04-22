package category

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/domain/audit"
	"github.com/vilavest/backend/internal/httpx"
	"github.com/vilavest/backend/internal/middleware"
)

// Category represents a product category.
type Category struct {
	ID         uuid.UUID  `json:"id"`
	Name       string     `json:"name"`
	Slug       string     `json:"slug"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty"`
	ImageURL   string     `json:"image_url,omitempty"`
	SortOrder  int        `json:"sort_order"`
	CreatedAt  time.Time  `json:"created_at"`
}

// UpsertRequest is used for admin create/update.
type UpsertRequest struct {
	Name      string     `json:"name"`
	Slug      string     `json:"slug"`
	ParentID  *uuid.UUID `json:"parent_id"`
	ImageURL  string     `json:"image_url"`
	SortOrder int        `json:"sort_order"`
}

// Repository persists categories.
type Repository struct{ pool *pgxpool.Pool }

// NewRepository creates a new category repository.
func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// List returns all categories ordered by sort_order.
func (r *Repository) List(ctx context.Context) ([]Category, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, slug, parent_id, COALESCE(image_url,''), sort_order, created_at
		FROM categories ORDER BY sort_order, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.ImageURL, &c.SortOrder, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// Create inserts a new category.
func (r *Repository) Create(ctx context.Context, req UpsertRequest) (*Category, error) {
	c := &Category{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO categories (name, slug, parent_id, image_url, sort_order)
		VALUES ($1, $2, $3, NULLIF($4,''), $5)
		RETURNING id, name, slug, parent_id, COALESCE(image_url,''), sort_order, created_at
	`, req.Name, req.Slug, req.ParentID, req.ImageURL, req.SortOrder).
		Scan(&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.ImageURL, &c.SortOrder, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// Update modifies an existing category.
func (r *Repository) Update(ctx context.Context, id uuid.UUID, req UpsertRequest) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE categories SET name=$2, slug=$3, parent_id=$4, image_url=NULLIF($5,''), sort_order=$6
		WHERE id=$1
	`, id, req.Name, req.Slug, req.ParentID, req.ImageURL, req.SortOrder)
	return err
}

// Delete removes a category by ID.
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM categories WHERE id = $1`, id)
	return err
}

// --- Handler ---

// Handler exposes category HTTP endpoints.
type Handler struct {
	repo      *Repository
	auditRepo *audit.Repository
}

// NewHandler creates a new category handler.
func NewHandler(repo *Repository, auditRepo ...*audit.Repository) *Handler {
	h := &Handler{repo: repo}
	if len(auditRepo) > 0 {
		h.auditRepo = auditRepo[0]
	}
	return h
}

// Routes returns the public category routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.List)
	return r
}

// AdminRoutes returns the admin category routes.
func (h *Handler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	return r
}

// List returns all categories.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	cats, err := h.repo.List(r.Context())
	if err != nil {
		slog.Error("list categories", "error", err)
		httpx.WriteError(w, 500, "failed to list categories")
		return
	}
	httpx.WriteJSON(w, 200, map[string]interface{}{"data": cats})
}

// Create adds a new category.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req UpsertRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.Name == "" || req.Slug == "" {
		httpx.WriteError(w, 400, "name and slug are required")
		return
	}
	c, err := h.repo.Create(r.Context(), req)
	if err != nil {
		slog.Error("create category", "error", err)
		httpx.WriteError(w, 400, "failed to create category")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		newVals, _ := json.Marshal(c)
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionCreate,
			Resource:   "category",
			ResourceID: &c.ID,
			NewValues:  newVals,
		})
	}

	httpx.WriteJSON(w, 201, c)
}

// Update modifies a category.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, 400, "invalid id")
		return
	}
	var req UpsertRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if err := h.repo.Update(r.Context(), id, req); err != nil {
		httpx.WriteError(w, 400, "failed to update category")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		newVals, _ := json.Marshal(req)
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionUpdate,
			Resource:   "category",
			ResourceID: &id,
			NewValues:  newVals,
		})
	}

	httpx.WriteJSON(w, 200, map[string]string{"status": "updated"})
}

// Delete removes a category.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, 400, "invalid id")
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		httpx.WriteError(w, 400, "failed to delete category")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionDelete,
			Resource:   "category",
			ResourceID: &id,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}
