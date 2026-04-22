package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/config"
)

// Connect creates a new PostgreSQL connection pool with production-ready settings.
func Connect(cfg *config.DatabaseConfig) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("parse database config: %w", err)
	}

	// Production-tuned pool settings
	poolCfg.MaxConns = 25
	poolCfg.MinConns = 5
	poolCfg.MaxConnLifetime = 30 * time.Minute
	poolCfg.MaxConnIdleTime = 5 * time.Minute
	poolCfg.HealthCheckPeriod = 1 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Verify connectivity
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	slog.Info("database connected", "target", cfg.SafeDescriptor())

	return pool, nil
}

// RunMigrations executes SQL migration files against the database.
// In production, use a proper migration tool (golang-migrate, goose, etc).
func RunMigrations(pool *pgxpool.Pool, migrationsDir string) error {
	slog.Info("running migrations", "dir", migrationsDir)
	// Implementation would read .sql files from migrationsDir and execute them.
	// For now, migrations are applied via docker-entrypoint or manually.
	return nil
}
