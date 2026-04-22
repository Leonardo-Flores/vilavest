// Package metrics aggregates business KPIs for the admin dashboard.
package metrics

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/httpx"
)

// ============================================================
// Models
// ============================================================

// Summary is the top-of-dashboard KPI snapshot.
type Summary struct {
	GrossRevenue    float64 `json:"gross_revenue"`
	NetRevenue      float64 `json:"net_revenue"`
	OrdersTotal     int     `json:"orders_total"`
	OrdersPaid      int     `json:"orders_paid"`
	OrdersPending   int     `json:"orders_pending"`
	OrdersCancelled int     `json:"orders_cancelled"`
	AverageOrder    float64 `json:"average_order_value"`
	NewCustomers    int     `json:"new_customers"`
	ProductsActive  int     `json:"products_active"`
	LowStockCount   int     `json:"low_stock_count"`
	RangeDays       int     `json:"range_days"`
}

// SalesPoint is a single (day, revenue, orders) tuple for the sales chart.
type SalesPoint struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Orders  int     `json:"orders"`
}

// TopProduct is an entry in the "best sellers" ranking.
type TopProduct struct {
	ProductID   string  `json:"product_id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Image       string  `json:"image,omitempty"`
	UnitsSold   int     `json:"units_sold"`
	Revenue     float64 `json:"revenue"`
	StockOnHand int     `json:"stock_on_hand"`
}

// LowStockItem flags a product with stock at or below the configured threshold.
type LowStockItem struct {
	ProductID string `json:"product_id"`
	SKU       string `json:"sku"`
	Name      string `json:"name"`
	Quantity  int    `json:"quantity"`
	Threshold int    `json:"threshold"`
}

// ============================================================
// Repository
// ============================================================

// Repository runs aggregate queries for the admin dashboard.
type Repository struct{ pool *pgxpool.Pool }

// NewRepository creates a new metrics repository.
func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// BuildSummary returns a dashboard KPI summary for the last `days` days.
func (r *Repository) BuildSummary(ctx context.Context, days int) (*Summary, error) {
	if days < 1 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)
	s := &Summary{RangeDays: days}

	// Orders aggregates
	err := r.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total END), 0) AS gross,
			COALESCE(SUM(CASE WHEN status IN ('paid','processing','shipped','in_transit','delivered') THEN total END), 0) AS net,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status IN ('paid','processing','shipped','in_transit','delivered')) AS paid,
			COUNT(*) FILTER (WHERE status = 'pending') AS pending,
			COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
		FROM orders
		WHERE created_at >= $1
	`, since).Scan(&s.GrossRevenue, &s.NetRevenue, &s.OrdersTotal, &s.OrdersPaid, &s.OrdersPending, &s.OrdersCancelled)
	if err != nil {
		return nil, err
	}
	if s.OrdersPaid > 0 {
		s.AverageOrder = s.NetRevenue / float64(s.OrdersPaid)
	}

	_ = r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE role='customer' AND created_at >= $1`, since,
	).Scan(&s.NewCustomers)

	_ = r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM products WHERE is_active = true`,
	).Scan(&s.ProductsActive)

	_ = r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM stock WHERE quantity <= low_stock_threshold`,
	).Scan(&s.LowStockCount)

	return s, nil
}

// SalesChart returns a time series of (day, revenue, orders).
func (r *Repository) SalesChart(ctx context.Context, days int) ([]SalesPoint, error) {
	if days < 1 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)
	rows, err := r.pool.Query(ctx, `
		SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
		       COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS revenue,
		       COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded')) AS orders
		FROM orders
		WHERE created_at >= $1
		GROUP BY day
		ORDER BY day
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SalesPoint{}
	for rows.Next() {
		var p SalesPoint
		if err := rows.Scan(&p.Date, &p.Revenue, &p.Orders); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// TopProducts returns the top-selling products by units sold.
func (r *Repository) TopProducts(ctx context.Context, days, limit int) ([]TopProduct, error) {
	if days < 1 {
		days = 30
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}
	since := time.Now().AddDate(0, 0, -days)
	rows, err := r.pool.Query(ctx, `
		SELECT oi.product_id::text, p.name, p.slug,
		       COALESCE((SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1), ''),
		       SUM(oi.quantity)::int AS units,
		       SUM(oi.total_price) AS revenue,
		       COALESCE((SELECT quantity FROM stock WHERE product_id = p.id AND variant_id IS NULL LIMIT 1), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN products p ON p.id = oi.product_id
		WHERE o.created_at >= $1 AND o.status NOT IN ('cancelled','refunded')
		GROUP BY oi.product_id, p.id, p.name, p.slug
		ORDER BY units DESC
		LIMIT $2
	`, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TopProduct{}
	for rows.Next() {
		var t TopProduct
		if err := rows.Scan(&t.ProductID, &t.Name, &t.Slug, &t.Image, &t.UnitsSold, &t.Revenue, &t.StockOnHand); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

// LowStock returns products at or below their low-stock threshold.
func (r *Repository) LowStock(ctx context.Context, limit int) ([]LowStockItem, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT p.id::text, p.sku, p.name, s.quantity, s.low_stock_threshold
		FROM stock s JOIN products p ON p.id = s.product_id
		WHERE s.quantity <= s.low_stock_threshold
		ORDER BY s.quantity ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LowStockItem{}
	for rows.Next() {
		var l LowStockItem
		if err := rows.Scan(&l.ProductID, &l.SKU, &l.Name, &l.Quantity, &l.Threshold); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, nil
}

// ============================================================
// Handler
// ============================================================

// Handler exposes admin dashboard metrics endpoints.
type Handler struct{ repo *Repository }

// NewHandler creates a new metrics handler.
func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

// Routes returns the admin metrics routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/summary", h.Summary)
	r.Get("/sales-chart", h.SalesChart)
	r.Get("/top-products", h.TopProducts)
	r.Get("/low-stock", h.LowStock)
	return r
}

func (h *Handler) days(r *http.Request) int {
	return httpx.QueryInt(r, "days", 30)
}

// Summary returns the dashboard KPI summary.
func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	s, err := h.repo.BuildSummary(r.Context(), h.days(r))
	if err != nil {
		slog.Error("metrics summary", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to build summary")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, s)
}

// SalesChart returns a sales time series.
func (h *Handler) SalesChart(w http.ResponseWriter, r *http.Request) {
	pts, err := h.repo.SalesChart(r.Context(), h.days(r))
	if err != nil {
		slog.Error("metrics sales chart", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to build chart")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": pts})
}

// TopProducts returns the best-selling products.
func (h *Handler) TopProducts(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.TopProducts(r.Context(), h.days(r), httpx.QueryInt(r, "limit", 10))
	if err != nil {
		slog.Error("metrics top products", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to build top products")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}

// LowStock returns items currently below their stock threshold.
func (h *Handler) LowStock(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.LowStock(r.Context(), httpx.QueryInt(r, "limit", 50))
	if err != nil {
		slog.Error("metrics low stock", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to load low stock")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}
