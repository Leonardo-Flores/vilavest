import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

/**
 * VilaVest API Client
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: attach JWT ────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vilavest_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: handle auth errors globally ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthCall = error.config?.url?.includes('/auth/');
      if (!isAuthCall) {
        localStorage.removeItem('vilavest_token');
        localStorage.removeItem('vilavest_user');
        if (!['/login', '/registro'].includes(window.location.pathname)) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// Auth API
// ============================================================
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/me'),
  updateProfile: (data) => api.patch('/me', data),
  addresses: () => api.get('/me/addresses'),
  addAddress: (data) => api.post('/me/addresses', data),
  deleteAddress: (id) => api.delete(`/me/addresses/${id}`),
};

// ============================================================
// Products API
// ============================================================
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  getBySlug: (slug) => api.get(`/products/${slug}`),

  // Admin
  adminList: (params) => api.get('/admin/products', { params }),
  getById: (id) => api.get(`/admin/products/${id}`),
  create: (data) => api.post('/admin/products', data),
  update: (id, data) => api.put(`/admin/products/${id}`, data),
  delete: (id) => api.delete(`/admin/products/${id}`),
  updateStock: (id, data) => api.patch(`/admin/products/${id}/stock`, data),
};

// ============================================================
// Categories API
// ============================================================
export const categoriesAPI = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/admin/categories', data),
  update: (id, data) => api.put(`/admin/categories/${id}`, data),
  delete: (id) => api.delete(`/admin/categories/${id}`),
};

// ============================================================
// Cart API
// ============================================================
export const cartAPI = {
  get: () => api.get('/cart'),
  addItem: (product_id, variant_id, quantity) =>
    api.post('/cart/items', { product_id, variant_id, quantity }),
  updateItem: (itemId, quantity) =>
    api.patch(`/cart/items/${itemId}`, { quantity }),
  removeItem: (itemId) => api.delete(`/cart/items/${itemId}`),
  clear: () => api.delete('/cart'),
};

// ============================================================
// Orders API
// ============================================================
export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  list: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),

  // Admin
  updateStatus: (id, status) =>
    api.patch(`/admin/orders/${id}/status`, { status }),
  listAll: (params) => api.get('/admin/orders', { params }),
  adminGet: (id) => api.get(`/admin/orders/${id}`),
};

// ============================================================
// Logistics API
// ============================================================
export const logisticsAPI = {
  getShipmentForOrder: (orderId) => api.get(`/shipments/by-order/${orderId}`),
  trackByCode: (code) => api.get(`/tracking/${code}`),

  // Admin
  adminGet: (id) => api.get(`/admin/shipments/${id}`),
  addEvent: (id, data) => api.post(`/admin/shipments/${id}/events`, data),
};

// ============================================================
// Notifications API
// ============================================================
export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

// ============================================================
// Users API (admin)
// ============================================================
export const usersAPI = {
  list: (params) => api.get('/admin/users', { params }),
  get: (id) => api.get(`/admin/users/${id}`),
  updateStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }),
};

// ============================================================
// Metrics API (admin dashboard)
// ============================================================
export const metricsAPI = {
  summary: (days = 30) =>
    api.get('/admin/metrics/summary', { params: { days } }),
  salesChart: (days = 30) =>
    api.get('/admin/metrics/sales-chart', { params: { days } }),
  topProducts: (days = 30, limit = 5) =>
    api.get('/admin/metrics/top-products', { params: { days, limit } }),
  lowStock: (limit = 10) =>
    api.get('/admin/metrics/low-stock', { params: { limit } }),
};

// ============================================================
// Audit API (admin)
// ============================================================
export const auditAPI = {
  list: (params) => api.get('/admin/audit', { params }),
};