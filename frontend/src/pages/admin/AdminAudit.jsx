import { useEffect, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { auditAPI } from '../../services/api';
import { formatDateTime } from '../../utils/format';

export default function AdminAudit() {
  const [items, setItems] = useState([]);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    auditAPI
      .list({ entity, action, limit: 200 })
      .then(({ data }) => setItems(data.data || data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, action]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={22} /> Auditoria
          </h1>
          <p className="text-sm text-gray-500">
            Últimos eventos sensíveis registrados na plataforma.
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="Entidade (product, order, user…)"
          className="flex-1 max-w-xs px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Ação (create, update, delete…)"
          className="flex-1 max-w-xs px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Quando</th>
              <th className="p-3">Ator</th>
              <th className="p-3">Ação</th>
              <th className="p-3">Entidade</th>
              <th className="p-3">IP</th>
              <th className="p-3">Metadados</th>
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
                  Nenhum log encontrado com os filtros atuais.
                </td>
              </tr>
            )}
            {items.map((log) => (
              <tr key={log.id} className="align-top">
                <td className="p-3 text-gray-600 whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </td>
                <td className="p-3">
                  <p className="text-gray-900">
                    {log.actor_email || log.actor_id || '—'}
                  </p>
                </td>
                <td className="p-3">
                  <span className="text-xs font-semibold bg-gray-900 text-white px-2 py-0.5 rounded-full">
                    {log.action}
                  </span>
                </td>
                <td className="p-3 text-gray-600">
                  {log.entity}
                  {log.entity_id && (
                    <p className="text-xs text-gray-400 font-mono">
                      {log.entity_id.slice(0, 8)}…
                    </p>
                  )}
                </td>
                <td className="p-3 text-gray-600 font-mono text-xs">
                  {log.ip_address || '—'}
                </td>
                <td className="p-3">
                  {(log.metadata || log.new_values) ? (
                    <pre className="text-xs bg-gray-50 p-2 rounded max-w-sm overflow-auto max-h-24">
                      {JSON.stringify(log.metadata || log.new_values, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
