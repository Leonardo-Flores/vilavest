# ============================================================
# VilaVest Backend — Multi-stage Dockerfile
# Used by Fly.io (deploy), docker-compose (local), and CI.
# ============================================================

# --- Stage 1: Build ---
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Cache dependencies layer. go.sum is committed in normal projects;
# if missing (fresh clone), `go mod tidy` generates it before build.
COPY go.mod go.sum* ./
RUN go mod download || true

# Build the binary (static, stripped)
COPY . .
RUN go mod tidy \
 && CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-s -w" -o /bin/vilavest ./cmd/api

# --- Stage 2: Runtime ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -g '' appuser

COPY --from=builder /bin/vilavest /bin/vilavest

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/bin/vilavest"]
