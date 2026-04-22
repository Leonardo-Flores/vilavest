import { useRef, useState } from 'react';
import { UploadCloud, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { uploadsAPI } from '../services/api';

/**
 * Single-image uploader (dropzone + preview).
 *
 * Props:
 *   value     — current image URL (string, optional)
 *   onChange  — (url: string | null) => void
 *   label     — optional label above the dropzone
 *   aspect    — tailwind aspect ratio utility (default: "aspect-square")
 */
export default function ImageUpload({
  value,
  onChange,
  label,
  aspect = 'aspect-square',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { data } = await uploadsAPI.image(file);
      onChange(data.url);
    } catch (err) {
      setError(err.response?.data?.error || 'Falha no upload');
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    upload(files[0]);
  };

  return (
    <div>
      {label && (
        <span className="block text-xs text-gray-600 mb-1">{label}</span>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative ${aspect} w-full rounded-xl border-2 border-dashed cursor-pointer transition overflow-hidden ${
          dragOver
            ? 'border-black bg-gray-50'
            : 'border-gray-200 hover:border-gray-400 bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {value ? (
          <>
            <img
              src={value}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-white text-red-600 shadow"
              title="Remover imagem"
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-500 p-4">
            {uploading ? (
              <>
                <Loader2 size={24} className="animate-spin mb-2" />
                <p className="text-sm">Enviando…</p>
              </>
            ) : (
              <>
                <UploadCloud size={24} className="mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  Clique para enviar
                </p>
                <p className="text-xs text-gray-500">
                  ou arraste uma imagem (jpg, png, webp, gif — até 8MB)
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

/**
 * Gallery-style multi-image uploader with reorder + primary flag.
 *
 * Props:
 *   value     — array of { url, alt_text, is_primary, sort_order }
 *   onChange  — (images) => void
 */
export function ImageGalleryUpload({ value = [], onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadMany = async (files) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const { data } = await uploadsAPI.image(file);
        uploaded.push({
          url: data.url,
          alt_text: '',
          is_primary: false,
          sort_order: 0,
        });
      }
      const next = [...value, ...uploaded].map((img, i) => ({
        ...img,
        sort_order: i,
        is_primary: i === 0 ? true : img.is_primary && i !== 0 ? false : img.is_primary,
      }));
      // Ensure exactly one primary (first one if none flagged)
      if (!next.some((i) => i.is_primary) && next.length > 0) {
        next[0].is_primary = true;
      }
      onChange(next);
    } catch (err) {
      setError(err.response?.data?.error || 'Falha no upload');
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (idx) => {
    const next = value
      .filter((_, i) => i !== idx)
      .map((img, i) => ({ ...img, sort_order: i }));
    if (next.length > 0 && !next.some((i) => i.is_primary)) {
      next[0].is_primary = true;
    }
    onChange(next);
  };

  const setPrimary = (idx) => {
    onChange(value.map((img, i) => ({ ...img, is_primary: i === idx })));
  };

  const setAlt = (idx, alt) => {
    const next = [...value];
    next[idx] = { ...next[idx], alt_text: alt };
    onChange(next);
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next.map((img, i) => ({ ...img, sort_order: i })));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Galeria de imagens</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-black disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UploadCloud size={14} />
          )}
          Adicionar imagens
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => {
            uploadMany(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {value.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-500">
          <ImageIcon size={24} className="mx-auto mb-2 opacity-60" />
          <p className="text-sm">Nenhuma imagem adicionada.</p>
          <p className="text-xs">Envie ao menos uma imagem para o produto.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {value.map((img, i) => (
            <li
              key={`${img.url}-${i}`}
              className={`relative rounded-xl overflow-hidden border bg-white ${
                img.is_primary ? 'border-black ring-2 ring-black/10' : 'border-gray-200'
              }`}
            >
              <div className="aspect-square bg-gray-50">
                <img
                  src={img.url}
                  alt={img.alt_text}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2 space-y-1.5">
                <input
                  value={img.alt_text || ''}
                  onChange={(e) => setAlt(i, e.target.value)}
                  placeholder="Alt text (acessibilidade)"
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                />
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setPrimary(i)}
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      img.is_primary
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {img.is_primary ? 'Principal' : 'Definir principal'}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Mover para cima"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === value.length - 1}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Remover"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
