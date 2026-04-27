import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '@/contexts/OrdersContext';
import { formatPrice } from '@/config/menu';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types';
import { ShoppingBag, Euro, TrendingUp, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const { orders, todayOrders, todayRevenue, weekRevenue, ordersByStatus } = useOrders();

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
    { label: 'Commandes du jour', value: todayOrders.length, icon: ShoppingBag },
    { label: "CA aujourd'hui", value: formatPrice(todayRevenue), icon: Euro },
    { label: 'CA semaine', value: formatPrice(weekRevenue), icon: TrendingUp },
    { label: 'En cours', value: (ordersByStatus.recue || 0) + (ordersByStatus.en_preparation || 0), icon: Clock },
  ];

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Dashboard</h2>

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