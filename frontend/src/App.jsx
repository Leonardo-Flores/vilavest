import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';

// Storefront
import HomePage from './pages/storefront/HomePage';
import ProductDetailPage from './pages/storefront/ProductDetailPage';
import CartPage from './pages/storefront/CartPage';
import CheckoutPage from './pages/storefront/CheckoutPage';
import OrdersPage from './pages/storefront/OrdersPage';
import OrderDetailPage from './pages/storefront/OrderDetailPage';
import TrackingPage from './pages/storefront/TrackingPage';
import AccountPage from './pages/storefront/AccountPage';
import NotificationsPage from './pages/storefront/NotificationsPage';

// Auth
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCategoryForm from './pages/admin/AdminCategoryForm';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Storefront público */}
            <Route path="/" element={<HomePage />} />
            <Route path="/produto/:slug" element={<ProductDetailPage />} />
            <Route path="/carrinho" element={<CartPage />} />
            <Route path="/rastreio" element={<TrackingPage />} />
            <Route path="/rastreio/:code" element={<TrackingPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />

            {/* Área do cliente (autenticado) */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pedidos"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pedidos/:id"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conta"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notificacoes"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />

              {/* Produtos */}
              <Route path="produtos" element={<AdminProducts />} />
              <Route path="produtos/novo" element={<AdminProductForm />} />
              <Route path="produtos/:id/editar" element={<AdminProductForm />} />

              {/* Categorias */}
              <Route path="categorias" element={<AdminCategories />} />
              <Route path="categorias/nova" element={<AdminCategoryForm />} />
              <Route path="categorias/:id/editar" element={<AdminCategoryForm />} />

              {/* Pedidos */}
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="pedidos/:id" element={<AdminOrderDetail />} />

              <Route path="envios" element={<AdminOrders />} />
              <Route path="usuarios" element={<AdminUsers />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
