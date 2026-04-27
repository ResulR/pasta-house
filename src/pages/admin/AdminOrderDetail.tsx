import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrders } from '@/contexts/OrdersContext';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { ORDER_STATUS_LABELS, ORDER_STATUS_FLOW, PAYMENT_STATUS_LABELS } from '@/types';
import type { OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { getOrder, updateOrderStatus, isLoading, error } = useOrders();
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);

  const order = getOrder(id || '');

  const handleStatusChange = async (status: OrderStatus) => {
    try {
      setActionError(null);
      setSavingStatus(status);
      await updateOrderStatus(order!.id, status);
    } catch (err) {
      console.error('Admin order detail update status error:', err);
      setActionError(err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.');
    } finally {
      setSavingStatus(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-xl font-bold">Commande</h2>
        <p className="mt-6 text-sm text-muted-foreground">Chargement de la commande...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-xl font-bold">Commande</h2>
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
        <Link to="/admin/commandes" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Retour
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">Commande introuvable.</p>
        <Link to="/admin/commandes" className="text-primary text-sm hover:underline">← Retour</Link>
      </div>
    );
  }

  const isDelivery = order.mode === 'livraison';
  const availableStatuses: OrderStatus[] = isDelivery
    ? [...ORDER_STATUS_FLOW, 'annulee']
    : ORDER_STATUS_FLOW.filter((status) => status !== 'en_livraison').concat('annulee');

  return (
    <div className="max-w-2xl">
      <Link to="/admin/commandes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString('fr-BE')}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-6 card-premium p-4">
        <h3 className="text-sm font-semibold mb-3">Changer le statut</h3>

        {actionError && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{actionError}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {availableStatuses
            .filter((status) => status !== 'recue')
            .map((status) => (
              <Button
                key={status}
                size="sm"
                variant={order.status === status ? 'default' : 'outline'}
                onClick={() => handleStatusChange(status)}
                disabled={order.status === status || savingStatus !== null}
              >
                {savingStatus === status ? 'Enregistrement...' : ORDER_STATUS_LABELS[status]}
              </Button>
            ))}
        </div>
      </div>

      <div className="mt-6 card-premium p-4">
        <h3 className="text-sm font-semibold mb-3">Articles commandés</h3>
        <div className="space-y-2">
          {order.lines.map((line, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {line.quantity}× {line.productName}
                <span className="text-muted-foreground ml-1">
                  ({SIZE_LABELS[line.variant] || line.variant}
                  {line.beverageName && ` + ${line.beverageName}`})
                </span>
              </span>
              <span className="font-medium">{formatPrice(line.totalPrice)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sous-total</span><span>{formatPrice(order.subtotal)}</span></div>
            {isDelivery && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Livraison</span><span>{formatPrice(order.deliveryFee)}</span></div>}
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{formatPrice(order.total)}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-6 card-premium p-4">
        <h3 className="text-sm font-semibold mb-3">Client</h3>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Nom</span><span>{order.customer.nom}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Téléphone</span><span>{order.customer.telephone}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{order.customer.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{isDelivery ? '🛵 Livraison' : '🏠 Retrait'}</span></div>
          {isDelivery && 'adresse' in order.customer && 'commune' in order.customer && 'codePostal' in order.customer && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adresse</span>
                <span>{order.customer.adresse}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commune</span>
                <span>{order.customer.commune} {order.customer.codePostal}</span>
              </div>
              {'instructions' in order.customer && order.customer.instructions && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instructions</span>
                  <span>{order.customer.instructions}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paiement</span>
            <span
              className={`font-medium ${
                order.paymentStatus === 'paid'
                  ? 'text-emerald-700'
                  : order.paymentStatus === 'failed'
                    ? 'text-destructive'
                    : order.paymentStatus === 'cancelled'
                      ? 'text-muted-foreground'
                      : 'text-amber-700'
              }`}
            >
              {order.paymentStatus === 'paid' ? '✅ ' : ''}
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 card-premium p-4">
        <h3 className="text-sm font-semibold mb-3">Historique</h3>
        <div className="space-y-1.5">
          {order.statusHistory.map((h, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{new Date(h.at).toLocaleString('fr-BE')}</span>
              <span className="font-medium">{ORDER_STATUS_LABELS[h.status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}