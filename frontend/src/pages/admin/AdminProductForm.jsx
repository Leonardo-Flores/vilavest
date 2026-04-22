import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../../services/api';
import { ImageGalleryUpload } from '../../components/ImageUpload';

const EMPTY = {
  name: '',
  description: '',
  brand: '',
  sku: '',
  price: '',
  compare_at_price: '',
  cost: '',
  category_id: '',
  is_active: true,
  is_featured: false,
  stock_quantity: 0,
  low_stock_at: 5,
  images: [],
};

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState(EMPTY);
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
    productsAPI
      .getById(id)
      .then(({ data }) => {
        setForm({
          name: data.name || '',
          description: data.description || '',
          brand: data.brand || '',
          sku: data.sku || '',
          price: data.price ?? '',
          compare_at_price: data.compare_at_price ?? '',
          cost: data.cost ?? '',
          category_id: data.category_id || '',
          is_active: data.is_active ?? true,
          is_featured: data.is_featured ?? false,
          stock_quantity: data.stock_quantity ?? 0,
          low_stock_at: data.low_stock_at ?? 5,
          images:
            (data.images || []).map((i, idx) => ({
              url: i.url,
              alt_text: i.alt_text || '',
              is_primary: !!i.is_primary,
              sort_order: i.sort_order ?? idx,
            })) || [],
        });
      })
      .catch(() => setError('Produto não encontrado.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        cost: form.cost ? Number(form.cost) : null,
        stock_quantity: Number(form.stock_quantity),
        low_stock_at: Number(form.low_stock_at),
        category_id: form.category_id || null,
        images: form.images
          .filter((i) => i.url)
          .map((i, idx) => ({
            url: i.url,
            alt_text: i.alt_text || '',
            is_primary: !!i.is_primary,
            sort_order: idx,
          })),
      };
      if (isNew) {
        const { data } = await productsAPI.create(payload);
        navigate(`/admin/produtos/${data.id}/editar`, { replace: true });
      } else {
        await productsAPI.update(id, payload);
        navigate('/admin/produtos');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Carregando produto…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          to="/admin/produtos"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black mb-3"
        >
          <ArrowLeft size={14} /> Voltar para produtos
        </Link>
        <h1 className="text-2xl font-bold">
          {isNew ? 'Novo produto' : 'Editar produto'}
        </h1>
        <p className="text-sm text-gray-500">
          {isNew
            ? 'Cadastre um novo produto no catálogo.'
            : 'Atualize as informações do produto.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold">Informações básicas</h2>

              <F label="Nome do produto" required>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                  className={INPUT}
                  placeholder="Ex: Camisa Linho Branco Slim"
                />
              </F>

              <div className="grid grid-cols-2 gap-4">
                <F label="Marca">
                  <input
                    value={form.brand}
                    onChange={(e) => set('brand', e.target.value)}
                    className={INPUT}
                  />
                </F>
                <F label="SKU">
                  <input
                    value={form.sku}
                    onChange={(e) => set('sku', e.target.value)}
                    className={INPUT}
                  />
                </F>
              </div>

              <F label="Descrição">
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={5}
                  className={INPUT}
                  placeholder="Descreva o produto, tecidos, caimento, ocasião…"
                />
              </F>
            </section>

            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <ImageGalleryUpload
                value={form.images}
                onChange={(imgs) => set('images', imgs)}
              />
            </section>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold">Organização</h2>
              <F label="Categoria">
                <select
                  value={form.category_id || ''}
                  onChange={(e) => set('category_id', e.target.value)}
                  className={INPUT}
                >
                  <option value="">— sem categoria —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </F>

              <div className="space-y-2 pt-2">
                <Toggle
                  label="Produto ativo"
                  hint="Visível na loja"
                  checked={form.is_active}
                  onChange={(v) => set('is_active', v)}
                />
                <Toggle
                  label="Destacar na home"
                  hint="Aparece em 'Mais desejados'"
                  checked={form.is_featured}
                  onChange={(v) => set('is_featured', v)}
                />
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold">Preço</h2>
              <F label="Preço (R$)" required>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  required
                  className={INPUT}
                />
              </F>
              <F label="Preço de comparação (R$)" hint="Riscado na vitrine">
                <input
                  type="number"
                  step="0.01"
                  value={form.compare_at_price}
                  onChange={(e) => set('compare_at_price', e.target.value)}
                  className={INPUT}
                />
              </F>
              <F label="Custo (R$)" hint="Interno — para margem">
                <input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => set('cost', e.target.value)}
                  className={INPUT}
                />
              </F>
            </section>

            <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold">Estoque</h2>
              <F label="Quantidade em estoque">
                <input
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => set('stock_quantity', e.target.value)}
                  className={INPUT}
                />
              </F>
              <F label="Alerta de estoque baixo">
                <input
                  type="number"
                  value={form.low_stock_at}
                  onChange={(e) => set('low_stock_at', e.target.value)}
                  className={INPUT}
                />
              </F>
            </section>
          </div>
        </div>

        {/* Action bar (sticky bottom) */}
        <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-6 -mx-8 px-8">
          <div className="flex justify-end gap-2 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <Link
              to="/admin/produtos"
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
              {saving ? 'Salvando…' : isNew ? 'Criar produto' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const INPUT =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black';

function F({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-gray-400 font-normal ml-1">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          checked ? 'bg-black' : 'bg-gray-300'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}
