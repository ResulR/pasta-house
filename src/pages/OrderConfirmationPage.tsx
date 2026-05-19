import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, Mail, MapPin, Phone, Clock, AlertCircle } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import { useCart } from '@/contexts/CartContext';
import { fetchPublicMenu } from '@/lib/menu-api';

const CHECKOUT_FORM_STORAGE_KEY = 'pasta-house-checkout-form';
const LAST_TRACKED_ORDER_STORAGE_KEY = 'pasta-house-last-tracked-order';

interface OrderConfirmationResponse {
  ok: boolean;
  data?: {
    orderNumber: string;
    status: string;
    fulfillmentMethod: 'delivery' | 'pickup';
    paidAt: string | null;
    stripePaymentIntentId: string | null;
    paymentConfirmed: boolean;
    createdAt: string;
    trackingToken: string;
  };
  message?: string;
  error?: string;
}

export default function OrderConfirmationPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const orderNumber = params.get('orderNumber') || '';
  const { clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup' | ''>('');
  const [trackingToken, setTrackingToken] = useState('');
  const [estimatedDeliveryTimeMin, setEstimatedDeliveryTimeMin] = useState(30);
  const [estimatedPickupTimeMin, setEstimatedPickupTimeMin] = useState(15);
  const [rushModeEnabled, setRushModeEnabled] = useState(false);

  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('Bruxelles');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchPublicMenu();
        if (!mounted) return;
        if (data.siteSettings?.restaurantName) setRestaurantName(data.siteSettings.restaurantName);
        const parts = [data.siteSettings?.addressLine1, data.siteSettings?.postalCode, data.siteSettings?.city].filter(Boolean);
        if (parts.length) setAddressLine(parts.join(', '));
        if (data.siteSettings?.phone) setPhone(data.siteSettings.phone);
        if (data.siteSettings?.email) setEmail(data.siteSettings.email);
        if (typeof data.deliverySettings?.estimatedDeliveryTimeMin === 'number') setEstimatedDeliveryTimeMin(data.deliverySettings.estimatedDeliveryTimeMin);
        if (typeof data.deliverySettings?.estimatedPickupTimeMin === 'number') setEstimatedPickupTimeMin(data.deliverySettings.estimatedPickupTimeMin);
        if (typeof data.deliverySettings?.rushModeEnabled === 'boolean') setRushModeEnabled(data.deliverySettings.rushModeEnabled);
      } catch (e) { console.error(e); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!sessionId || !orderNumber) {
        if (!mounted) return;
        setError('Confirmation de paiement introuvable.');
        setLoading(false);
        return;
      }
      const maxAttempts = 10;
      const retryDelayMs = 2000;
      const lastErrorMessage = "Le paiement n’a pas encore pu être confirmé. Vérifiez dans quelques instants ou contactez-nous.";

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(
            `/api/public/orders/confirmation?session_id=${encodeURIComponent(sessionId)}&orderNumber=${encodeURIComponent(orderNumber)}`,
            { method: 'GET', headers: { Accept: 'application/json' } },
          );
          const json = (await response.json()) as OrderConfirmationResponse;
          if (!response.ok || !json.ok || !json.data) throw new Error(json.message || 'Impossible de vérifier la commande.');
          if (!json.data.paymentConfirmed) throw new Error('Le paiement n’est pas encore confirmé.');
          if (!mounted) return;

          setError('');
          setConfirmedOrderNumber(json.data.orderNumber);
          setFulfillmentMethod(json.data.fulfillmentMethod);
          setTrackingToken(json.data.trackingToken);
          clearCart();
          try {
            localStorage.removeItem(CHECKOUT_FORM_STORAGE_KEY);
            localStorage.setItem(LAST_TRACKED_ORDER_STORAGE_KEY, JSON.stringify({
              orderNumber: json.data.orderNumber,
              trackingToken: json.data.trackingToken,
              savedAt: new Date().toISOString(),
            }));
          } catch (e) { console.error(e); }
          setLoading(false);
          return;
        } catch (err) {
          console.error(`Confirmation attempt ${attempt}/${maxAttempts}`, err);
          if (attempt === maxAttempts) break;
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
      if (!mounted) return;
      setError(lastErrorMessage);
      setLoading(false);
    };
    void run();
    return () => { mounted = false; };
  }, [sessionId, orderNumber, clearCart]);

  const phoneHref = useMemo(() => phone ? `tel:${phone.replace(/\s+/g, '')}` : '', [phone]);
  const emailHref = useMemo(() => email ? `mailto:${email}` : '', [email]);

  const estimatedTimeLabel = useMemo(() => {
    if (fulfillmentMethod === 'pickup') return `Retrait possible en environ ${estimatedPickupTimeMin} min`;
    if (fulfillmentMethod === 'delivery') return `Livraison estimée en environ ${estimatedDeliveryTimeMin} min`;
    return '';
  }, [fulfillmentMethod, estimatedDeliveryTimeMin, estimatedPickupTimeMin]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="container max-w-lg py-24 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-primary" />
          <h1 className="h-display mt-6 text-3xl text-foreground">Vérification du paiement</h1>
          <p className="mt-2 text-ink-3">Nous confirmons votre commande…</p>
        </div>
      </ClientLayout>
    );
  }

  if (error) {
    return (
      <ClientLayout>
        <div className="container max-w-lg py-20 text-center reveal">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream2 text-ink-3">
            <AlertCircle className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <h1 className="h-display mt-6 text-3xl text-foreground">Confirmation en attente</h1>
          <p className="mt-3 text-ink-3">{error}</p>
          {orderNumber && (
            <div className="mt-8 rounded-[var(--radius)] border border-line bg-card p-5 text-left">
              <div className="flex justify-between">
                <span className="font-mono text-[0.78rem] text-ink-3">N° de commande</span>
                <span className="font-mono font-semibold text-primary">{orderNumber}</span>
              </div>
            </div>
          )}
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

  return (
    <ClientLayout>
      <div className="container max-w-2xl py-14 md:py-20">

        {/* ── Hero confirmation ── */}
        <div className="text-center reveal">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sugo-soft ring-1 ring-primary/20 animate-scale-in">
            <Check className="h-7 w-7 text-primary" strokeWidth={2} />
          </div>
          <p className="eyebrow mt-6">Merci !</p>
          <h1 className="h-display mt-2 text-5xl md:text-6xl text-foreground">
            Commande{' '}
            <span className="italic-serif text-primary">confirmée.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-ink-3">
            Votre paiement a été reçu. {restaurantName} prépare votre commande.
          </p>
        </div>

        {/* ── Info rows ── */}
        <div className="mt-10 rounded-[var(--radius)] border border-line bg-card divide-y divide-line/60 reveal reveal-delay-1">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-mono text-[0.78rem] text-ink-3">N° de commande</span>
            <span className="font-mono font-semibold text-foreground">{confirmedOrderNumber}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-mono text-[0.78rem] text-ink-3">Statut</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-basil">
              <span className="h-1.5 w-1.5 rounded-full bg-basil" aria-hidden /> Paiement confirmé
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-mono text-[0.78rem] text-ink-3">Mode</span>
            <span className="text-sm font-medium text-foreground">
              {fulfillmentMethod === 'pickup' ? 'Retrait sur place' : 'Livraison'}
            </span>
          </div>
        </div>

        {/* ── Estimated time ── */}
        {estimatedTimeLabel && (
          <div className="mt-5 flex items-start gap-3 rounded-[var(--radius)] border border-line bg-card p-5 reveal reveal-delay-2">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" strokeWidth={1.6} />
            <div>
              <h2 className="font-display text-xl text-foreground">Temps estimé</h2>
              <p className="mt-1 text-sm text-ink-3">{estimatedTimeLabel}</p>
            </div>
          </div>
        )}

        {/* ── Email confirmation ── */}
        <div className="mt-5 flex items-start gap-3 rounded-[var(--radius)] border border-line bg-card p-5 reveal reveal-delay-2">
          <Mail className="h-5 w-5 shrink-0 text-primary mt-0.5" strokeWidth={1.6} />
          <div>
            <h2 className="font-display text-xl text-foreground">Email de confirmation envoyé</h2>
            <p className="mt-1 text-sm text-ink-3">
              Un récapitulatif a été envoyé à l&apos;adresse utilisée lors du paiement. Pensez à vérifier vos spams si besoin.
            </p>
          </div>
        </div>

        {/* ── Rush mode ── */}
        {rushModeEnabled && (
          <div className="mt-5 rounded-[var(--radius)] border border-line bg-card p-5">
            <h2 className="font-display text-xl text-foreground">Affluence élevée</h2>
            <p className="mt-1 text-sm text-ink-3">
              Forte affluence ce soir — votre commande pourrait prendre un peu plus de temps. Merci pour votre patience.
            </p>
          </div>
        )}

        {/* ── Pickup address ── */}
        {fulfillmentMethod === 'pickup' && (
          <div className="mt-5 flex items-start gap-3 rounded-[var(--radius)] border border-line bg-card p-5 reveal reveal-delay-3">
            <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" strokeWidth={1.6} />
            <div>
              <h2 className="font-display text-xl text-foreground">Retrait sur place</h2>
              <p className="mt-1 text-sm text-ink-3">Présentez-vous à cette adresse :</p>
              <p className="mt-2 text-sm font-medium text-foreground">{addressLine}</p>
            </div>
          </div>
        )}

        {/* ── Help / Contact ── */}
        <div className="mt-5 rounded-[var(--radius)] border border-line bg-card p-5 reveal reveal-delay-3">
          <h2 className="font-display text-xl text-foreground">Besoin d&apos;aide ?</h2>
          <p className="mt-1 text-sm text-ink-3">Contactez-nous si vous avez la moindre question.</p>
          <div className="mt-4 space-y-2 text-sm">
            {phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" strokeWidth={1.6} />
                {phoneHref
                  ? <a href={phoneHref} className="link-underline text-ink">{phone}</a>
                  : <span className="text-foreground">{phone}</span>}
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" strokeWidth={1.6} />
                {emailHref
                  ? <a href={emailHref} className="link-underline text-ink break-all">{email}</a>
                  : <span className="text-foreground">{email}</span>}
              </div>
            )}
          </div>
          <div className="mt-4">
            <Link
              to="/contact"
              className="inline-flex h-10 items-center rounded-full border border-line bg-card px-5 font-semibold text-foreground transition-colors hover:bg-cream2"
            >
              Page contact
            </Link>
          </div>
        </div>

        {/* ── CTAs ── */}
        {trackingToken && (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to={`/suivi/${trackingToken}`}
              className="inline-flex h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground transition-colors hover:bg-sugo-dark"
            >
              Suivre ma commande
            </Link>
            <Link
              to="/"
              className="inline-flex h-12 items-center rounded-full border border-line bg-card px-6 font-semibold text-foreground transition-colors hover:bg-cream2"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        )}

      </div>
    </ClientLayout>
  );
}
