import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Clock, Truck, Store, XCircle, ChefHat, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';

interface OrderTrackingResponse {
  ok: boolean;
  data?: {
    orderNumber: string;
    status: string;
    fulfillmentMethod: 'delivery' | 'pickup';
    paidAt: string | null;
    paymentConfirmed: boolean;
    createdAt: string;
    updatedAt: string;
    statusHistory: Array<{ status: string; createdAt: string }>;
  };
  message?: string;
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  awaiting_payment: 'En attente de paiement',
  paid: 'Paiement confirmé',
  preparing: 'En préparation',
  ready: 'Prête',
  in_delivery: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
  payment_failed: 'Paiement échoué',
};

function getStatusDescription(status: string, m: 'delivery' | 'pickup') {
  switch (status) {
    case 'awaiting_payment': return 'Votre commande est créée, le paiement n’est pas encore confirmé.';
    case 'paid': return 'Votre paiement est confirmé. Préparation imminente.';
    case 'preparing': return 'Votre commande est en cours de préparation en cuisine.';
    case 'ready': return m === 'pickup' ? 'Votre commande est prête à être récupérée.' : 'Votre commande est prête à partir.';
    case 'in_delivery': return 'Votre commande est en route.';
    case 'completed': return 'Votre commande est terminée. Bon appétit !';
    case 'cancelled': return 'Votre commande a été annulée.';
    case 'payment_failed': return 'Le paiement de votre commande a échoué.';
    default: return 'Le statut a été mis à jour.';
  }
}

const formatDateTime = (v: string) =>
  new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));

const TIMELINE_DELIVERY = ['paid', 'preparing', 'ready', 'in_delivery', 'completed'] as const;
const TIMELINE_PICKUP = ['paid', 'preparing', 'ready', 'completed'] as const;

const STATUS_ICONS: Record<string, typeof Check> = {
  paid: CreditCard, preparing: ChefHat, ready: Check, in_delivery: Truck, completed: Check,
};

export default function OrderTrackingPage() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState<OrderTrackingResponse['data'] | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!token) {
        if (!mounted) return;
        setError('Lien de suivi invalide.'); setLoading(false); return;
      }
      try {
        const response = await fetch(`/api/public/orders/tracking/${encodeURIComponent(token)}`, {
          method: 'GET', headers: { Accept: 'application/json' },
        });
        const json = (await response.json()) as OrderTrackingResponse;
        if (!response.ok || !json.ok || !json.data) throw new Error(json.message || 'Impossible de charger le suivi.');
        if (!mounted) return;
        setOrderData(json.data);
      } catch (err) {
        console.error('Tracking fetch error:', err);
        if (!mounted) return;
        setError('Impossible de charger le suivi de votre commande.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => { mounted = false; };
  }, [token]);

  const currentStatusLabel = useMemo(() => orderData ? (STATUS_LABELS[orderData.status] || orderData.status) : '', [orderData]);
  const currentStatusDescription = useMemo(() => orderData ? getStatusDescription(orderData.status, orderData.fulfillmentMethod) : '', [orderData]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="container max-w-lg py-24 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
          <h1 className="h-display mt-6 text-3xl">Suivi de commande</h1>
          <p className="mt-2 text-muted-foreground">Chargement…</p>
        </div>
      </ClientLayout>
    );
  }

  if (error || !orderData) {
    return (
      <ClientLayout>
        <div className="container max-w-lg py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <XCircle className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <h1 className="h-display mt-6 text-3xl text-foreground">Suivi indisponible</h1>
          <p className="mt-2 text-muted-foreground">{error || 'Commande introuvable.'}</p>
          <Button asChild className="mt-8"><Link to="/">Retour à l'accueil</Link></Button>
        </div>
      </ClientLayout>
    );
  }

  const timeline = orderData.fulfillmentMethod === 'pickup' ? TIMELINE_PICKUP : TIMELINE_DELIVERY;
  const isCancelled = orderData.status === 'cancelled' || orderData.status === 'payment_failed';

  const currentIdx = (() => {
    const idx = timeline.findIndex((step) => step === orderData.status);
    return idx;
  })();

  return (
    <ClientLayout>
      <div className="container max-w-2xl py-12 md:py-16">
        <div className="reveal">
          <p className="eyebrow">Suivi en direct</p>
          <h1 className="h-display mt-2 text-4xl md:text-5xl text-foreground">
            Votre commande
            <br />
            <span className="h-display-italic text-primary">{orderData.orderNumber}</span>
          </h1>
        </div>

        <div className="mt-8 card-elevated p-6 reveal reveal-delay-1">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              isCancelled ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary ring-1 ring-primary/20'
            }`}>
              {isCancelled ? <XCircle className="h-5 w-5" strokeWidth={1.7} /> :
                orderData.status === 'in_delivery' ? <Truck className="h-5 w-5" strokeWidth={1.7} /> :
                orderData.status === 'ready' && orderData.fulfillmentMethod === 'pickup' ? <Store className="h-5 w-5" strokeWidth={1.7} /> :
                orderData.status === 'completed' ? <Check className="h-5 w-5" strokeWidth={2} /> :
                orderData.status === 'preparing' ? <ChefHat className="h-5 w-5" strokeWidth={1.7} /> :
                <Clock className="h-5 w-5" strokeWidth={1.7} />}
            </div>
            <div className="flex-1">
              <p className="eyebrow">Statut actuel</p>
              <p className="h-display mt-1 text-2xl text-foreground">{currentStatusLabel}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{currentStatusDescription}</p>
            </div>
          </div>
        </div>

        {!isCancelled && (
          <div className="mt-8 card-elevated p-6 reveal reveal-delay-2">
            <p className="eyebrow">Progression</p>
            <ol className="mt-5 space-y-1">
              {timeline.map((step, i) => {
                const reached = currentIdx >= i;
                const isCurrent = currentIdx === i;
                const Icon = STATUS_ICONS[step] || Check;
                return (
                  <li key={step} className="relative flex items-start gap-4 py-2.5">
                    {i < timeline.length - 1 && (
                      <span
                        className={`absolute left-[15px] top-[34px] h-[calc(100%-12px)] w-px transition-colors duration-500 ${
                          currentIdx > i ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-400 ease-out-soft ${
                        reached
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground'
                      } ${isCurrent ? 'ring-4 ring-primary/15' : ''}`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <div className="flex-1 pt-1">
                      <p className={`text-sm font-medium ${reached ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {STATUS_LABELS[step]}
                      </p>
                      {isCurrent && (
                        <p className="mt-0.5 text-[0.78rem] text-primary">En cours</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-8 card-elevated divide-y divide-border/60 p-0 reveal reveal-delay-2">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[0.82rem] text-muted-foreground">Mode</span>
            <span className="text-sm font-medium text-foreground">
              {orderData.fulfillmentMethod === 'pickup' ? 'Retrait sur place' : 'Livraison'}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[0.82rem] text-muted-foreground">Commande créée</span>
            <span className="text-sm text-foreground">{formatDateTime(orderData.createdAt)}</span>
          </div>
          {orderData.paidAt && (
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-[0.82rem] text-muted-foreground">Paiement confirmé</span>
              <span className="text-sm text-foreground">{formatDateTime(orderData.paidAt)}</span>
            </div>
          )}
        </div>

        {orderData.statusHistory.length > 0 && (
          <div className="mt-8 reveal reveal-delay-3">
            <p className="eyebrow">Historique</p>
            <ul className="mt-3 space-y-px overflow-hidden rounded-[var(--radius)] border border-border bg-card">
              {orderData.statusHistory.map((entry, i) => (
                <li
                  key={`${entry.status}-${entry.createdAt}-${i}`}
                  className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm font-medium text-foreground">
                    {STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <span className="text-[0.78rem] text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" className="bg-card border-border"><Link to="/">Retour à l'accueil</Link></Button>
        </div>
      </div>
    </ClientLayout>
  );
}