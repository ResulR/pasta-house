import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '@/contexts/OrdersContext';
import { formatPrice } from '@/config/menu';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types';
import { ShoppingBag, Euro, TrendingUp, Clock, Trophy } from 'lucide-react';

interface AdminStatsResponse {
  ok: boolean;
  data?: {
    ordersToday: number;
    ordersThisWeek: number;
    revenueTodayCents: number;
    revenueThisWeekCents: number;
    topItemsThisWeek: Array<{
      productName: string;
      variantName: string;
      quantitySold: number;
      revenueCents: number;
    }>;
  };
}

export default function AdminDashboard() {
  const { orders, todayOrders, todayRevenue, weekRevenue, ordersByStatus } = useOrders();
  const [statsData, setStatsData] = useState<AdminStatsResponse['data'] | null>(null);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        const response = await fetch('/api/admin/stats', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });

        const json = (await response.json()) as AdminStatsResponse;

        if (!response.ok || !json.ok || !json.data) {
          throw new Error('Invalid admin stats response');
        }

        if (mounted) {
          setStatsData(json.data);
          setStatsError('');
        }
      } catch (error) {
        console.error('Admin stats load error:', error);
        if (mounted) {
          setStatsError('Impossible de charger les statistiques détaillées.');
        }
      }
    }

    void loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  const paymentCounts = useMemo(
    () =>
      orders.reduce(
        (acc, order) => {
          acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1;
          return acc;
        },
        {
          pending: 0,
          paid: 0,
          failed: 0,
          cancelled: 0,
        } as Record<'pending' | 'paid' | 'failed' | 'cancelled', number>
      ),
    [orders]
  );

  const todayPaidOrders = useMemo(
    () => todayOrders.filter((order) => order.paymentStatus === 'paid' && order.status !== 'annulee'),
    [todayOrders]
  );

  const todayPendingPaymentOrders = useMemo(
    () => todayOrders.filter((order) => order.paymentStatus === 'pending'),
    [todayOrders]
  );

  const todayCancelledOrders = useMemo(
    () => todayOrders.filter((order) => order.status === 'annulee'),
    [todayOrders]
  );

  const todayDeliveryOrders = useMemo(
    () => todayOrders.filter((order) => order.mode === 'livraison'),
    [todayOrders]
  );

  const todayPickupOrders = useMemo(
    () => todayOrders.filter((order) => order.mode === 'retrait'),
    [todayOrders]
  );

  const todayAverageBasket = useMemo(() => {
    if (todayPaidOrders.length === 0) {
      return 0;
    }

    const total = todayPaidOrders.reduce((sum, order) => sum + order.total, 0);
    return total / todayPaidOrders.length;
  }, [todayPaidOrders]);

  const stats = [
    {
      label: 'Commandes du jour',
      value: statsData ? statsData.ordersToday : todayOrders.length,
      icon: ShoppingBag,
    },
    {
      label: "CA aujourd'hui",
      value: statsData ? formatPrice(statsData.revenueTodayCents / 100) : formatPrice(todayRevenue),
      icon: Euro,
    },
    {
      label: 'Commandes semaine',
      value: statsData ? statsData.ordersThisWeek : orders.length,
      icon: Clock,
    },
    {
      label: 'CA semaine',
      value: statsData ? formatPrice(statsData.revenueThisWeekCents / 100) : formatPrice(weekRevenue),
      icon: TrendingUp,
    },
  ];

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Dashboard</h2>

      {statsError && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {statsError}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-premium p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card-premium p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">Top 5 articles — semaine</h3>
        </div>

        {!statsData ? (
          <p className="text-sm text-muted-foreground">Chargement des articles les plus vendus...</p>
        ) : statsData.topItemsThisWeek.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun article payé cette semaine.</p>
        ) : (
          <div className="space-y-2">
            {statsData.topItemsThisWeek.map((item, index) => (
              <div
                key={`${item.productName}-${item.variantName}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {index + 1}. {item.productName}
                    {item.variantName ? <span className="text-muted-foreground"> · {item.variantName}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantitySold} vendu{item.quantitySold > 1 ? 's' : ''}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatPrice(item.revenueCents / 100)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 card-premium p-4">
        <h3 className="font-display text-base font-semibold mb-3">Aujourd&apos;hui</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/commandes/vue?payment=paid"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">Commandes payées</span>
            <span className="font-semibold">{todayPaidOrders.length}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?payment=pending"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">En attente de paiement</span>
            <span className="font-semibold">{todayPendingPaymentOrders.length}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?status=annulee"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">Commandes annulées</span>
            <span className="font-semibold">{todayCancelledOrders.length}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?mode=livraison"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">Livraisons</span>
            <span className="font-semibold">{todayDeliveryOrders.length}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?mode=retrait"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">Retraits</span>
            <span className="font-semibold">{todayPickupOrders.length}</span>
          </Link>

          <div className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Panier moyen payé</span>
            <span className="font-semibold">{formatPrice(todayAverageBasket)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 card-premium p-4">
        <h3 className="font-display text-base font-semibold mb-3">Par paiement</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/commandes/vue?payment=pending"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">{PAYMENT_STATUS_LABELS.pending}</span>
            <span className="font-semibold">{paymentCounts.pending}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?payment=paid"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">{PAYMENT_STATUS_LABELS.paid}</span>
            <span className="font-semibold">{paymentCounts.paid}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?payment=failed"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">{PAYMENT_STATUS_LABELS.failed}</span>
            <span className="font-semibold">{paymentCounts.failed}</span>
          </Link>

          <Link
            to="/admin/commandes/vue?payment=cancelled"
            className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="text-muted-foreground">{PAYMENT_STATUS_LABELS.cancelled}</span>
            <span className="font-semibold">{paymentCounts.cancelled}</span>
          </Link>
        </div>
      </div>

      <div className="mt-8 card-premium p-4">
        <h3 className="font-display text-base font-semibold mb-3">Par statut</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
            <Link
              key={key}
              to={`/admin/commandes/vue?status=${encodeURIComponent(key)}`}
              className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">{ordersByStatus[key as keyof typeof ordersByStatus] || 0}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
