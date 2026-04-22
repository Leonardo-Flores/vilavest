import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatBRL } from '../../utils/format';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const { isAuthenticated } = useAuth();
  const shipping = subtotal >= 399 || subtotal === 0 ? 0 : 19.9;
  const total = subtotal + shipping;

  const goCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
        <h1 className="text-2xl font-bold mb-6">Meu carrinho</h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">Seu carrinho está vazio.</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800"
            >
              Começar a comprar
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4"
                >
                  <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {it.product_image ? (
                      <img src={it.product_image} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">
                        🛍️
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/produto/${it.product_slug}`}
                      className="font-medium text-sm line-clamp-2 hover:text-black"
                    >
                      {it.product_name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBRL(it.unit_price)} un.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-gray-200 rounded-full">
                        <button
                          onClick={() => updateQuantity(it.id, it.quantity - 1)}
                          className="p-1.5 text-gray-600 hover:text-black"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-3 text-xs font-medium">{it.quantity}</span>
                        <button
                          onClick={() => updateQuantity(it.id, it.quantity + 1)}
                          className="p-1.5 text-gray-600 hover:text-black"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Remover
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">
                      {formatBRL(it.unit_price * it.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-100 p-6 sticky top-24">
                <h2 className="font-bold mb-4">Resumo</h2>
                <div className="space-y-2 text-sm mb-4">
                  <Row label="Subtotal" value={formatBRL(subtotal)} />
                  <Row
                    label="Frete"
                    value={shipping === 0 ? 'Grátis' : formatBRL(shipping)}
                    positive={shipping === 0 && subtotal > 0}
                  />
                </div>
                <div className="border-t border-gray-100 pt-4 mb-5">
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatBRL(total)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ou até 10x de {formatBRL(total / 10)} sem juros
                  </p>
                </div>
                <button
                  onClick={goCheckout}
                  className="w-full bg-black text-white font-medium py-3 rounded-full hover:bg-gray-800"
                >
                  Finalizar compra
                </button>
                <Link
                  to="/"
                  className="block text-center text-sm text-gray-600 mt-3 hover:text-black"
                >
                  Continuar comprando
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Row({ label, value, positive }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={positive ? 'text-green-600 font-medium' : 'text-gray-900'}>{value}</span>
    </div>
  );
}
