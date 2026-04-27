import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { CartItem, OrderMode, CartItemPanini } from '@/types';
import { fetchPublicMenu } from '@/lib/menu-api';

interface CartContextType {
  items: CartItem[];
  mode: OrderMode;
  setMode: (mode: OrderMode) => void;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  meetsMinimum: boolean;
  minimumOrder: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const FALLBACK_DELIVERY_FEE = 5;
const FALLBACK_MINIMUM_ORDER = 15;
const CART_ITEMS_STORAGE_KEY = 'pasta-house-cart-items';
const CART_MODE_STORAGE_KEY = 'pasta-house-cart-mode';

function isOrderMode(value: unknown): value is OrderMode {
  return value === 'livraison' || value === 'retrait';
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_ITEMS_STORAGE_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed as CartItem[] : [];
    } catch (error) {
      console.error('Failed to restore cart items from localStorage:', error);
      return [];
    }
  });

  const [mode, setMode] = useState<OrderMode>(() => {
    try {
      const raw = localStorage.getItem(CART_MODE_STORAGE_KEY);

      return isOrderMode(raw) ? raw : 'livraison';
    } catch (error) {
      console.error('Failed to restore cart mode from localStorage:', error);
      return 'livraison';
    }
  });
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(FALLBACK_DELIVERY_FEE);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(FALLBACK_MINIMUM_ORDER);

  useEffect(() => {
    let isMounted = true;

    async function loadDeliverySettings() {
      try {
        const data = await fetchPublicMenu();
        const settings = data.deliverySettings;

        if (!isMounted || !settings) return;

        setDeliveryFeeAmount(settings.deliveryFeeCents / 100);
        setMinimumOrderAmount(settings.minimumOrderCents / 100);
      } catch (error) {
        console.error('Failed to load delivery settings in CartContext:', error);
      }
    }

    void loadDeliverySettings();

    return () => {
      isMounted = false;
    };
  }, []);

    useEffect(() => {
    try {
      localStorage.setItem(CART_ITEMS_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to persist cart items to localStorage:', error);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_MODE_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to persist cart mode to localStorage:', error);
    }
  }, [mode]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((existing) => {
        if (existing.productId !== item.productId) return false;
        if (existing.type === 'pates' && item.type === 'pates') {
          return existing.size === item.size;
        }
        if (existing.type === 'paninis' && item.type === 'paninis') {
          return existing.formula === item.formula && existing.beverageId === (item as CartItemPanini).beverageId;
        }
        return false;
      });

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }

      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity } : item)));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);

    try {
      localStorage.removeItem(CART_ITEMS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear cart items from localStorage:', error);
    }
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = mode === 'livraison' ? deliveryFeeAmount : 0;
  const total = subtotal + deliveryFee;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const minimumOrder = minimumOrderAmount;
  const meetsMinimum = mode === 'retrait' || subtotal >= minimumOrder;

  return (
    <CartContext.Provider
      value={{
        items,
        mode,
        setMode,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        deliveryFee,
        total,
        itemCount,
        meetsMinimum,
        minimumOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}