package user

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/vilavest/backend/internal/domain/audit"
	"github.com/vilavest/backend/internal/httpx"
	"github.com/vilavest/backend/internal/middleware"
)

// ============================================================
// Address model
// ============================================================

// Address is a saved shipping address for a customer.
type Address struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Label        string    `json:"label"`
	Street       string    `json:"street"`
	Number       string    `json:"number"`
	Complement   string    `json:"complement,omitempty"`
	Neighborhood string    `json:"neighborhood"`
	City         string    `json:"city"`
	State        string    `json:"state"`
	ZipCode      string    `json:"zip_code"`
	IsDefault    bool      `json:"is_default"`
	CreatedAt    time.Time `json:"created_at"`
}

// AddressRequest is used for create/update.
type AddressRequest struct {
	Label        string `json:"label"`
	Street       string `json:"street"`
	Number       string `json:"number"`
	Complement   string `json:"complement"`
	Neighborhood string `json:"neighborhood"`
	City         string `json:"city"`
	State        string `json:"state"`
	ZipCode      string `json:"zip_code"`
	IsDefault    bool   `json:"is_default"`
}

// UpdateProfileRequest updates the authenticated user's own profile.
type UpdateProfileRequest struct {
	FullName  string `json:"full_name"`
	Phone     string `json:"phone"`
	AvatarURL string `json:"avatar_url"`
}

// ============================================================
// Repository extensions
// ============================================================

// UpdateProfile mutates the editable fields of the authenticated user.
func (r *Repository) UpdateProfile(ctx context.Context, id uuid.UUID, req UpdateProfileRequest) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET full_name=$2, phone=NULLIF($3,''), avatar_url=NULLIF($4,'')
		WHERE id=$1
	`, id, req.FullName, req.Phone, req.AvatarURL)
	return err
}

// ListUsers returns a paginated list of users (admin).
func (r *Repository) ListUsers(ctx context.Context, search string, limit, offset int) ([]User, int, error) {
	countQ := `SELECT COUNT(*) FROM users WHERE 1=1`
	dataQ := `
		SELECT id, email, password_hash, full_name, COALESCE(phone,''), role::text, status::text,
		       COALESCE(avatar_url,''), created_at, updated_at
		FROM users WHERE 1=1
	`
	args := []interface{}{}
	if search != "" {
		countQ += ` AND (email ILIKE $1 OR full_name ILIKE $1)`
		dataQ += ` AND (email ILIKE $1 OR full_name ILIKE $1)`
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := r.pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	next := len(args) + 1
	dataQ += ` ORDER BY created_at DESC LIMIT $` + itoa(next) + ` OFFSET $` + itoa(next+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, dataQ, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []User{}
	for rows.Next() {
		var u User
		var role, status string
		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Phone,
			&role, &status, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, err
		}
		u.Role = Role(role)
		u.Status = status
		u.PasswordHash = "" // never leak
		out = append(out, u)
	}
	return out, total, nil
}

// SetStatus changes a user's status (admin).
func (r *Repository) SetStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET status=$2 WHERE id=$1`, id, status)
	return err
}

// ListAddresses returns the user's saved addresses.
func (r *Repository) ListAddresses(ctx context.Context, userID uuid.UUID) ([]Address, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, label, street, number, COALESCE(complement,''), neighborhood,
		       city, state, zip_code, is_default, created_at
		FROM addresses WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Address{}
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.UserID, &a.Label, &a.Street, &a.Number, &a.Complement,
			&a.Neighborhood, &a.City, &a.State, &a.ZipCode, &a.IsDefault, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
}

// CreateAddress inserts a new address.
func (r *Repository) CreateAddress(ctx context.Context, userID uuid.UUID, req AddressRequest) (*Address, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if req.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default=false WHERE user_id=$1`, userID); err != nil {
			return nil, err
		}
	}

	var a Address
	err = tx.QueryRow(ctx, `
		INSERT INTO addresses (user_id, label, street, number, complement, neighborhood, city, state, zip_code, is_default)
		VALUES ($1, COALESCE(NULLIF($2,''), 'Casa'), $3, $4, NULLIF($5,''), $6, $7, $8, $9, $10)
		RETURNING id, user_id, label, street, number, COALESCE(complement,''), neighborhood,
		          city, state, zip_code, is_default, created_at
	`, userID, req.Label, req.Street, req.Number, req.Complement, req.Neighborhood,
		req.City, req.State, req.ZipCode, req.IsDefault).
		Scan(&a.ID, &a.UserID, &a.Label, &a.Street, &a.Number, &a.Complement,
			&a.Neighborhood, &a.City, &a.State, &a.ZipCode, &a.IsDefault, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, tx.Commit(ctx)
}

// DeleteAddress removes an address owned by the user.
func (r *Repository) DeleteAddress(ctx context.Context, userID, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM addresses WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}

// ============================================================
// Handler extensions
// ============================================================

// ProfileRoutes returns authenticated routes for the logged-in user's profile/addresses.
func (h *Handler) ProfileRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.Me)
	r.Patch("/", h.UpdateMe)
	r.Get("/addresses", h.ListMyAddresses)
	r.Post("/addresses", h.CreateMyAddress)
	r.Delete("/addresses/{id}", h.DeleteMyAddress)
	return r
}

// AdminRoutes returns admin user management routes.
func (h *Handler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.AdminList)
	r.Get("/{id}", h.AdminGet)
	r.Patch("/{id}/status", h.AdminSetStatus)
	return r
}

// Me returns the authenticated user's profile.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	u, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	u.PasswordHash = ""
	httpx.WriteJSON(w, http.StatusOK, u)
}

// UpdateMe updates the authenticated user's profile.
func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var req UpdateProfileRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.FullName == "" {
		httpx.WriteError(w, http.StatusBadRequest, "full_name is required")
		return
	}
	if err := h.repo.UpdateProfile(r.Context(), userID, req); err != nil {
		slog.Error("update profile", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// ListMyAddresses returns the user's addresses.
func (h *Handler) ListMyAddresses(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	items, err := h.repo.ListAddresses(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to list addresses")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}

// CreateMyAddress adds a new address for the user.
func (h *Handler) CreateMyAddress(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var req AddressRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.Street == "" || req.ZipCode == "" || req.City == "" || req.State == "" {
		httpx.WriteError(w, http.StatusBadRequest, "address fields are required")
		return
	}
	a, err := h.repo.CreateAddress(r.Context(), userID, req)
	if err != nil {
		slog.Error("create address", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to create address")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, a)
}

// DeleteMyAddress deletes one of the user's saved addresses.
func (h *Handler) DeleteMyAddress(w http.ResponseWriter, r *http.Request) {
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
	if err := h.repo.DeleteAddress(r.Context(), userID, id); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to delete address")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AdminList returns a paginated list of users.
func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := httpx.Pagination(r)
	items, total, err := h.repo.ListUsers(r.Context(), r.URL.Query().Get("q"), limit, offset)
	if err != nil {
		slog.Error("admin list users", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": items, "total": total})
}

// AdminGet returns a single user by id.
func (h *Handler) AdminGet(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	u, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	u.PasswordHash = ""
	httpx.WriteJSON(w, http.StatusOK, u)
}

// AdminSetStatus changes the status of a user.
func (h *Handler) AdminSetStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	switch req.Status {
	case "active", "inactive", "banned":
	default:
		httpx.WriteError(w, http.StatusBadRequest, "invalid status")
		return
	}
	if err := h.repo.SetStatus(r.Context(), id, req.Status); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	if h.auditRepo != nil {
		actorID, _ := middleware.UserIDFromContext(r.Context())
		meta, _ := json.Marshal(map[string]string{"new_status": req.Status})
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &actorID,
			Action:     audit.ActionUpdate,
			Resource:   "user",
			ResourceID: &id,
			NewValues:  meta,
		})
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

// itoa is a tiny local helper to avoid importing strconv just for this.
func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := false
	if i < 0 {
		neg = true
		i = -i
	}
	buf := [20]byte{}
	pos := len(buf)
	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}
	if neg {
		pos--
		buf[pos] = '-'
	}
	return string(buf[pos:])
}
