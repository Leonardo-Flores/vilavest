import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { notificationsAPI } from '../../services/api';
import { formatDateTime } from '../../utils/format';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notificationsAPI
      .list({ limit: 100 })
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markRead = async (id) => {
    await notificationsAPI.markAsRead(id);
    setItems((items) =>
      items.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
    );
  };

  const markAll = async () => {
    await notificationsAPI.markAllRead();
    setItems((items) => items.map((n) => ({ ...n, status: 'read' })));
  };

  const unread = items.filter((n) => n.status !== 'read').length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell size={22} /> Notificações
          </h1>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="text-sm px-3 py-1.5 rounded-full border border-gray-200 hover:border-black inline-flex items-center gap-1"
            >
              <CheckCheck size={14} /> Marcar todas como lidas
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Bell size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600">Nenhuma notificação por enquanto.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const isUnread = n.status !== 'read';
              const body = (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isUnread ? 'text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      {n.title}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 bg-black rounded-full" aria-hidden />
                    )}
                  </div>
                  {n.message && (
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(n.created_at)}
                  </p>
                </div>
              );
              return (
                <li
                  key={n.id}
                  className={`bg-white rounded-xl border p-4 flex gap-3 items-start ${
                    isUnread ? 'border-black/20' : 'border-gray-100'
                  }`}
                >
                  {n.link ? (
                    <Link
                      to={n.link}
                      className="flex-1 flex gap-3 items-start"
                      onClick={() => isUnread && markRead(n.id)}
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                  {isUnread && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-2 text-gray-400 hover:text-black"
                      title="Marcar como lida"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}
