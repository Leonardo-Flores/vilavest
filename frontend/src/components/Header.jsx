import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Heart, LogOut, Menu, Search, ShoppingCart, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { notificationsAPI } from '../services/api';

/**
 * Header — shared storefront header with search, cart, notifications,
 * and a user menu that shows sign-in / account / admin link.
 */
export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { itemCount } = useCart();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await notificationsAPI.list({ unread: true, limit: 1 });
        if (!cancelled) setUnread(data.unread || 0);
      } catch (_) {}
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      {/* Top strip — discreto, uma linha só */}
      <div className="bg-neutral-900 text-neutral-300 text-[11px]">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <span className="tracking-wide">Frete grátis acima de R$399 · Troca fácil em 30 dias</span>
          <div className="hidden md:flex gap-5">
            <Link to="/rastreio" className="hover:text-white">
              Rastrear pedido
            </Link>
            <a href="mailto:suporte@vilavest.com.br" className="hover:text-white">
              Atendimento
            </a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 md:gap-5">
        <button
          className="md:hidden p-1 text-gray-700"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>

        <Link to="/" className="flex items-center gap-2 flex-shrink-0" aria-label="VilaVest">
          <img
            src="/logo.png"
            alt="VilaVest"
            className="h-9 md:h-10 w-auto select-none"
            draggable={false}
          />
          <span className="hidden sm:inline text-lg font-bold tracking-tight text-gray-900">
            VilaVest
          </span>
        </Link>

        <form onSubmit={onSearch} className="flex-1 max-w-2xl">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtos, marcas, categorias…"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-transparent rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white focus:border-gray-200"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1">
          {isAuthenticated && (
            <Link
              to="/notificacoes"
              className="relative p-2 text-gray-700 hover:text-black"
              aria-label="Notificações"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          )}

          <Link
            to="/carrinho"
            className="relative p-2 text-gray-700 hover:text-black"
            aria-label="Carrinho"
          >
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="p-2 text-gray-700 hover:text-black flex items-center gap-1"
              aria-label="Conta"
            >
              <User size={20} />
            </button>
            {userMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-lg shadow-lg py-2 z-50"
                onMouseLeave={() => setUserMenu(false)}
              >
                {isAuthenticated ? (
                  <>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <Link to="/conta" className="block px-4 py-2 text-sm hover:bg-gray-50">
                      Minha conta
                    </Link>
                    <Link to="/pedidos" className="block px-4 py-2 text-sm hover:bg-gray-50">
                      Meus pedidos
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" className="block px-4 py-2 text-sm hover:bg-gray-50">
                        Painel admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        logout();
                        navigate('/');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <LogOut size={14} /> Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="block px-4 py-2 text-sm hover:bg-gray-50 font-medium"
                    >
                      Entrar
                    </Link>
                    <Link to="/registro" className="block px-4 py-2 text-sm hover:bg-gray-50">
                      Criar conta
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 w-72 h-full bg-white shadow-xl p-4">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">Menu</span>
              <button onClick={() => setMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <nav className="flex flex-col gap-3">
              <Link to="/" onClick={() => setMenuOpen(false)} className="py-2">
                Início
              </Link>
              <Link to="/carrinho" onClick={() => setMenuOpen(false)} className="py-2">
                Carrinho
              </Link>
              <Link to="/pedidos" onClick={() => setMenuOpen(false)} className="py-2">
                Meus pedidos
              </Link>
              <Link to="/rastreio" onClick={() => setMenuOpen(false)} className="py-2">
                Rastrear pedido
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="py-2">
                  Admin
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
