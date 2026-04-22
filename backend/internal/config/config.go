package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	App      AppConfig
}

type ServerConfig struct {
	Host string
	Port int
}

type DatabaseConfig struct {
	URL      string
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

type JWTConfig struct {
	Secret          string
	ExpirationHours int
	RefreshDays     int
}

type AppConfig struct {
	Environment    string
	LogLevel       string
	FrontendURL    string
	AllowedOrigins []string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	frontendURL := getEnv("FRONTEND_URL", "http://localhost:5173")
	allowedOrigins := parseCSV(getEnv("ALLOWED_ORIGINS", frontendURL))

	return &Config{
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
			Port: getEnvInt("PORT", getEnvInt("SERVER_PORT", 8080)),
		},
		Database: DatabaseConfig{
			URL:      getEnv("DATABASE_URL", ""),
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "vilavest"),
			Password: getEnv("DB_PASSWORD", "vilavest_secret"),
			Name:     getEnv("DB_NAME", "vilavest"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:          getEnv("JWT_SECRET", "change-me-in-production"),
			ExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),
			RefreshDays:     getEnvInt("JWT_REFRESH_DAYS", 7),
		},
		App: AppConfig{
			Environment:    getEnv("APP_ENV", "development"),
			LogLevel:       getEnv("LOG_LEVEL", "debug"),
			FrontendURL:    frontendURL,
			AllowedOrigins: allowedOrigins,
		},
	}
}

func (d *DatabaseConfig) DSN() string {
	if d.URL != "" {
		return d.URL
	}
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode,
	)
}

func (d *DatabaseConfig) SafeDescriptor() string {
	if d.URL != "" {
		return "DATABASE_URL (***redacted***)"
	}
	return fmt.Sprintf("%s:%d/%s", d.Host, d.Port, d.Name)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func parseCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
