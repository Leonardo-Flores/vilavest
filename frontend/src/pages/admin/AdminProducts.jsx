import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { productsAPI } from '../../services/api';
import { formatBRL } from '../../utils/format';

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    productsAPI
      .adminList({ search, limit: 100 })
      .then(({ data }) => setItems(data.data || data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onDelete = async (id) => {
    if (!confirm('Desativar este produto?')) return;
    await productsAPI.delete(id);
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-gray-500">{items.length} produto(s)</p>
        </div>
        <Link
          to="/admin/produtos/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800"
        >
          <Plus size={16} /> Novo produto
        </Link>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, SKU, marca…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Estoque</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                      {p.images?.[0]?.url ? (
                        <img
                          src={p.images[0].url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg opacity-40">
                          🛍️
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.brand && <p className="text-xs text-gray-500">{p.brand}</p>}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-gray-600 font-mono text-xs">{p.sku || '—'}</td>
                <td className="p-3 text-gray-600">{p.category_name || '—'}</td>
                <td className="p-3 font-medium">{formatBRL(p.price)}</td>
                <td className="p-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.stock_quantity <= (p.low_stock_at || 5)
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {p.stock_quantity ?? 0} un.
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      p.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Link
                    to={`/admin/produtos/${p.id}/editar`}
                    className="inline-flex p-2 rounded hover:bg-gray-100 text-gray-600"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="p-2 rounded hover:bg-red-50 text-red-600"
                    title="Desativar"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
