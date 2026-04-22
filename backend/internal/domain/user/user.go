package user

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vilavest/backend/internal/config"
	"github.com/vilavest/backend/internal/domain/audit"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================
// Models
// ============================================================

type Role string

const (
	RoleCustomer Role = "customer"
	RoleManager  Role = "manager"
	RoleAdmin    Role = "admin"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	Phone        string    `json:"phone,omitempty"`
	Role         Role      `json:"role"`
	Status       string    `json:"status"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RegisterRequest struct {
	Email    string `json:"email"     validate:"required,email"`
	Password string `json:"password"  validate:"required,min=8"`
	FullName string `json:"full_name" validate:"required"`
	Phone    string `json:"phone"`
}

type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
	User      User   `json:"user"`
}

// ============================================================
// Repository
// ============================================================

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, u *User) error {
	query := `
		INSERT INTO users (email, password_hash, full_name, phone, role, status)
		VALUES ($1, $2, $3, $4, $5, 'active')
		RETURNING id, created_at, updated_at
	`
	return r.pool.QueryRow(ctx, query,
		u.Email, u.PasswordHash, u.FullName, u.Phone, u.Role,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, email, password_hash, full_name,
		       COALESCE(phone, ''), role, status,
		       COALESCE(avatar_url, ''), created_at, updated_at
		FROM users WHERE email = $1
	`
	var u User
	err := r.pool.QueryRow(ctx, query, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Phone,
		&u.Role, &u.Status, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, email, password_hash, full_name,
		       COALESCE(phone, ''), role, status,
		       COALESCE(avatar_url, ''), created_at, updated_at
		FROM users WHERE id = $1
	`
	var u User
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Phone,
		&u.Role, &u.Status, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ============================================================
// Handler
// ============================================================

type Handler struct {
	repo      *Repository
	jwtCfg    *config.JWTConfig
	auditRepo *audit.Repository
}

func NewHandler(repo *Repository, jwtCfg *config.JWTConfig, auditRepo ...*audit.Repository) *Handler {
	h := &Handler{repo: repo, jwtCfg: jwtCfg}
	if len(auditRepo) > 0 {
		h.auditRepo = auditRepo[0]
	}
	return h
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/register", h.Register)
	r.Post("/login", h.Login)
	return r
}

// Register godoc
// @Summary      Register new user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        user  body  RegisterRequest  true  "Registration data"
// @Success      201  {object}  AuthResponse
// @Failure      400  {object}  map[string]string
// @Router       /api/v1/auth/register [post]
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	u := &User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FullName:     req.FullName,
		Phone:        req.Phone,
		Role:         RoleCustomer,
	}

	if err := h.repo.Create(r.Context(), u); err != nil {
		http.Error(w, `{"error":"email already registered"}`, http.StatusConflict)
		return
	}

	token, expiresAt, err := h.generateToken(u)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	if h.auditRepo != nil {
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:   &u.ID,
			Action:   audit.ActionCreate,
			Resource: "user",
			ResourceID: &u.ID,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User:      *u,
	})
}

// Login godoc
// @Summary      Authenticate user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        credentials  body  LoginRequest  true  "Login credentials"
// @Success      200  {object}  AuthResponse
// @Failure      401  {object}  map[string]string
// @Router       /api/v1/auth/login [post]
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	u, err := h.repo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		slog.Warn("login: user lookup failed", "email", req.Email, "err", err.Error())
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		slog.Warn("login: bcrypt compare failed", "email", req.Email)
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	if u.Status != "active" {
		http.Error(w, `{"error":"account is not active"}`, http.StatusForbidden)
		return
	}

	token, expiresAt, err := h.generateToken(u)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	if h.auditRepo != nil {
		audit.RecordAsync(h.auditRepo, r.Context(), audit.LogEntry{
			UserID:   &u.ID,
			Action:   audit.ActionLogin,
			Resource: "user",
			ResourceID: &u.ID,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User:      *u,
	})
}

func (h *Handler) generateToken(u *User) (string, int64, error) {
	expiresAt := time.Now().Add(time.Duration(h.jwtCfg.ExpirationHours) * time.Hour)

	claims := jwt.MapClaims{
		"sub":  u.ID.String(),
		"role": string(u.Role),
		"exp":  expiresAt.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.jwtCfg.Secret))
	if err != nil {
		return "", 0, err
	}
	return signed, expiresAt.Unix(), nil
}