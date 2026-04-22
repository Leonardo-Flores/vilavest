import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { metricsAPI } from '../../services/api';
import { formatBRL, formatDate } from '../../utils/format';

const RANGES = [
  { key: 7, label: '7 dias' },
  { key: 30, label: '30 dias' },
  { key: 90, label: '90 dias' },
];

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [chart, setChart] = useState([]);
  const [top, setTop] = useState([]);
  const [low, setLow] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      metricsAPI.summary(days).then((r) => r.data).catch(() => null),
      metricsAPI.salesChart(days).then((r) => r.data.data || r.data || []).catch(() => []),
      metricsAPI.topProducts(days, 5).then((r) => r.data.data || []).catch(() => []),
      metricsAPI.lowStock(10).then((r) => r.data.data || []).catch(() => []),
    ]).then(([s, c, t, l]) => {
      setSummary(s);
      setChart(
        (c || []).map((p) => ({ ...p, label: formatDate(p.date).slice(0, 5) }))
      );
      setTop(t);
      setLow(l);
      setLoading(false);
    });
  }, [days]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">Visão geral de vendas e operação.</p>
        </div>
        <div className="inline-flex border border-gray-200 rounded-full p-1 bg-white">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setDays(r.key)}
              className={`px-4 py-1.5 text-sm rounded-full ${
                days === r.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={<DollarSign size={18} />}
          label="Receita bruta"
          value={summary ? formatBRL(summary.gross_revenue) : '—'}
          hint={summary ? `líq. ${formatBRL(summary.net_revenue)}` : ''}
          loading={loading}
        />
        <Kpi
          icon={<ShoppingCart size={18} />}
          label="Pedidos"
          value={summary ? summary.orders_total : '—'}
          hint={
            summary
              ? `${summary.orders_paid} pagos · ${summary.orders_pending} pendentes`
              : ''
          }
          loading={loading}
        />
        <Kpi
          icon={<TrendingUp size={18} />}
          label="Ticket médio"
          value={summary ? formatBRL(summary.average_order) : '—'}
          hint={summary ? `${summary.new_customers} novos clientes` : ''}
          loading={loading}
        />
        <Kpi
          icon={<Package size={18} />}
          label="Produtos ativos"
          value={summary ? summary.products_active : '—'}
          hint={
            summary && summary.low_stock_count > 0
              ? `${summary.low_stock_count} com estoque baixo`
              : 'Estoque saudável'
          }
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="font-bold mb-3">Vendas no período</h2>
        <div className="h-72">
          {chart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Sem dados no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(v, name) =>
                    name === 'Receita' ? formatBRL(v) : v
                  }
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Receita"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  name="Pedidos"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Produtos mais vendidos</h2>
            <Link to="/admin/produtos" className="text-xs underline text-gray-600">
              Ver todos
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="text-sm text-gray-500">Sem vendas ainda neste período.</p>
          ) : (
            <ul className="space-y-2">
              {top.map((p, i) => (
                <li key={p.product_id || i} className="flex items-center gap-3 py-1">
                  <span className="w-6 text-xs text-gray-400">#{i + 1}</span>
                  <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                    {p.image ? (
                      <img src={p.image} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg opacity-40">
                        🛍️
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.total_sold} vendidos</p>
                  </div>
                  <span className="text-sm font-bold">{formatBRL(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Estoque baixo
            </h2>
            <Link to="/admin/produtos" className="text-xs underline text-gray-600">
              Gerenciar
            </Link>
          </div>
          {low.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum produto abaixo do limite mínimo.
            </p>
          ) : (
            <ul className="space-y-2">
              {low.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-1 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.product_name}</p>
                    <p className="text-xs text-gray-500">
                      SKU {s.sku || '—'} · limite {s.low_stock_at || 5}
                    </p>
                  </div>
                  <span className="ml-3 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    {s.quantity} un.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint, loading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
        <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
          {icon}
        </span>
      </div>
      {loading ? (
        <div className="h-7 bg-gray-100 animate-pulse rounded w-24" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
