// Package product owns the catalog domain: models, persistence, and HTTP handlers.
package product

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"encoding/json"

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

// Product represents a product in the catalog.
type Product struct {
	ID             uuid.UUID  `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Slug           string     `json:"slug"`
	Description    string     `json:"description,omitempty"`
	Price          float64    `json:"price"`
	CompareAtPrice *float64   `json:"compare_at_price,omitempty"`
	CostPrice      *float64   `json:"cost_price,omitempty"`
	CategoryID     *uuid.UUID `json:"category_id,omitempty"`
	CategoryName   string     `json:"category_name,omitempty"`
	Brand          string     `json:"brand,omitempty"`
	WeightGrams    *int       `json:"weight_grams,omitempty"`
	IsActive       bool       `json:"is_active"`
	IsFeatured     bool       `json:"is_featured"`
	Images         []Image    `json:"images,omitempty"`
	StockQuantity  int        `json:"stock_quantity"`
	LowStockAt     int        `json:"low_stock_threshold,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// Image represents a product image.
type Image struct {
	ID        uuid.UUID `json:"id"`
	URL       string    `json:"url"`
	AltText   string    `json:"alt_text,omitempty"`
	SortOrder int       `json:"sort_order"`
	IsPrimary bool      `json:"is_primary"`
}

// UpsertRequest is used for both create and update.
type UpsertRequest struct {
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Slug           string     `json:"slug"`
	Description    string     `json:"description"`
	Price          float64    `json:"price"`
	CompareAtPrice *float64   `json:"compare_at_price"`
	CostPrice      *float64   `json:"cost_price"`
	CategoryID     *uuid.UUID `json:"category_id"`
	Brand          string     `json:"brand"`
	WeightGrams    *int       `json:"weight_grams"`
	IsActive       *bool      `json:"is_active"`
	IsFeatured     *bool      `json:"is_featured"`
	InitialStock   *int       `json:"initial_stock"`
	Images         []ImageIn  `json:"images"`
}

// ImageIn is an image payload during upsert.
type ImageIn struct {
	URL       string `json:"url"`
	AltText   string `json:"alt_text"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

// StockUpdateRequest is the payload for PATCH /admin/products/{id}/stock.
type StockUpdateRequest struct {
	Quantity   *int `json:"quantity"`
	Delta      *int `json:"delta"`
	LowStockAt *int `json:"low_stock_threshold"`
}

// PaginatedResponse wraps a list with pagination metadata.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}

// ============================================================
// Repository
// ============================================================

// Repository handles product persistence.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new product repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ListFilter is used by List to filter / paginate the catalog.
type ListFilter struct {
	Search     string
	CategoryID *uuid.UUID
	MinPrice   *float64
	MaxPrice   *float64
	Featured   *bool
	Sort       string
	OnlyActive bool
	Page       int
	Limit      int
}

// List retrieves paginated products with search + filters.
func (r *Repository) List(ctx context.Context, f ListFilter) ([]Product, int, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1

	if f.OnlyActive {
		where = append(where, "p.is_active = true")
	}
	if f.Search != "" {
		where = append(where, "(p.name ILIKE $"+strconv.Itoa(argN)+" OR p.sku ILIKE $"+strconv.Itoa(argN)+")")
		args = append(args, "%"+f.Search+"%")
		argN++
	}
	if f.CategoryID != nil {
		where = append(where, "p.category_id = $"+strconv.Itoa(argN))
		args = append(args, *f.CategoryID)
		argN++
	}
	if f.MinPrice != nil {
		where = append(where, "p.price >= $"+strconv.Itoa(argN))
		args = append(args, *f.MinPrice)
		argN++
	}
	if f.MaxPrice != nil {
		where = append(where, "p.price <= $"+strconv.Itoa(argN))
		args = append(args, *f.MaxPrice)
		argN++
	}
	if f.Featured != nil {
		where = append(where, "p.is_featured = $"+strconv.Itoa(argN))
		args = append(args, *f.Featured)
		argN++
	}

	order := " ORDER BY p.created_at DESC"
	switch f.Sort {
	case "price_asc":
		order = " ORDER BY p.price ASC"
	case "price_desc":
		order = " ORDER BY p.price DESC"
	case "name":
		order = " ORDER BY p.name ASC"
	case "newest":
		order = " ORDER BY p.created_at DESC"
	}

	whereClause := " WHERE " + strings.Join(where, " AND ")

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM products p`+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataQ := `
		SELECT p.id, p.sku, p.name, p.slug, COALESCE(p.description,''), p.price,
		       p.compare_at_price, p.category_id, COALESCE(c.name,''), COALESCE(p.brand,''),
		       p.is_active, p.is_featured, COALESCE(s.quantity, 0), COALESCE(s.low_stock_threshold, 5),
		       p.created_at, p.updated_at,
		       COALESCE((SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order LIMIT 1), '')
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN stock s ON s.product_id = p.id AND s.variant_id IS NULL
	` + whereClause + order + ` LIMIT $` + strconv.Itoa(argN) + ` OFFSET $` + strconv.Itoa(argN+1)
	args = append(args, f.Limit, offset)

	rows, err := r.pool.Query(ctx, dataQ, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	products := []Product{}
	for rows.Next() {
		var p Product
		var primaryImage string
		if err := rows.Scan(
			&p.ID, &p.SKU, &p.Name, &p.Slug, &p.Description, &p.Price,
			&p.CompareAtPrice, &p.CategoryID, &p.CategoryName, &p.Brand,
			&p.IsActive, &p.IsFeatured, &p.StockQuantity, &p.LowStockAt,
			&p.CreatedAt, &p.UpdatedAt, &primaryImage,
		); err != nil {
			return nil, 0, err
		}
		if primaryImage != "" {
			p.Images = []Image{{URL: primaryImage, IsPrimary: true}}
		}
		products = append(products, p)
	}
	return products, total, nil
}

// GetBySlug retrieves a single product by its slug (with images).
func (r *Repository) GetBySlug(ctx context.Context, slug string) (*Product, error) {
	return r.getOne(ctx, "p.slug = $1", slug)
}

// GetByID retrieves a single product by UUID (admin).
func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	return r.getOne(ctx, "p.id = $1", id)
}

func (r *Repository) getOne(ctx context.Context, cond string, arg interface{}) (*Product, error) {
	q := `
		SELECT p.id, p.sku, p.name, p.slug, COALESCE(p.description,''), p.price,
		       p.compare_at_price, p.category_id, COALESCE(c.name,''), COALESCE(p.brand,''),
		       p.is_active, p.is_featured, COALESCE(s.quantity, 0), COALESCE(s.low_stock_threshold, 5),
		       p.created_at, p.updated_at
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN stock s ON s.product_id = p.id AND s.variant_id IS NULL
		WHERE ` + cond

	var p Product
	if err := r.pool.QueryRow(ctx, q, arg).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Slug, &p.Description, &p.Price,
		&p.CompareAtPrice, &p.CategoryID, &p.CategoryName, &p.Brand,
		&p.IsActive, &p.IsFeatured, &p.StockQuantity, &p.LowStockAt,
		&p.CreatedAt, &p.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	imgRows, err := r.pool.Query(ctx,
		`SELECT id, url, COALESCE(alt_text,''), sort_order, is_primary
		 FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order`,
		p.ID,
	)
	if err == nil {
		defer imgRows.Close()
		for imgRows.Next() {
			var img Image
			if err := imgRows.Scan(&img.ID, &img.URL, &img.AltText, &img.SortOrder, &img.IsPrimary); err == nil {
				p.Images = append(p.Images, img)
			}
		}
	}

	return &p, nil
}

// Create inserts a new product with initial stock and images.
func (r *Repository) Create(ctx context.Context, req UpsertRequest) (*Product, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if req.Slug == "" {
		req.Slug = slugify(req.Name)
	}
	if req.SKU == "" {
		req.SKU = generateSKU(req.Name)
	}

	active := true
	featured := false
	if req.IsActive != nil {
		active = *req.IsActive
	}
	if req.IsFeatured != nil {
		featured = *req.IsFeatured
	}

	var id uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO products (sku, name, slug, description, price, compare_at_price, cost_price,
		                     category_id, brand, weight_grams, is_active, is_featured)
		VALUES ($1, $2, $3, NULLIF($4,''), $5, $6, $7, $8, NULLIF($9,''), $10, $11, $12)
		RETURNING id
	`, req.SKU, req.Name, req.Slug, req.Description, req.Price,
		req.CompareAtPrice, req.CostPrice, req.CategoryID, req.Brand,
		req.WeightGrams, active, featured).Scan(&id)
	if err != nil {
		return nil, err
	}

	initial := 0
	if req.InitialStock != nil {
		initial = *req.InitialStock
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO stock (product_id, quantity, reserved, low_stock_threshold) VALUES ($1,$2,0,$3)`,
		id, initial, 5,
	); err != nil {
		return nil, err
	}

	for i, img := range req.Images {
		if img.URL == "" {
			continue
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
			 VALUES ($1, $2, NULLIF($3,''), $4, $5)`,
			id, img.URL, img.AltText, img.SortOrder, i == 0 || img.IsPrimary,
		); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// Update modifies an existing product (full replace semantics on provided fields).
func (r *Repository) Update(ctx context.Context, id uuid.UUID, req UpsertRequest) (*Product, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if req.Slug == "" {
		req.Slug = slugify(req.Name)
	}

	active := true
	featured := false
	if req.IsActive != nil {
		active = *req.IsActive
	}
	if req.IsFeatured != nil {
		featured = *req.IsFeatured
	}

	if _, err := tx.Exec(ctx, `
		UPDATE products SET
		  sku = COALESCE(NULLIF($2,''), sku),
		  name = $3,
		  slug = $4,
		  description = NULLIF($5,''),
		  price = $6,
		  compare_at_price = $7,
		  cost_price = $8,
		  category_id = $9,
		  brand = NULLIF($10,''),
		  weight_grams = $11,
		  is_active = $12,
		  is_featured = $13
		WHERE id = $1
	`, id, req.SKU, req.Name, req.Slug, req.Description, req.Price,
		req.CompareAtPrice, req.CostPrice, req.CategoryID, req.Brand,
		req.WeightGrams, active, featured); err != nil {
		return nil, err
	}

	// Replace images if provided
	if req.Images != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM product_images WHERE product_id = $1`, id); err != nil {
			return nil, err
		}
		for i, img := range req.Images {
			if img.URL == "" {
				continue
			}
			if _, err := tx.Exec(ctx,
				`INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
				 VALUES ($1, $2, NULLIF($3,''), $4, $5)`,
				id, img.URL, img.AltText, img.SortOrder, i == 0 || img.IsPrimary,
			); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// Delete soft-deletes (deactivates) a product.
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE products SET is_active = false WHERE id = $1`, id)
	return err
}

// UpdateStock sets or adjusts stock for a product.
func (r *Repository) UpdateStock(ctx context.Context, productID uuid.UUID, req StockUpdateRequest) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Ensure a stock row exists
	if _, err := tx.Exec(ctx,
		`INSERT INTO stock (product_id, quantity, reserved, low_stock_threshold)
		 VALUES ($1, 0, 0, 5)
		 ON CONFLICT (product_id, variant_id) DO NOTHING`,
		productID,
	); err != nil {
		return err
	}

	if req.Quantity != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE stock SET quantity = $1 WHERE product_id = $2 AND variant_id IS NULL`,
			*req.Quantity, productID,
		); err != nil {
			return err
		}
	} else if req.Delta != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE stock SET quantity = GREATEST(0, quantity + $1) WHERE product_id = $2 AND variant_id IS NULL`,
			*req.Delta, productID,
		); err != nil {
			return err
		}
	}
	if req.LowStockAt != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE stock SET low_stock_threshold = $1 WHERE product_id = $2 AND variant_id IS NULL`,
			*req.LowStockAt, productID,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// ============================================================
// Handler
// ============================================================

// Handler provides HTTP endpoints for the catalog domain.
type Handler struct {
	repo      *Repository
	auditRepo *audit.Repository
}

// NewHandler creates a new product handler.
func NewHandler(repo *Repository, auditRepo ...*audit.Repository) *Handler {
	h := &Handler{repo: repo}
	if len(auditRepo) > 0 {
		h.auditRepo = auditRepo[0]
	}
	return h
}

// Routes returns the public storefront routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListPublic)
	r.Get("/{slug}", h.GetBySlug)
	return r
}

// AdminRoutes returns the admin catalog routes.
func (h *Handler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListAdmin)
	r.Post("/", h.Create)
	r.Get("/{id}", h.GetByID)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Patch("/{id}/stock", h.UpdateStock)
	return r
}

// ListPublic lists active products for the storefront.
func (h *Handler) ListPublic(w http.ResponseWriter, r *http.Request) {
	f := buildListFilter(r)
	f.OnlyActive = true
	h.writeList(w, r, f)
}

// ListAdmin lists all products (including inactive) for admins.
func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	f := buildListFilter(r)
	h.writeList(w, r, f)
}

func (h *Handler) writeList(w http.ResponseWriter, r *http.Request, f ListFilter) {
	products, total, err := h.repo.List(r.Context(), f)
	if err != nil {
		slog.Error("product list failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to list products")
		return
	}
	totalPages := 0
	if f.Limit > 0 {
		totalPages = (total + f.Limit - 1) / f.Limit
	}
	httpx.WriteJSON(w, http.StatusOK, PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       f.Page,
		Limit:      f.Limit,
		TotalPages: totalPages,
	})
}

func buildListFilter(r *http.Request) ListFilter {
	q := r.URL.Query()
	page, limit, _ := httpx.Pagination(r)
	f := ListFilter{
		Search: q.Get("search"),
		Sort:   q.Get("sort"),
		Page:   page,
		Limit:  limit,
	}
	if cat := q.Get("category_id"); cat != "" {
		if id, err := uuid.Parse(cat); err == nil {
			f.CategoryID = &id
		}
	}
	if v := q.Get("min_price"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			f.MinPrice = &n
		}
	}
	if v := q.Get("max_price"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			f.MaxPrice = &n
		}
	}
	if v := q.Get("featured"); v != "" {
		b := v == "true" || v == "1"
		f.Featured = &b
	}
	return f
}

// GetBySlug returns a single product by slug (storefront).
func (h *Handler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	p, err := h.repo.GetBySlug(r.Context(), slug)
	if err != nil {
		slog.Error("product get failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to get product")
		return
	}
	if p == nil {
		httpx.WriteError(w, http.StatusNotFound, "product not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// GetByID returns a single product by UUID (admin).
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		slog.Error("product admin get failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to get product")
		return
	}
	if p == nil {
		httpx.WriteError(w, http.StatusNotFound, "product not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// Create handles POST /admin/products.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req UpsertRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Name) == "" || req.Price < 0 {
		httpx.WriteError(w, http.StatusBadRequest, "name and valid price are required")
		return
	}
	p, err := h.repo.Create(r.Context(), req)
	if err != nil {
		slog.Error("product create failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to create product")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		newVals, _ := json.Marshal(p)
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionCreate,
			Resource:   "product",
			ResourceID: &p.ID,
			NewValues:  newVals,
		})
	}

	httpx.WriteJSON(w, http.StatusCreated, p)
}

// Update handles PUT /admin/products/{id}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req UpsertRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	p, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		slog.Error("product update failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to update product")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		newVals, _ := json.Marshal(p)
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionUpdate,
			Resource:   "product",
			ResourceID: &id,
			NewValues:  newVals,
		})
	}

	httpx.WriteJSON(w, http.StatusOK, p)
}

// Delete handles DELETE /admin/products/{id}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		slog.Error("product delete failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to delete product")
		return
	}

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionDelete,
			Resource:   "product",
			ResourceID: &id,
		})
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deactivated"})
}

// UpdateStock handles PATCH /admin/products/{id}/stock.
func (h *Handler) UpdateStock(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req StockUpdateRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if err := h.repo.UpdateStock(r.Context(), id, req); err != nil {
		slog.Error("product stock update failed", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to update stock")
		return
	}
	p, _ := h.repo.GetByID(r.Context(), id)

	if h.auditRepo != nil {
		userID, _ := middleware.UserIDFromContext(r.Context())
		meta, _ := json.Marshal(req)
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:     &userID,
			Action:     audit.ActionUpdate,
			Resource:   "product_stock",
			ResourceID: &id,
			NewValues:  meta,
		})
	}

	httpx.WriteJSON(w, http.StatusOK, p)
}

// ============================================================
// Helpers
// ============================================================

var slugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugPattern.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "produto-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return s
}

func generateSKU(name string) string {
	base := strings.ToUpper(slugify(name))
	if len(base) > 10 {
		base = base[:10]
	}
	return "VV-" + base + "-" + strconv.FormatInt(time.Now().Unix()%100000, 10)
}
