import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Store, Lock, ArrowLeft } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchPublicMenu } from '@/lib/menu-api';

const CHECKOUT_FORM_STORAGE_KEY = 'pasta-house-checkout-form';

type CheckoutFormState = {
  nom: string; telephone: string; email: string;
  adresse: string; commune: string; codePostal: string;
  instructions: string; note: string;
};

const EMPTY: CheckoutFormState = {
  nom: '', telephone: '', email: '',
  adresse: '', commune: '', codePostal: '',
  instructions: '', note: '',
};

const normalizePhoneNumber = (v: string) => v.trim().replace(/[()./\-\s]+/g, '');
const isValidPhoneNumber = (v: string) => {
  const n = normalizePhoneNumber(v);
  return !!n && /^\+?\d{8,15}$/.test(n);
};

export default function CheckoutPage() {
  const { items, mode, setMode, subtotal, deliveryFee, total, meetsMinimum, minimumOrder } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [estimatedDeliveryTimeMin, setEstimatedDeliveryTimeMin] = useState(30);
  const [estimatedPickupTimeMin, setEstimatedPickupTimeMin] = useState(15);
  const [ordersEnabled, setOrdersEnabled] = useState(true);
  const [ordersDisabledReason, setOrdersDisabledReason] = useState('');

  const [form, setForm] = useState<CheckoutFormState>(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_FORM_STORAGE_KEY);
      if (!raw) return EMPTY;
      const p = JSON.parse(raw);
      return {
        nom: typeof p?.nom === 'string' ? p.nom : '',
        telephone: typeof p?.telephone === 'string' ? p.telephone : '',
        email: typeof p?.email === 'string' ? p.email : '',
        adresse: typeof p?.adresse === 'string' ? p.adresse : '',
        commune: typeof p?.commune === 'string' ? p.commune : '',
        codePostal: typeof p?.codePostal === 'string' ? p.codePostal : '',
        instructions: typeof p?.instructions === 'string' ? p.instructions : '',
        note: typeof p?.note === 'string' ? p.note : '',
      };
    } catch (e) { console.error(e); return EMPTY; }
  });

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  useEffect(() => {
    try { localStorage.setItem(CHECKOUT_FORM_STORAGE_KEY, JSON.stringify(form)); }
    catch (e) { console.error(e); }
  }, [form]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchPublicMenu();
        if (!mounted) return;
        if (typeof data.deliverySettings?.estimatedDeliveryTimeMin === 'number') setEstimatedDeliveryTimeMin(data.deliverySettings.estimatedDeliveryTimeMin);
        if (typeof data.deliverySettings?.estimatedPickupTimeMin === 'number') setEstimatedPickupTimeMin(data.deliverySettings.estimatedPickupTimeMin);
        setOrdersEnabled(data.siteSettings?.ordersEnabled !== false);
        setOrdersDisabledReason(data.siteSettings?.ordersDisabledReason || 'Les commandes sont temporairement fermées.');
      } catch (e) { console.error(e); }
    })();
    return () => { mounted = false; };
  }, []);

  const estimatedTimeLabel = useMemo(() => mode === 'livraison'
    ? `Livraison estimée en environ ${estimatedDeliveryTimeMin} min`
    : `Retrait possible en environ ${estimatedPickupTimeMin} min`,
  [mode, estimatedDeliveryTimeMin, estimatedPickupTimeMin]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs.nom = 'Requis';
    if (!form.telephone.trim()) errs.telephone = 'Requis';
    else if (!isValidPhoneNumber(form.telephone)) errs.telephone = 'Numéro invalide';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email invalide';
    if (mode === 'livraison') {
      if (!form.adresse.trim()) errs.adresse = 'Requis';
      if (!form.commune.trim()) errs.commune = 'Requis';
      if (!form.codePostal.trim()) errs.codePostal = 'Requis';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (!ordersEnabled) {
      setSubmitError(ordersDisabledReason || 'Les commandes sont temporairement fermées.');
      return;
    }
    if (!validate()) return;
    if (!meetsMinimum) return;
    if (items.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch('/api/public/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          mode, items,
          customer: {
            nom: form.nom, telephone: form.telephone, email: form.email,
            adresse: form.adresse, commune: form.commune, codePostal: form.codePostal,
            instructions: form.instructions, note: form.note,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok || !json?.data?.checkoutUrl) {
        const msg = json?.message || json?.details?.[0]?.message || 'Impossible de lancer le paiement pour le moment.';
        setSubmitError(msg);
        return;
      }
      window.location.href = json.data.checkoutUrl;
    } catch (e) {
      console.error('Checkout submit error:', e);
      setSubmitError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <ClientLayout>
        <div className="container max-w-md py-24 text-center reveal">
          <h1 className="h-display text-4xl text-foreground">Panier vide</h1>
          <p className="mt-3 text-ink-3">Ajoutez des articles avant de passer commande.</p>
          <button
            type="button"
            onClick={() => navigate('/commander')}
            className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground transition-colors hover:bg-sugo-dark"
          >
            Voir la carte
          </button>
        </div>
      </ClientLayout>
    );
  }

  const inputCls = "h-11 rounded-[calc(var(--radius)-2px)] border-line bg-card placeholder:text-ink-3/60";

  return (
    <ClientLayout>
      <div className="container max-w-3xl py-10 md:py-14">

        {/* ── Back link ── */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="link-underline mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </button>

        {/* ── Header ── */}
        <div className="reveal">
          <p className="eyebrow">Étape finale</p>
          <h1 className="h-display mt-2 text-5xl md:text-6xl text-foreground">
            Finaliser{' '}
            <span className="italic-serif text-primary">votre commande.</span>
          </h1>
        </div>

        {/* ── Orders disabled banner ── */}
        {!ordersEnabled && (
          <div className="mt-8 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            <p className="font-semibold">Commandes temporairement fermées</p>
            <p className="mt-1">{ordersDisabledReason || 'Les commandes sont temporairement fermées.'}</p>
          </div>
        )}

        {/* ── Mode toggle ── */}
        <div className="mt-8 reveal reveal-delay-1">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-secondary p-1 max-w-md">
            {([
              { key: 'livraison', icon: Bike, label: 'Livraison' },
              { key: 'retrait', icon: Store, label: 'Retrait' },
            ] as const).map((m) => {
              const active = mode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} /> {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-[0.82rem] text-ink-3">{estimatedTimeLabel}</p>
        </div>

        {/* ── Recap card ── */}
        <div className="mt-8 rounded-[var(--radius)] border border-line bg-card p-5 reveal reveal-delay-2">
          <p className="eyebrow">Récapitulatif</p>
          <ul className="mt-3 divide-y divide-line/60">
            {items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="text-foreground">
                  <span className="font-mono font-semibold">{item.quantity}×</span>{' '}
                  {item.productName}
                  <span className="ml-1.5 text-[0.78rem] text-ink-3">
                    ({item.type === 'pates' ? SIZE_LABELS[item.size] : SIZE_LABELS[item.formula]}
                    {item.type === 'paninis' && item.beverageName && ` · ${item.beverageName}`})
                  </span>
                </span>
                <span className="font-mono font-medium shrink-0 text-foreground">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-line/60 pt-3">
            <div className="flex justify-between">
              <dt className="text-[0.85rem] text-ink-3">Sous-total</dt>
              <dd className="font-mono text-[0.85rem] text-foreground">{formatPrice(subtotal)}</dd>
            </div>
            {mode === 'livraison' && (
              <div className="flex justify-between">
                <dt className="text-[0.85rem] text-ink-3">Livraison</dt>
                <dd className="font-mono text-[0.85rem] text-foreground">{formatPrice(deliveryFee)}</dd>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between border-t border-line/60 pt-2">
              <dt className="font-display text-lg text-foreground">Total</dt>
              <dd className="font-mono text-lg font-semibold text-foreground">{formatPrice(total)}</dd>
            </div>
          </dl>
        </div>

        {!meetsMinimum && mode === 'livraison' && (
          <p className="mt-4 text-sm text-destructive">
            Minimum de commande en livraison : {formatPrice(minimumOrder)}
          </p>
        )}

        {/* ── Coordinates form ── */}
        <div className="mt-10 reveal reveal-delay-3">
          <div className="rounded-[var(--radius)] border border-line bg-card p-6 space-y-5">
            <h2 className="font-display text-2xl md:text-3xl text-foreground">Vos coordonnées</h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="nom" className="eyebrow">Nom *</Label>
                <Input
                  id="nom"
                  className={inputCls}
                  value={form.nom}
                  onChange={(e) => update('nom', e.target.value)}
                  placeholder="Votre nom"
                  aria-invalid={!!errors.nom}
                  aria-describedby={errors.nom ? 'nom-error' : undefined}
                />
                {errors.nom && <p id="nom-error" role="alert" className="text-xs text-destructive">{errors.nom}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="telephone" className="eyebrow">Téléphone *</Label>
                <Input
                  id="telephone"
                  type="tel"
                  className={inputCls}
                  value={form.telephone}
                  onChange={(e) => update('telephone', e.target.value)}
                  placeholder="0470 12 34 56"
                  aria-invalid={!!errors.telephone}
                  aria-describedby={errors.telephone ? 'telephone-error' : undefined}
                />
                {errors.telephone && <p id="telephone-error" role="alert" className="text-xs text-destructive">{errors.telephone}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="eyebrow">Email *</Label>
              <Input
                id="email"
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="vous@exemple.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && <p id="email-error" role="alert" className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {mode === 'livraison' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="adresse" className="eyebrow">Adresse *</Label>
                  <Input
                    id="adresse"
                    className={inputCls}
                    value={form.adresse}
                    onChange={(e) => update('adresse', e.target.value)}
                    placeholder="Rue, numéro"
                    aria-invalid={!!errors.adresse}
                    aria-describedby={errors.adresse ? 'adresse-error' : undefined}
                  />
                  {errors.adresse && <p id="adresse-error" role="alert" className="text-xs text-destructive">{errors.adresse}</p>}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="commune" className="eyebrow">Commune *</Label>
                    <Input
                      id="commune"
                      className={inputCls}
                      value={form.commune}
                      onChange={(e) => update('commune', e.target.value)}
                      placeholder="Bruxelles"
                      aria-invalid={!!errors.commune}
                      aria-describedby={errors.commune ? 'commune-error' : undefined}
                    />
                    {errors.commune && <p id="commune-error" role="alert" className="text-xs text-destructive">{errors.commune}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="codePostal" className="eyebrow">CP *</Label>
                    <Input
                      id="codePostal"
                      className={inputCls}
                      value={form.codePostal}
                      onChange={(e) => update('codePostal', e.target.value)}
                      placeholder="1000"
                      aria-invalid={!!errors.codePostal}
                      aria-describedby={errors.codePostal ? 'codePostal-error' : undefined}
                    />
                    {errors.codePostal && <p id="codePostal-error" role="alert" className="text-xs text-destructive">{errors.codePostal}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="instructions" className="eyebrow">Instructions de livraison</Label>
                  <Textarea
                    id="instructions"
                    className="rounded-[calc(var(--radius)-2px)] border-line bg-card"
                    value={form.instructions}
                    onChange={(e) => update('instructions', e.target.value)}
                    placeholder="Étage, code d'entrée, etc."
                    rows={2}
                  />
                </div>
              </>
            )}

            {mode === 'retrait' && (
              <div className="space-y-1">
                <Label htmlFor="note" className="eyebrow">Note</Label>
                <Textarea
                  id="note"
                  className="rounded-[calc(var(--radius)-2px)] border-line bg-card"
                  value={form.note}
                  onChange={(e) => update('note', e.target.value)}
                  placeholder="Remarque particulière..."
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Pay button ── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !meetsMinimum || !ordersEnabled}
          className="mt-8 h-12 w-full rounded-full bg-primary font-mono text-[0.95rem] font-semibold text-primary-foreground shadow-md transition-colors hover:bg-sugo-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading
            ? 'Redirection vers le paiement…'
            : ordersEnabled
              ? `Payer · ${formatPrice(total)}`
              : 'Commandes fermées'}
        </button>

        {submitError && (
          <p role="alert" className="mt-3 text-center text-sm text-destructive">{submitError}</p>
        )}

        {/* ── Stripe security line ── */}
        <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[0.78rem] text-ink-3">
          <Lock className="h-3 w-3" strokeWidth={1.8} />
          Paiement sécurisé par Stripe ·{' '}
          <a href="/cgv" className="link-underline ml-1">CGV</a>
        </p>

      </div>
    </ClientLayout>
  );
}
