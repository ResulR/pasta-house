import { Link, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useOrders } from '@/contexts/OrdersContext';
import { formatPrice } from '@/config/menu';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types';

export default function AdminOrdersBoard() {
  const { orders } = useOrders();
  const [searchParams] = useSearchParams();

  const statusFilter = searchParams.get('status');
  const paymentFilter = searchParams.get('payment');
  const modeFilter = searchParams.get('mode');

  const filteredOrders = useMemo(() => {
    return [...orders]
      .filter((order) => {
        if (statusFilter && order.status !== statusFilter) {
          return false;
        }

        if (paymentFilter && order.paymentStatus !== paymentFilter) {
          return false;
        }

        if (modeFilter && order.mode !== modeFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, paymentFilter, modeFilter]);

  const pageTitle = statusFilter
    ? `Commandes — ${ORDER_STATUS_LABELS[statusFilter as keyof typeof ORDER_STATUS_LABELS] || statusFilter}`
    : paymentFilter
      ? `Commandes — ${PAYMENT_STATUS_LABELS[paymentFilter as keyof typeof PAYMENT_STATUS_LABELS] || paymentFilter}`
      : modeFilter
        ? `Commandes — ${modeFilter === 'livraison' ? 'Livraison' : 'Retrait'}`
        : 'Commandes';

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{pageTitle}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
          </p>
        </div>

        <Link to="/admin/commandes" className="text-sm text-primary hover:underline">
          Voir la table →
        </Link>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="mt-6 card-premium p-6 text-center text-sm text-muted-foreground">
          Aucune commande ne correspond à ce filtre.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="card-premium p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-primary">{order.orderNumber}</div>
                  <div className="mt-1 text-sm font-semibold">{order.customer.nom}</div>
                  <div className="text-xs text-muted-foreground">{order.customer.telephone}</div>
                </div>

                <span className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleTimeString('fr-BE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    order.mode === 'livraison'
                      ? 'bg-olive/15 text-olive'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {order.mode === 'livraison' ? '🛵 Livraison' : '🏠 Retrait'}
                </span>

                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>

                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    order.paymentStatus === 'paid'
                      ? 'bg-emerald-500/10 text-emerald-700'
                      : order.paymentStatus === 'failed'
                        ? 'bg-destructive/10 text-destructive'
                        : order.paymentStatus === 'cancelled'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-amber-500/10 text-amber-700'
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Articles</span>
                  <span>{order.lines.reduce((sum, line) => sum + line.quantity, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{formatPrice(order.total)}</span>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <Link to={`/admin/commandes/${order.id}`} className="text-sm text-primary hover:underline">
                  Voir le détail →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}