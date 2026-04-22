import { useEffect, useState } from 'react';
import { Search, Shield, Ban, CheckCircle } from 'lucide-react';
import { usersAPI } from '../../services/api';
import { formatDateTime } from '../../utils/format';

const ROLE_LABEL = { admin: 'Administrador', manager: 'Gerente', customer: 'Cliente' };
const STATUS_LABEL = { active: 'Ativo', suspended: 'Suspenso', banned: 'Banido' };

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    usersAPI
      .list({ search, limit: 100 })
      .then(({ data }) => setItems(data.data || data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const setStatus = async (id, status) => {
    await usersAPI.setStatus(id, status);
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-gray-500">{items.length} cadastrados</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Usuário</th>
              <th className="p-3">Papel</th>
              <th className="p-3">Status</th>
              <th className="p-3">Criado em</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Sem usuários.
                </td>
              </tr>
            )}
            {items.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="p-3">
                  <p className="font-medium">{u.full_name || '—'}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </td>
                <td className="p-3">
                  <span className="text-xs inline-flex items-center gap-1">
                    {(u.role === 'admin' || u.role === 'manager') && (
                      <Shield size={12} className="text-gray-600" />
                    )}
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      u.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : u.status === 'suspended'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {STATUS_LABEL[u.status] || u.status}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{formatDateTime(u.created_at)}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    {u.status !== 'active' ? (
                      <button
                        onClick={() => setStatus(u.id, 'active')}
                        className="p-1.5 rounded hover:bg-green-50 text-green-700"
                        title="Ativar"
                      >
                        <CheckCircle size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(u.id, 'suspended')}
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-700"
                        title="Suspender"
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
