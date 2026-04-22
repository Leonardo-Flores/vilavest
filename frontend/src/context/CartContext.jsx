import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const LS_KEY = 'vilavest_guest_cart';
const loadGuest = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { items: [] };
  } catch {
    return { items: [] };
  }
};
const saveGuest = (cart) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cart));
  } catch {
    /* noop */
  }
};

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(() => loadGuest());
  const [loading, setLoading] = useState(false);

  // Quando o usuário autentica, puxamos o carrinho do servidor
  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(loadGuest());
      return;
    }
    setLoading(true);
    try {
      const { data } = await cartAPI.get();
      setCart(data || { items: [] });
    } catch {
      setCart({ items: [] });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (product, variant, quantity = 1) => {
      if (isAuthenticated) {
        const { data } = await cartAPI.addItem(
          product.id,
          variant?.id ?? null,
          quantity,
        );
        setCart(data || cart);
        return;
      }
      // Guest cart: localStorage
      setCart((prev) => {
        const key = variant?.id || product.id;
        const existing = prev.items.find((i) => i.id === key);
        let items;
        if (existing) {
          items = prev.items.map((i) =>
            i.id === key ? { ...i, quantity: i.quantity + quantity } : i,
          );
        } else {
          items = [
            ...prev.items,
            {
              id: key,
              product_id: product.id,
              variant_id: variant?.id ?? null,
              name: product.name,
              price: product.price,
              image_url: product.images?.[0]?.url || '',
              quantity,
            },
          ];
        }
        const next = { ...prev, items };
        saveGuest(next);
        return next;
      });
    },
    [isAuthenticated, cart],
  );

  const updateItem = useCallback(
    async (itemId, quantity) => {
      if (isAuthenticated) {
        const { data } = await cartAPI.updateItem(itemId, quantity);
        setCart(data || cart);
        return;
      }
      setCart((prev) => {
        const items = prev.items
          .map((i) => (i.id === itemId ? { ...i, quantity } : i))
          .filter((i) => i.quantity > 0);
        const next = { ...prev, items };
        saveGuest(next);
        return next;
      });
    },
    [isAuthenticated, cart],
  );

  const removeItem = useCallback(
    async (itemId) => {
      if (isAuthenticated) {
        await cartAPI.removeItem(itemId);
        await refresh();
        return;
      }
      setCart((prev) => {
        const items = prev.items.filter((i) => i.id !== itemId);
        const next = { ...prev, items };
        saveGuest(next);
        return next;
      });
    },
    [isAuthenticated, refresh],
  );

  const clear = useCallback(async () => {
    if (isAuthenticated) {
      await cartAPI.clear();
      setCart({ items: [] });
      return;
    }
    setCart({ items: [] });
    saveGuest({ items: [] });
  }, [isAuthenticated]);

  const totals = useMemo(() => {
    const items = cart?.items || [];
    const count = items.reduce((s, i) => s + (i.quantity || 0), 0);
    const subtotal = items.reduce(
      (s, i) => s + Number(i.price || 0) * (i.quantity || 0),
      0,
    );
    return { count, subtotal };
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        items: cart?.items || [],
        loading,
        totals,
        // aliases consumed pelas páginas
        itemCount: totals.count,
        subtotal: totals.subtotal,
        refresh,
        addItem,
        updateItem,
        updateQuantity: updateItem,
        removeItem,
        clear,
        clearCart: clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
