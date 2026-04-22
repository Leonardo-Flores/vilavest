// Package upload provides multipart file upload for images.
//
// Uploaded files are stored on the local filesystem under `cfg.Uploads.Dir`
// (default: /app/uploads) and are served back to clients through the
// static handler mounted at /uploads/*.
//
// The package deliberately keeps the scope minimal: single-file uploads,
// images only, size-capped. Authorization is handled by the router stack
// (JWT + admin/manager role) so the handler itself can focus on I/O.
package upload

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Accepted MIME types — extended can be added here; stay strict on purpose.
var allowedMIME = map[string]string{
	"image/jpeg": ".jpg",
	"image/jpg":  ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// MaxFileSize caps uploads at 8 MiB.
const MaxFileSize = 8 << 20

// Handler exposes the upload HTTP handler.
type Handler struct {
	dir       string // absolute path where files are stored
	publicURL string // URL prefix that maps to dir (e.g. "/uploads")
}

// NewHandler returns a new upload handler. The directory is created if missing.
func NewHandler(dir, publicURL string) (*Handler, error) {
	if dir == "" {
		dir = "/app/uploads"
	}
	if publicURL == "" {
		publicURL = "/uploads"
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("upload: create dir %q: %w", dir, err)
	}
	return &Handler{dir: dir, publicURL: strings.TrimRight(publicURL, "/")}, nil
}

// Routes registers the upload POST route. Intended to be mounted under
// /api/v1/admin/uploads.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.Upload)
	return r
}

type uploadResponse struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	MIME     string `json:"mime"`
}

// Upload godoc
// @Summary      Upload image (admin)
// @Tags         uploads
// @Accept       multipart/form-data
// @Produce      json
// @Param        file  formData  file  true  "Image file (jpg, png, webp, gif, max 8MB)"
// @Success      201  {object}  uploadResponse
// @Failure      400  {object}  map[string]string
// @Failure      413  {object}  map[string]string
// @Router       /api/v1/admin/uploads [post]
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	// Cap request body; ParseMultipartForm enforces it when reading the form.
	r.Body = http.MaxBytesReader(w, r.Body, MaxFileSize+1024)

	if err := r.ParseMultipartForm(MaxFileSize); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			writeJSONError(w, http.StatusRequestEntityTooLarge,
				"arquivo maior que o permitido (limite: 8MB)")
			return
		}
		writeJSONError(w, http.StatusBadRequest, "formulário inválido: "+err.Error())
		return
	}

	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSONError(w, http.StatusBadRequest,
			"campo 'file' obrigatório (multipart/form-data)")
		return
	}
	defer file.Close()

	// Sniff the first 512 bytes to detect content type — trust this over the
	// client-supplied Content-Type header.
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	head = head[:n]
	mime := http.DetectContentType(head)

	ext, ok := allowedMIME[mime]
	if !ok {
		writeJSONError(w, http.StatusBadRequest,
			"tipo de arquivo não suportado (aceitos: jpg, png, webp, gif)")
		return
	}

	// Build a safe unique filename.
	name := fmt.Sprintf("%s-%s%s",
		time.Now().UTC().Format("20060102"),
		uuid.New().String()[:8],
		ext,
	)
	dst := filepath.Join(h.dir, name)

	out, err := os.Create(dst)
	if err != nil {
		slog.Error("upload: create file", "path", dst, "err", err)
		writeJSONError(w, http.StatusInternalServerError, "falha ao salvar arquivo")
		return
	}
	defer out.Close()

	// Write the sniffed bytes first, then stream the rest.
	if _, err := out.Write(head); err != nil {
		_ = os.Remove(dst)
		writeJSONError(w, http.StatusInternalServerError, "falha ao gravar arquivo")
		return
	}
	written, err := io.Copy(out, file)
	if err != nil {
		_ = os.Remove(dst)
		writeJSONError(w, http.StatusInternalServerError, "falha ao gravar arquivo")
		return
	}
	totalSize := int64(len(head)) + written

	// Hint for the original filename — used in audit log if we want later.
	_ = hdr

	resp := uploadResponse{
		URL:      h.publicURL + "/" + name,
		Filename: name,
		Size:     totalSize,
		MIME:     mime,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

// StaticHandler returns an http.Handler that serves files from the upload
// directory. Mount it at /uploads/ (with trailing slash) via StripPrefix.
func (h *Handler) StaticHandler() http.Handler {
	fs := http.FileServer(http.Dir(h.dir))
	return http.StripPrefix(h.publicURL, fs)
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
