import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, ShoppingBag } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ordersAPI } from '../../services/api';
import {
  formatBRL,
  formatDateTime,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from '../../utils/format';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersAPI
      .list()
      .then(({ data }) => setOrders(data.data || data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-8 w-full flex-1">
        <h1 className="text-2xl font-bold mb-6">Meus pedidos</h1>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">Você ainda não fez pedidos.</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800"
            >
              Começar a comprar
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/pedidos/${o.id}`}
                  className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:border-black transition"
                >
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package size={20} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{o.order_number}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          ORDER_STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ORDER_STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateTime(o.created_at)} · {o.items_count || o.items?.length || 0} itens
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatBRL(o.total)}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}
