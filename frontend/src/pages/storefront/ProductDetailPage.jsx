import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ShoppingCart, Truck } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { productsAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { formatBRL } from '../../utils/format';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLoading(true);
    productsAPI
      .getBySlug(slug)
      .then(({ data }) => setProduct(data))
      .catch(() => setError('Produto não encontrado.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const onAdd = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await addItem(product, null, qty);
    } catch (e) {
      alert('Faça login para adicionar ao carrinho.');
    } finally {
      setAdding(false);
    }
  };

  const onBuyNow = async () => {
    await onAdd();
    navigate('/carrinho');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-100 rounded animate-pulse w-2/3" />
            <div className="h-6 bg-gray-100 rounded animate-pulse w-1/3" />
            <div className="h-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/" className="text-black underline">Voltar ao catálogo</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;
  const images = product.images?.length ? product.images : [{ url: '' }];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-black inline-flex items-center gap-1 mb-6"
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden mb-3">
              {images[activeImage]?.url ? (
                <img
                  src={images[activeImage].url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <span className="text-8xl opacity-30">🛍️</span>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.id || i}
                    onClick={() => setActiveImage(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 ${
                      i === activeImage ? 'border-black' : 'border-transparent'
                    }`}
                  >
                    {img.url ? (
                      <img src={img.url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-gray-100" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.brand && (
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                {product.brand}
              </p>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>

            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-3xl font-bold">{formatBRL(product.price)}</span>
              {product.compare_at_price && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    {formatBRL(product.compare_at_price)}
                  </span>
                  <span className="text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                    -{discount}%
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-6">
              ou em até 10x de {formatBRL(product.price / 10)} sem juros
            </p>

            {product.description && (
              <p className="text-gray-700 whitespace-pre-line mb-6 leading-relaxed">
                {product.description}
              </p>
            )}

            <div className="mb-4 flex items-center gap-4">
              <span className="text-sm text-gray-600">Quantidade</span>
              <div className="flex items-center border border-gray-200 rounded-full">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="p-2 text-gray-600 hover:text-black"
                >
                  <Minus size={14} />
                </button>
                <span className="px-4 text-sm font-medium">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="p-2 text-gray-600 hover:text-black"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {product.stock_quantity > 0
                  ? `${product.stock_quantity} em estoque`
                  : 'Indisponível'}
              </span>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={onAdd}
                disabled={adding || product.stock_quantity === 0}
                className="flex-1 bg-white border-2 border-black text-black font-medium py-3 rounded-full flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              >
                <ShoppingCart size={18} />
                Adicionar ao carrinho
              </button>
              <button
                onClick={onBuyNow}
                disabled={adding || product.stock_quantity === 0}
                className="flex-1 bg-black text-white font-medium py-3 rounded-full hover:bg-gray-800 disabled:opacity-50"
              >
                Comprar agora
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl flex items-start gap-3">
              <Truck className="text-gray-700 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-medium">Frete e entrega</p>
                <p className="text-gray-600">
                  Frete grátis em compras acima de R$399. Entrega estimada em até 5 dias úteis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
