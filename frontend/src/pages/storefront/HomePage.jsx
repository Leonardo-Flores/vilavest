import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  SlidersHorizontal,
  Truck,
  RefreshCw,
  ShieldCheck,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ProductCard from '../../components/ProductCard';
import { categoriesAPI, productsAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';

const SORTS = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome (A–Z)' },
];

export default function HomePage() {
  const [params, setParams] = useSearchParams();
  const { addItem } = useCart();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const q = params.get('q') || '';
  const sort = params.get('sort') || 'newest';
  const categoryId = params.get('category_id') || '';

  useEffect(() => {
    categoriesAPI.list().then(({ data }) => setCategories(data.data || [])).catch(() => {});
    productsAPI
      .list({ featured: true, limit: 8 })
      .then(({ data }) => setFeatured(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = { q, sort, limit: 24 };
    if (categoryId) query.category_id = categoryId;
    productsAPI
      .list(query)
      .then(({ data }) => {
        setProducts(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [q, sort, categoryId]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const handleAdd = async (product) => {
    try {
      await addItem(product, null, 1);
    } catch (e) {
      alert('Faça login para adicionar ao carrinho.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      {/* Hero */}
      {!q && !categoryId && (
        <>
          <section className="relative overflow-hidden bg-neutral-950 text-white">
            {/* Soft accent */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-48 -left-24 h-[520px] w-[520px] rounded-full bg-amber-500/15 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-rose-500/10 blur-3xl"
            />

            <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              {/* Copy */}
              <div className="relative z-10 max-w-xl">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold tracking-wider uppercase text-amber-300">
                  <Sparkles size={13} /> Coleção outono · 2026
                </span>

                <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-[1.02]">
                  Estilo que dura,
                  <br />
                  preço de <span className="text-amber-400">-40%</span>.
                </h1>

                <p className="mt-5 text-base md:text-lg text-white/70 max-w-lg">
                  Peças premium com curadoria VilaVest, entrega em 48h e troca
                  fácil em 30 dias. Comece bem o seu guarda-roupa novo.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/?sort=newest"
                    className="group inline-flex items-center gap-2 px-7 py-3.5 bg-amber-400 text-neutral-900 rounded-full text-sm font-bold hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20"
                  >
                    Comprar agora
                    <ChevronRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                  <Link
                    to="/?featured=true"
                    className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/5 border border-white/20 text-white rounded-full text-sm font-semibold hover:bg-white/10 transition-colors"
                  >
                    Ver destaques
                  </Link>
                </div>

                {/* Social proof */}
                <div className="mt-8 flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {[
                      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face',
                      'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=face',
                    ].map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-neutral-950 object-cover"
                      />
                    ))}
                  </div>
                  <div className="text-xs text-white/70 leading-tight">
                    <div className="flex items-center gap-1 text-amber-400 mb-0.5">
                      {'★★★★★'}{' '}
                      <span className="text-white/60 ml-1">4,9/5</span>
                    </div>
                    <span>
                      <span className="text-white font-semibold">+12.800</span>{' '}
                      clientes nesta semana
                    </span>
                  </div>
                </div>
              </div>

              {/* Single editorial image */}
              <div className="relative">
                <div className="relative aspect-[4/5] md:aspect-[5/6] rounded-3xl overflow-hidden shadow-2xl">
                  <img
                    src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80"
                    alt="Modelo vestindo a nova coleção VilaVest"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Discount chip top-left */}
                  <span className="absolute top-5 left-5 px-3 py-1.5 text-xs font-bold rounded-full bg-amber-400 text-neutral-900 shadow-lg">
                    -30% na coleção
                  </span>
                </div>

                {/* Floating product card bottom-left */}
                <div className="hidden sm:flex absolute -bottom-6 -left-4 md:-left-10 bg-white text-neutral-900 rounded-2xl shadow-2xl p-3 pr-5 items-center gap-3 w-64">
                  <img
                    src="https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=200&q=80"
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">
                      Mais vendido
                    </p>
                    <p className="text-sm font-semibold truncate">
                      Alfaiataria Wide Leg
                    </p>
                    <p className="text-sm font-bold text-amber-600">
                      R$ 299,90{' '}
                      <span className="text-[11px] text-gray-400 line-through font-normal ml-1">
                        R$ 389
                      </span>
                    </p>
                  </div>
                </div>

                {/* Floating review badge top-right */}
                <div className="hidden md:flex absolute -top-4 -right-4 bg-white text-neutral-900 rounded-full shadow-xl px-4 py-2 items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck size={16} className="text-green-600" />
                  </div>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold">Compra 100% segura</p>
                    <p className="text-gray-500 text-[11px]">SSL + antifraude</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Trust strip */}
          <section className="border-b border-gray-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  icon: Truck,
                  title: 'Frete grátis',
                  subtitle: 'Acima de R$399',
                },
                {
                  icon: RefreshCw,
                  title: 'Troca fácil',
                  subtitle: '30 dias, sem enrolação',
                },
                {
                  icon: CreditCard,
                  title: '12x sem juros',
                  subtitle: 'Em todo o site',
                },
                {
                  icon: ShieldCheck,
                  title: 'Compra segura',
                  subtitle: 'Dados protegidos',
                },
              ].map((b) => (
                <div key={b.title} className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl bg-gray-100 text-gray-900 flex items-center justify-center">
                    <b.icon size={18} />
                  </span>
                  <div className="text-sm leading-tight">
                    <p className="font-semibold text-gray-900">{b.title}</p>
                    <p className="text-xs text-gray-500">{b.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Categories */}
      {categories.length > 0 && !q && (
        <section className="max-w-7xl mx-auto px-4 pt-10 pb-6 w-full">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Compre por categoria</h2>
              <p className="text-sm text-gray-500">Explore as estações do guarda-roupa.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.slice(0, 6).map((c) => (
              <button
                key={c.id}
                onClick={() => updateParam('category_id', c.id)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 text-left"
              >
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="text-[10px] uppercase tracking-wider opacity-80">
                    Ver tudo
                  </p>
                  <p className="text-base font-semibold leading-tight">{c.name}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Featured strip */}
      {featured.length > 0 && !q && !categoryId && (
        <section className="max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Mais desejados</h2>
              <p className="text-sm text-gray-500">Os queridinhos da semana.</p>
            </div>
            <Link
              to="/?featured=true"
              className="text-sm text-gray-600 hover:text-black inline-flex items-center gap-1"
            >
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={handleAdd} />
            ))}
          </div>
        </section>
      )}

      {/* Main catalog */}
      <section className="max-w-7xl mx-auto px-4 py-6 w-full flex-1">
        <div className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {q ? `Busca: "${q}"` : 'Todos os produtos'}
            </h2>
            <p className="text-xs text-gray-500">{total} {total === 1 ? 'produto' : 'produtos'}</p>
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gray-500" />
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="text-sm border border-gray-200 rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {categoryId && (
              <button
                onClick={() => updateParam('category_id', null)}
                className="text-xs text-gray-600 underline"
              >
                Limpar categoria
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            Nenhum produto encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={handleAdd} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
