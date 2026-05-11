import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Store, Lock, ArrowLeft } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { Button } from '@/components/ui/button';
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
          <p className="mt-3 text-muted-foreground">Ajoutez des articles avant de passer commande.</p>
          <Button onClick={() => navigate('/commander')} className="mt-8 h-11 px-6 font-semibold">
            Voir la carte
          </Button>
        </div>
      </ClientLayout>
    );
  }

  const inputCls = "h-11 rounded-[calc(var(--radius)-2px)] border-border bg-card placeholder:text-muted-foreground/60";

  return (
    <ClientLayout>
      <div className="container max-w-3xl py-10 md:py-14">
        <button
          onClick={() => navigate(-1)}
          className="link-underline mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </button>

        <div className="reveal">
          <p className="eyebrow">Étape finale</p>
          <h1 className="h-display mt-2 text-4xl md:text-5xl text-foreground">
            Finaliser <span className="h-display-italic text-primary">votre commande.</span>
          </h1>
        </div>

        {!ordersEnabled && (
          <div className="mt-8 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            <p className="font-semibold">Commandes temporairement fermées</p>
            <p className="mt-1">{ordersDisabledReason || 'Les commandes sont temporairement fermées.'}</p>
          </div>
        )}

        <div className="mt-8 reveal reveal-delay-1">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-secondary/60 p-1 max-w-md">
            {([
              { key: 'livraison', icon: Bike, label: 'Livraison' },
              { key: 'retrait', icon: Store, label: 'Retrait' },
            ] as const).map((m) => {
              const active = mode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-all duration-200 ${
                    active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} /> {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{estimatedTimeLabel}</p>
        </div>

        <div className="mt-8 card-elevated p-5 reveal reveal-delay-2">
          <p className="eyebrow">Récapitulatif</p>
          <ul className="mt-3 divide-y divide-border/60">
            {items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="text-foreground">
                  <span className="price-tag font-semibold">{item.quantity}×</span> {item.productName}
                  <span className="ml-1.5 text-[0.78rem] text-muted-foreground">
                    ({item.type === 'pates' ? SIZE_LABELS[item.size] : SIZE_LABELS[item.formula]}
                    {item.type === 'paninis' && item.beverageName && ` · ${item.beverageName}`})
                  </span>
                </span>
                <span className="price-tag shrink-0 font-medium text-foreground">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sous-total</dt>
              <dd className="price-tag text-foreground">{formatPrice(subtotal)}</dd>
            </div>
            {mode === 'livraison' && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Livraison</dt>
                <dd className="price-tag text-foreground">{formatPrice(deliveryFee)}</dd>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between border-t border-border/60 pt-2">
              <dt className="font-display text-lg">Total</dt>
              <dd className="price-tag text-lg font-semibold text-foreground">{formatPrice(total)}</dd>
            </div>
          </dl>
        </div>

        {!meetsMinimum && mode === 'livraison' && (
          <p className="mt-4 text-sm text-destructive">Minimum de commande en livraison : {formatPrice(minimumOrder)}</p>
        )}

        <div className="mt-10 space-y-5 reveal reveal-delay-3">
          <h2 className="font-display text-2xl text-foreground">Vos coordonnées</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="nom" className="text-[0.82rem] font-medium text-foreground/80">Nom *</Label>
              <Input id="nom" className={inputCls} value={form.nom} onChange={(e) => update('nom', e.target.value)} placeholder="Votre nom" />
              {errors.nom && <p className="mt-1 text-xs text-destructive">{errors.nom}</p>}
            </div>
            <div>
              <Label htmlFor="telephone" className="text-[0.82rem] font-medium text-foreground/80">Téléphone *</Label>
              <Input id="telephone" type="tel" className={inputCls} value={form.telephone} onChange={(e) => update('telephone', e.target.value)} placeholder="0470 12 34 56" />
              {errors.telephone && <p className="mt-1 text-xs text-destructive">{errors.telephone}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-[0.82rem] font-medium text-foreground/80">Email *</Label>
            <Input id="email" type="email" className={inputCls} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="vous@exemple.com" />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>

          {mode === 'livraison' && (
            <>
              <div>
                <Label htmlFor="adresse" className="text-[0.82rem] font-medium text-foreground/80">Adresse *</Label>
                <Input id="adresse" className={inputCls} value={form.adresse} onChange={(e) => update('adresse', e.target.value)} placeholder="Rue, numéro" />
                {errors.adresse && <p className="mt-1 text-xs text-destructive">{errors.adresse}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="commune" className="text-[0.82rem] font-medium text-foreground/80">Commune *</Label>
                  <Input id="commune" className={inputCls} value={form.commune} onChange={(e) => update('commune', e.target.value)} placeholder="Bruxelles" />
                  {errors.commune && <p className="mt-1 text-xs text-destructive">{errors.commune}</p>}
                </div>
                <div>
                  <Label htmlFor="codePostal" className="text-[0.82rem] font-medium text-foreground/80">CP *</Label>
                  <Input id="codePostal" className={inputCls} value={form.codePostal} onChange={(e) => update('codePostal', e.target.value)} placeholder="1000" />
                  {errors.codePostal && <p className="mt-1 text-xs text-destructive">{errors.codePostal}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="instructions" className="text-[0.82rem] font-medium text-foreground/80">Instructions de livraison</Label>
                <Textarea id="instructions" className="rounded-[calc(var(--radius)-2px)] border-border bg-card" value={form.instructions} onChange={(e) => update('instructions', e.target.value)} placeholder="Étage, code d'entrée, etc." rows={2} />
              </div>
            </>
          )}

          {mode === 'retrait' && (
            <div>
              <Label htmlFor="note" className="text-[0.82rem] font-medium text-foreground/80">Note</Label>
              <Textarea id="note" className="rounded-[calc(var(--radius)-2px)] border-border bg-card" value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Remarque particulière..." rows={2} />
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={loading || !meetsMinimum || !ordersEnabled} className="mt-8 h-12 w-full text-[0.95rem] font-semibold shadow-sm" size="lg">
          {loading
            ? 'Redirection vers le paiement…'
            : ordersEnabled
              ? <span className="price-tag">Payer · {formatPrice(total)}</span>
              : 'Commandes fermées'}
        </Button>

        {submitError && <p className="mt-3 text-center text-sm text-destructive">{submitError}</p>}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" strokeWidth={1.8} />
          Paiement sécurisé par Stripe · <a href="/cgv" className="link-underline ml-1">CGV</a>
        </p>
      </div>
    </ClientLayout>
  );
}