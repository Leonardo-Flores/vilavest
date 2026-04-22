import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye } from 'lucide-react';
import { ordersAPI } from '../../services/api';
import {
  formatBRL,
  formatDateTime,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from '../../utils/format';

const STATUSES = Object.keys(ORDER_STATUS_LABEL);

export default function AdminOrders() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    ordersAPI
      .listAll({ search, status, limit: 100 })
      .then(({ data }) => setItems(data.data || data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-gray-500">{items.length} pedidos</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">Todos os status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Pedido</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Data</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50/50">
                <td className="p-3 font-medium">{o.order_number}</td>
                <td className="p-3">
                  <p className="truncate max-w-[200px]">
                    {o.customer_name || '—'}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">
                    {o.customer_email}
                  </p>
                </td>
                <td className="p-3 text-gray-600">{formatDateTime(o.created_at)}</td>
                <td className="p-3 font-medium">{formatBRL(o.total)}</td>
                <td className="p-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ORDER_STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ORDER_STATUS_LABEL[o.status] || o.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Link
                    to={`/admin/pedidos/${o.id}`}
                    className="inline-flex p-2 rounded hover:bg-gray-100 text-gray-600"
                    title="Ver detalhes"
                  >
                    <Eye size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
