import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, ImageOff } from 'lucide-react';
import { categoriesAPI } from '../../services/api';

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    categoriesAPI
      .list()
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id) => {
    if (!confirm('Remover esta categoria? Produtos associados ficarão sem categoria.'))
      return;
    try {
      await categoriesAPI.delete(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Falha ao remover categoria.');
    }
  };

  const filtered = items.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-gray-500">
            {items.length} categoria(s). Ajuste o nome, a ordem e a imagem que
            aparece na home.
          </p>
        </div>
        <Link
          to="/admin/categorias/nova"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800"
        >
          <Plus size={16} /> Nova categoria
        </Link>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou slug…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Categoria</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Ordem</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">
                  Nenhuma categoria encontrada.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageOff size={16} className="text-gray-400" />
                      )}
                    </div>
                    <p className="font-medium">{c.name}</p>
                  </div>
                </td>
                <td className="p-3 text-gray-600 font-mono text-xs">{c.slug}</td>
                <td className="p-3 text-gray-600">{c.sort_order}</td>
                <td className="p-3 text-right">
                  <Link
                    to={`/admin/categorias/${c.id}/editar`}
                    className="inline-flex p-2 rounded hover:bg-gray-100 text-gray-600"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="p-2 rounded hover:bg-red-50 text-red-600"
                    title="Remover"
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
