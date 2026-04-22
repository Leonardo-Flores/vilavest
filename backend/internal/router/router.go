// Package router wires every domain into the HTTP entrypoint.
package router

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/config"
	"github.com/vilavest/backend/internal/domain/audit"
	"github.com/vilavest/backend/internal/domain/cart"
	"github.com/vilavest/backend/internal/domain/category"
	"github.com/vilavest/backend/internal/domain/metrics"
	"github.com/vilavest/backend/internal/domain/notification"
	"github.com/vilavest/backend/internal/domain/order"
	"github.com/vilavest/backend/internal/domain/product"
	"github.com/vilavest/backend/internal/domain/shipment"
	"github.com/vilavest/backend/internal/domain/upload"
	"github.com/vilavest/backend/internal/domain/user"
	"github.com/vilavest/backend/internal/middleware"
)

// New creates and configures the main application router.
func New(cfg *config.Config, pool *pgxpool.Pool) *chi.Mux {
	r := chi.NewRouter()

	// --- Global Middleware Stack ---
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.AuditMiddleware)

	origins := cfg.App.AllowedOrigins
	if len(origins) == 0 {
		origins = []string{cfg.App.FrontendURL}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Use(httprate.LimitByIP(120, time.Minute))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"vilavest-api","version":"1.0.0"}`))
	})

	// --- Domain repositories + handlers ---
	auditRepo := audit.NewRepository(pool)
	auditH := audit.NewHandler(auditRepo)

	productRepo := product.NewRepository(pool)
	productH := product.NewHandler(productRepo, auditRepo)

	categoryRepo := category.NewRepository(pool)
	categoryH := category.NewHandler(categoryRepo, auditRepo)

	userRepo := user.NewRepository(pool)
	userH := user.NewHandler(userRepo, &cfg.JWT, auditRepo)

	cartRepo := cart.NewRepository(pool)
	cartH := cart.NewHandler(cartRepo)

	orderRepo := order.NewRepository(pool)
	orderH := order.NewHandler(orderRepo, auditRepo)

	shipmentRepo := shipment.NewRepository(pool)
	shipmentH := shipment.NewHandler(shipmentRepo)

	notifRepo := notification.NewRepository(pool)
	notifH := notification.NewHandler(notifRepo)

	metricsRepo := metrics.NewRepository(pool)
	metricsH := metrics.NewHandler(metricsRepo)

	uploadH, err := upload.NewHandler("/app/uploads", "/uploads")
	if err != nil {
		slog.Error("upload handler init", "err", err)
	}

	// Public static files for uploaded images (served at /uploads/*).
	if uploadH != nil {
		r.Mount("/uploads", uploadH.StaticHandler())
	}

	r.Route("/api/v1", func(api chi.Router) {
		// Public routes
		api.Mount("/auth", userH.Routes())
		api.Mount("/products", productH.Routes())
		api.Mount("/categories", categoryH.Routes())
		api.Mount("/tracking", shipmentH.PublicRoutes())

		// Authenticated routes
		api.Group(func(protected chi.Router) {
			protected.Use(middleware.JWTAuth(&cfg.JWT))

			protected.Mount("/me", userH.ProfileRoutes())
			protected.Mount("/cart", cartH.Routes())
			protected.Mount("/orders", orderH.UserRoutes())
			protected.Mount("/notifications", notifH.Routes())
			protected.Mount("/shipments", shipmentH.UserRoutes())
		})

		// Admin routes
		api.Route("/admin", func(admin chi.Router) {
			admin.Use(middleware.JWTAuth(&cfg.JWT))
			admin.Use(middleware.RequireRole("admin", "manager"))

			admin.Mount("/products", productH.AdminRoutes())
			admin.Mount("/categories", categoryH.AdminRoutes())
			admin.Mount("/orders", orderH.AdminRoutes())
			admin.Mount("/shipments", shipmentH.AdminRoutes())
			admin.Mount("/users", userH.AdminRoutes())
			admin.Mount("/metrics", metricsH.Routes())
			admin.Mount("/audit", auditH.Routes())

			// Upload endpoint (admin-only)
			if uploadH != nil {
				admin.Post("/upload", uploadH.Upload)
			}
		})
	})

	return r
}