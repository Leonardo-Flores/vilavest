package audit

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/httpx"
)

// ============================================================
// Request-scoped context helpers
// ============================================================

type ctxKey int

const (
	ctxKeyIP ctxKey = iota
	ctxKeyUserAgent
)

// ContextWithRequestInfo stores client IP and User-Agent in the request
// context, so downstream handlers can pull them out for audit entries.
func ContextWithRequestInfo(ctx context.Context, r *http.Request) context.Context {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		// X-Forwarded-For may contain multiple IPs; take the first one.
		ip = strings.TrimSpace(strings.Split(ip, ",")[0])
	} else {
		ip = r.RemoteAddr
	}
	// Strip port if present (e.g. "127.0.0.1:52345" → "127.0.0.1")
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	ctx = context.WithValue(ctx, ctxKeyIP, ip)
	ctx = context.WithValue(ctx, ctxKeyUserAgent, r.UserAgent())
	return ctx
}

// IPFromContext returns the client IP captured by ContextWithRequestInfo.
func IPFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyIP).(string); ok {
		return v
	}
	return ""
}

// UserAgentFromContext returns the User-Agent captured by ContextWithRequestInfo.
func UserAgentFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyUserAgent).(string); ok {
		return v
	}
	return ""
}

// Action represents the type of operation performed.
type Action string

const (
	ActionCreate Action = "CREATE"
	ActionUpdate Action = "UPDATE"
	ActionDelete Action = "DELETE"
	ActionLogin  Action = "LOGIN"
	ActionLogout Action = "LOGOUT"
	ActionExport Action = "EXPORT"
)

// LogEntry represents a single audit log record.
type LogEntry struct {
	ID          uuid.UUID       `json:"id"`
	UserID      *uuid.UUID      `json:"user_id,omitempty"`
	ActorEmail  string          `json:"actor_email,omitempty"`
	Action      Action          `json:"action"`
	Resource    string          `json:"resource"`
	Entity      string          `json:"entity"`
	ResourceID  *uuid.UUID      `json:"resource_id,omitempty"`
	EntityID    *uuid.UUID      `json:"entity_id,omitempty"`
	OldValues   json.RawMessage `json:"old_values,omitempty"`
	NewValues   json.RawMessage `json:"new_values,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	IPAddress   string          `json:"ip_address"`
	UserAgent   string          `json:"user_agent"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Repository handles audit log persistence.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new audit repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Record persists an audit log entry to the database.
func (r *Repository) Record(ctx context.Context, entry LogEntry) error {
	query := `
		INSERT INTO audit_logs (user_id, action, resource, resource_id, old_values, new_values, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::inet, $8)
	`
	_, err := r.pool.Exec(ctx,
		query,
		entry.UserID,
		string(entry.Action),
		entry.Resource,
		entry.ResourceID,
		entry.OldValues,
		entry.NewValues,
		entry.IPAddress,
		entry.UserAgent,
	)
	if err != nil {
		slog.Error("failed to record audit log",
			"error", err,
			"action", entry.Action,
			"resource", entry.Resource,
		)
		return err
	}
	return nil
}

// ListFilter defines pagination and filter options for audit log queries.
type ListFilter struct {
	UserID   *uuid.UUID
	Resource string
	Action   string
	Limit    int
	Offset   int
}

// List retrieves audit logs with pagination and optional filters, joining user email.
func (r *Repository) List(ctx context.Context, filter ListFilter) ([]LogEntry, int, error) {
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE 1=1`
	dataQuery := `
		SELECT a.id, a.user_id, COALESCE(u.email,''), a.action, a.resource, a.resource_id,
		       a.old_values, a.new_values,
		       COALESCE(host(a.ip_address), ''), COALESCE(a.user_agent,''), a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE 1=1
	`

	args := []interface{}{}
	argPos := 1

	if filter.UserID != nil {
		p := "$" + strconv.Itoa(argPos)
		countQuery += ` AND user_id = ` + p
		dataQuery += ` AND a.user_id = ` + p
		args = append(args, *filter.UserID)
		argPos++
	}
	if filter.Resource != "" {
		p := "$" + strconv.Itoa(argPos)
		countQuery += ` AND resource = ` + p
		dataQuery += ` AND a.resource = ` + p
		args = append(args, filter.Resource)
		argPos++
	}
	if filter.Action != "" {
		p := "$" + strconv.Itoa(argPos)
		countQuery += ` AND action ILIKE ` + p
		dataQuery += ` AND a.action ILIKE ` + p
		args = append(args, filter.Action)
		argPos++
	}

	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataQuery += ` ORDER BY a.created_at DESC LIMIT $` + strconv.Itoa(argPos) +
		` OFFSET $` + strconv.Itoa(argPos+1)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	entries := []LogEntry{}
	for rows.Next() {
		var e LogEntry
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.ActorEmail, &e.Action, &e.Resource, &e.ResourceID,
			&e.OldValues, &e.NewValues, &e.IPAddress, &e.UserAgent, &e.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		// Populate UI-friendly aliases
		e.Entity = e.Resource
		e.EntityID = e.ResourceID
		entries = append(entries, e)
	}

	return entries, total, nil
}

// --- Handler ---

// Handler exposes audit log HTTP endpoints (admin only).
type Handler struct{ repo *Repository }

// NewHandler creates a new audit handler.
func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

// Repo exposes the repository for external callers that need to record audit entries.
func (h *Handler) Repo() *Repository { return h.repo }

// Routes returns the admin audit routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListLogs)
	return r
}

// ListLogs handles GET /admin/audit and returns paginated audit entries.
func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	_, limit, offset := httpx.Pagination(r)
	if lim := q.Get("limit"); lim != "" {
		if n, err := strconv.Atoi(lim); err == nil && n > 0 {
			limit = n
			offset = 0
		}
	}

	filter := ListFilter{
		Resource: q.Get("entity"),
		Action:   q.Get("action"),
		Limit:    limit,
		Offset:   offset,
	}

	entries, total, err := h.repo.List(r.Context(), filter)
	if err != nil {
		slog.Error("audit list failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to list audit logs")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"data":  entries,
		"total": total,
	})
}

// RecordAsync fires an audit log entry in a background goroutine so it never
// blocks the request path. It captures context values (IP, user-agent) before
// launching the goroutine because the request context will be cancelled.
func RecordAsync(repo *Repository, ctx context.Context, entry LogEntry) {
	// Capture context values synchronously before they disappear.
	if entry.IPAddress == "" {
		entry.IPAddress = IPFromContext(ctx)
	}
	if entry.UserAgent == "" {
		entry.UserAgent = UserAgentFromContext(ctx)
	}
	go func() {
		bgCtx := context.Background()
		if err := repo.Record(bgCtx, entry); err != nil {
			slog.Error("async audit record failed",
				"error", err,
				"action", entry.Action,
				"resource", entry.Resource,
			)
		}
	}()
}