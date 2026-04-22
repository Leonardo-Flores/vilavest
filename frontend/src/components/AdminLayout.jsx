import { NavLink, Outlet, Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingBag,
  Users,
  FileText,
  Truck,
  LogOut,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/categorias', label: 'Categorias', icon: Tag },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/envios', label: 'Envios', icon: Truck },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/audit', label: 'Auditoria', icon: FileText },
];

export default function AdminLayout() {
  const { isAdmin, isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-gray-500 mb-4">
            Você não tem permissão para acessar a área administrativa.
          </p>
          <Link to="/" className="text-sm underline text-black">
            Voltar para a loja
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-gray-900 text-gray-100 flex flex-col fixed inset-y-0 left-0">
        <div className="px-6 py-5 border-b border-white/10">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="VilaVest" className="h-full w-auto object-contain" />
            </div>
            <div>
              <p className="font-bold text-white leading-tight">VilaVest</p>
              <p className="text-[11px] text-gray-400 leading-tight">Administração</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-gray-400">Logado como</p>
            <p className="text-sm text-white truncate">{user?.full_name || user?.email}</p>
          </div>
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5"
          >
            <Store size={16} /> Ver loja
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-60">
        <Outlet />
      </main>
    </div>
  );
}
