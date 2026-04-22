import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { categoriesAPI } from '../../services/api';
import ImageUpload from '../../components/ImageUpload';

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function AdminCategoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState({
    name: '',
    slug: '',
    parent_id: '',
    image_url: '',
    sort_order: 0,
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    categoriesAPI
      .list()
      .then(({ data }) => setCategories(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    categoriesAPI
      .list()
      .then(({ data }) => {
        const all = data.data || [];
        const found = all.find((c) => c.id === id);
        if (!found) {
          setError('Categoria não encontrada.');
          return;
        }
        setForm({
          name: found.name || '',
          slug: found.slug || '',
          parent_id: found.parent_id || '',
          image_url: found.image_url || '',
          sort_order: found.sort_order ?? 0,
        });
        setSlugTouched(true);
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Auto-slugify while user hasn't manually edited slug
  useEffect(() => {
    if (!slugTouched && form.name) {
      setForm((f) => ({ ...f, slug: slugify(f.name) }));
    }
  }, [form.name, slugTouched]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        parent_id: form.parent_id || null,
        image_url: form.image_url || '',
        sort_order: Number(form.sort_order) || 0,
      };
      if (isNew) {
        await categoriesAPI.create(payload);
      } else {
        await categoriesAPI.update(id, payload);
      }
      navigate('/admin/categorias');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/admin/categorias"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black mb-3"
        >
          <ArrowLeft size={14} /> Voltar para categorias
        </Link>
        <h1 className="text-2xl font-bold">
          {isNew ? 'Nova categoria' : 'Editar categoria'}
        </h1>
        <p className="text-sm text-gray-500">
          A imagem definida aqui é a que aparece na home, nos cards de categorias.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <F label="Nome" required>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                className={INPUT}
                placeholder="Ex: Masculino, Feminino, Acessórios…"
              />
            </F>

            <F label="Slug (URL amigável)" required>
              <input
                value={form.slug}
                onChange={(e) => {
                  set('slug', e.target.value);
                  setSlugTouched(true);
                }}
                required
                className={INPUT + ' font-mono'}
                placeholder="masculino"
              />
            </F>

            <div className="grid grid-cols-2 gap-4">
              <F label="Categoria pai (opcional)">
                <select
                  value={form.parent_id || ''}
                  onChange={(e) => set('parent_id', e.target.value)}
                  className={INPUT}
                >
                  <option value="">— nenhuma —</option>
                  {categories
                    .filter((c) => c.id !== id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </F>
              <F label="Ordem de exibição">
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => set('sort_order', e.target.value)}
                  className={INPUT}
                />
              </F>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <ImageUpload
              label="Imagem da categoria (aparece na home)"
              value={form.image_url}
              onChange={(url) => set('image_url', url || '')}
              aspect="aspect-[3/4]"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-6 -mx-8 px-8">
          <div className="flex justify-end gap-2 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <Link
              to="/admin/categorias"
              className="px-4 py-2 text-sm border border-gray-200 rounded-full hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Salvando…' : isNew ? 'Criar categoria' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const INPUT =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black';

function F({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
