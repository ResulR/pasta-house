import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Order, OrderLine, OrderStatus } from '@/types';
import { adminFetch } from '@/lib/adminCsrf';

interface BackendAdminOrderItem {
  id: string;
  lineNumber: number;
  itemType: 'product' | 'beverage';
  productId: string | null;
  productVariantId: string | null;
  beverageId: string | null;
  productNameSnapshot: string | null;
  variantCodeSnapshot: string | null;
  variantNameSnapshot: string | null;
  beverageNameSnapshot: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  createdAt: string;
}

interface BackendAdminOrderStatusHistory {
  id: string;
  status: string;
  note: string | null;
  changedByAdminId: string | null;
  createdAt: string;
}

interface BackendAdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentMethod: 'delivery' | 'pickup';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddressLine1: string | null;
  deliveryPostalCode: string | null;
  deliveryCity: string | null;
  customerNote: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
  items: BackendAdminOrderItem[];
  statusHistory: BackendAdminOrderStatusHistory[];
}

interface BackendAdminOrdersResponse {
  ok: boolean;
  data?: {
    orders: BackendAdminOrder[];
  };
}

interface OrdersContextType {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  reloadOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  getOrder: (orderId: string) => Order | undefined;
  todayOrders: Order[];
  todayRevenue: number;
  weekRevenue: number;
  ordersByStatus: Record<OrderStatus, number>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

function mapBackendStatusToFrontend(status: string): OrderStatus {
  switch (status) {
    case 'pending':
    case 'awaiting_payment':
    case 'paid':
      return 'recue';
    case 'preparing':
      return 'en_preparation';
    case 'ready':
      return 'prete';
    case 'in_delivery':
      return 'en_livraison';
    case 'completed':
      return 'terminee';
    case 'cancelled':
    case 'payment_failed':
      return 'annulee';
    default:
      return 'recue';
  }
}

function mapBackendPaymentStatus(order: BackendAdminOrder): Order['paymentStatus'] {
  if (order.status === 'payment_failed') {
    return 'failed';
  }

  if (order.stripePaymentIntentId) {
    return 'paid';
  }

  return 'pending';
}

function mapFrontendStatusToBackend(status: OrderStatus): string {
  switch (status) {
    case 'en_preparation':
      return 'preparing';
    case 'prete':
      return 'ready';
    case 'en_livraison':
      return 'in_delivery';
    case 'terminee':
      return 'completed';
    case 'annulee':
      return 'cancelled';
    default:
      throw new Error('Statut non modifiable manuellement.');
  }
}

function mapBackendOrderToFrontend(order: BackendAdminOrder): Order {
  const productLines: OrderLine[] = [];
  let pendingBeverageName: string | undefined;

  for (const item of order.items) {
    if (item.itemType === 'beverage') {
      pendingBeverageName = item.beverageNameSnapshot || undefined;
      continue;
    }

    productLines.push({
      productId: item.productId || '',
      productName: item.productNameSnapshot || '',
      category:
        item.variantCodeSnapshot === 'ravier' || item.variantCodeSnapshot === 'assiette'
          ? 'pates'
          : 'paninis',
      variant: item.variantCodeSnapshot || '',
      beverageName: pendingBeverageName,
      quantity: item.quantity,
      unitPrice: item.unitPriceCents / 100,
      totalPrice: item.lineTotalCents / 100,
    });

    pendingBeverageName = undefined;
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: mapBackendStatusToFrontend(order.status),
    statusHistory: order.statusHistory.map((historyItem) => ({
      status: mapBackendStatusToFrontend(historyItem.status),
      at: historyItem.createdAt,
    })),
    mode: order.fulfillmentMethod === 'delivery' ? 'livraison' : 'retrait',
    lines: productLines,
    subtotal: order.subtotalCents / 100,
    deliveryFee: order.deliveryFeeCents / 100,
    total: order.totalCents / 100,
    customer: order.fulfillmentMethod === 'delivery'
      ? {
          nom: order.customerName,
          telephone: order.customerPhone,
          email: order.customerEmail,
          adresse: order.deliveryAddressLine1 || '',
          commune: order.deliveryCity || '',
          codePostal: order.deliveryPostalCode || '',
          instructions: order.customerNote || '',
        }
      : {
          nom: order.customerName,
          telephone: order.customerPhone,
          email: order.customerEmail,
          note: order.customerNote || '',
        },
    paymentStatus: mapBackendPaymentStatus(order),
    stripePaymentIntentId: order.stripePaymentIntentId || undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function getLocalDateKey(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getStartOfLocalDay(dateInput: string | Date): Date {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);

  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfLocalWeek(dateInput: string | Date): Date {
  const startOfDay = getStartOfLocalDay(dateInput);
  const day = startOfDay.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  return startOfWeek;
}

function isAdminOrdersNotificationRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login';
}

function playNewOrderSound() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = new AudioContextConstructor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.38);

    window.setTimeout(() => {
      audioContext.close().catch(() => {
        // no-op
      });
    }, 700);
  } catch (soundError) {
    console.warn('New order sound skipped:', soundError);
  }
}

function showNewOrderBrowserNotification(order: Order) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification('Nouvelle commande Pasta House', {
      body: `${order.orderNumber} · ${order.customer.nom} · ${order.mode === 'livraison' ? 'Livraison' : 'Retrait'}`,
      tag: `pasta-house-order-${order.id}`,
    });
  } catch (notificationError) {
    console.warn('New order notification skipped:', notificationError);
  }
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownPaidOrderIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOrdersOnceRef = useRef(false);

  const loadOrders = useCallback(async (options: { silent?: boolean } = {}) => {
    const silent = options.silent === true;

    if (!silent) {
      setIsLoading(true);
    }

    setError(null);

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch admin orders: ${response.status}`);
      }

      const json = (await response.json()) as BackendAdminOrdersResponse;

      if (!json.ok || !json.data?.orders) {
        throw new Error('Invalid admin orders response');
      }

      const nextOrders = json.data.orders.map(mapBackendOrderToFrontend);
      const nextPaidOrderIds = new Set(
        nextOrders
          .filter((order) => order.paymentStatus === 'paid')
          .map((order) => order.id)
      );

      if (hasLoadedOrdersOnceRef.current && isAdminOrdersNotificationRoute()) {
        const newPaidOrders = nextOrders.filter(
          (order) =>
            order.paymentStatus === 'paid' &&
            !knownPaidOrderIdsRef.current.has(order.id)
        );

        if (newPaidOrders.length > 0) {
          playNewOrderSound();

          for (const order of newPaidOrders) {
            showNewOrderBrowserNotification(order);
          }
        }
      }

      knownPaidOrderIdsRef.current = nextPaidOrderIds;
      hasLoadedOrdersOnceRef.current = true;
      setOrders(nextOrders);
    } catch (fetchError) {
      console.error('OrdersContext loadOrders error:', fetchError);

      if (!silent) {
        setOrders([]);
      }

      setError('Impossible de charger les commandes.');
      throw fetchError;
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadOrders().catch(() => {
      // erreur déjà gérée dans loadOrders
    });
  }, [loadOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const requestNotificationPermission = () => {
      if (!isAdminOrdersNotificationRoute()) {
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {
          // no-op
        });
      }
    };

    window.addEventListener('click', requestNotificationPermission);
    window.addEventListener('keydown', requestNotificationPermission);

    return () => {
      window.removeEventListener('click', requestNotificationPermission);
      window.removeEventListener('keydown', requestNotificationPermission);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!isAdminOrdersNotificationRoute()) {
        return;
      }

      loadOrders({ silent: true }).catch(() => {
        // erreur déjà gérée dans loadOrders
      });
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const currentOrder = orders.find((order) => order.id === orderId);

    if (!currentOrder) {
      throw new Error("Commande introuvable.");
    }

    if (status === 'recue') {
      throw new Error('Le statut Reçue est géré automatiquement.');
    }

    const backendStatus = mapFrontendStatusToBackend(status);

    const response = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        status: backendStatus,
        note: '',
      }),
    });

    const json = await response.json();

    if (!response.ok || !json?.ok) {
      throw new Error(json?.message || 'Impossible de mettre à jour le statut.');
    }

    await loadOrders();
  }, [loadOrders, orders]);

  const getOrder = useCallback((orderId: string) => orders.find((order) => order.id === orderId), [orders]);

  const todayOrders = useMemo(() => {
    const todayKey = getLocalDateKey(new Date());

    return orders.filter((order) => getLocalDateKey(order.createdAt) === todayKey);
  }, [orders]);

  const todayRevenue = useMemo(
    () =>
      todayOrders
        .filter((order) => order.paymentStatus === 'paid' && order.status !== 'annulee')
        .reduce((sum, order) => sum + order.total, 0),
    [todayOrders]
  );

  const weekRevenue = useMemo(() => {
    const now = new Date();
    const startOfWeek = getStartOfLocalWeek(now);

    return orders
      .filter((order) => {
        if (order.paymentStatus !== 'paid' || order.status === 'annulee') {
          return false;
        }

        const orderDate = new Date(order.createdAt);
        return orderDate >= startOfWeek && orderDate <= now;
      })
      .reduce((sum, order) => sum + order.total, 0);
  }, [orders]);

  const ordersByStatus = useMemo(
    () =>
      orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<OrderStatus, number>),
    [orders]
  );

  return (
    <OrdersContext.Provider
      value={{
        orders,
        isLoading,
        error,
        reloadOrders: loadOrders,
        updateOrderStatus,
        getOrder,
        todayOrders,
        todayRevenue,
        weekRevenue,
        ordersByStatus,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);

  if (!context) {
    throw new Error('useOrders must be used within OrdersProvider');
  }

  return context;
}