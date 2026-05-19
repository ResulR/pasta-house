import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Clock, Truck, Store, XCircle, ChefHat, CreditCard } from 'lucide-react';
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
    case 'awaiting_payment': return "Votre commande est créée, le paiement n’est pas encore confirmé.";
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
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-primary" />
          <h1 className="h-display mt-6 text-3xl text-foreground">Suivi de commande</h1>
          <p className="mt-2 text-ink-3">Chargement…</p>
        </div>
      </ClientLayout>
    );
  }

  if (error || !orderData) {
    return (
      <ClientLayout>
        <div className="container max-w-lg py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream2 text-ink-3">
            <XCircle className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <h1 className="h-display mt-6 text-3xl text-foreground">Suivi indisponible</h1>
          <p className="mt-2 text-ink-3">{error || 'Commande introuvable.'}</p>
          <Link
            to="/"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground transition-colors hover:bg-sugo-dark"
          >
            Retour à l&apos;accueil
          </Link>
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

        {/* ── Header ── */}
        <div className="reveal">
          <p className="eyebrow">Suivi en direct</p>
          <h1 className="h-display mt-2 text-4xl md:text-5xl text-foreground">
            Commande{' '}
            <span className="italic-serif text-primary">{orderData.orderNumber}</span>
          </h1>
        </div>

        {/* ── Current status card ── */}
        <div className="mt-8 rounded-[var(--radius)] border border-line bg-card p-6 reveal reveal-delay-1">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              isCancelled
                ? 'bg-destructive/10 text-destructive'
                : 'bg-sugo-soft text-primary ring-1 ring-primary/20'
            }`}>
              {isCancelled
                ? <XCircle className="h-5 w-5" strokeWidth={1.7} />
                : orderData.status === 'in_delivery'
                  ? <Truck className="h-5 w-5" strokeWidth={1.7} />
                  : orderData.status === 'ready' && orderData.fulfillmentMethod === 'pickup'
                    ? <Store className="h-5 w-5" strokeWidth={1.7} />
                    : orderData.status === 'completed'
                      ? <Check className="h-5 w-5" strokeWidth={2} />
                      : orderData.status === 'preparing'
                        ? <ChefHat className="h-5 w-5" strokeWidth={1.7} />
                        : <Clock className="h-5 w-5" strokeWidth={1.7} />}
            </div>
            <div className="flex-1">
              <p className="eyebrow">Statut actuel</p>
              <p className="font-display mt-1 text-2xl md:text-3xl text-foreground">{currentStatusLabel}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{currentStatusDescription}</p>
            </div>
          </div>
        </div>

        {/* ── Progress timeline ── */}
        {!isCancelled && (
          <div className="mt-8 rounded-[var(--radius)] border border-line bg-card p-6 reveal reveal-delay-2">
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
                          currentIdx > i ? 'bg-primary' : 'bg-line'
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-400 ease-out-soft ${
                        reached
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-line bg-card text-ink-3'
                      } ${isCurrent ? 'ring-4 ring-primary/15' : ''}`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <div className="flex-1 pt-1">
                      <p className={`text-sm font-medium ${reached ? 'text-ink' : 'text-ink-3'}`}>
                        {STATUS_LABELS[step]}
                      </p>
                      {isCurrent && (
                        <p className="mt-0.5 font-mono text-[0.78rem] text-primary">En cours</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* ── Info rows ── */}
        <div className="mt-8 rounded-[var(--radius)] border border-line bg-card divide-y divide-line/60 reveal reveal-delay-2">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-mono text-[0.78rem] text-ink-3">Mode</span>
            <span className="text-sm font-medium text-foreground">
              {orderData.fulfillmentMethod === 'pickup' ? 'Retrait sur place' : 'Livraison'}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-mono text-[0.78rem] text-ink-3">Commande créée</span>
            <span className="font-mono text-[0.82rem] text-foreground">{formatDateTime(orderData.createdAt)}</span>
          </div>
          {orderData.paidAt && (
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-mono text-[0.78rem] text-ink-3">Paiement confirmé</span>
              <span className="font-mono text-[0.82rem] text-foreground">{formatDateTime(orderData.paidAt)}</span>
            </div>
          )}
        </div>

        {/* ── Status history ── */}
        {orderData.statusHistory.length > 0 && (
          <div className="mt-8 reveal reveal-delay-3">
            <p className="eyebrow">Historique</p>
            <ul className="mt-3 overflow-hidden rounded-[var(--radius)] border border-line bg-card divide-y divide-line/60">
              {orderData.statusHistory.map((entry, i) => (
                <li
                  key={`${entry.status}-${entry.createdAt}-${i}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <span className="font-mono text-[0.78rem] text-ink-3">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Back button ── */}
        <div className="mt-10 flex justify-center">
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-full border border-line bg-card px-6 font-semibold text-foreground transition-colors hover:bg-cream2"
          >
            Retour à l&apos;accueil
          </Link>
        </div>

      </div>
    </ClientLayout>
  );
}
