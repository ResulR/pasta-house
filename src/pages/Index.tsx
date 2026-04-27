import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, MapPin, Sparkles, Leaf, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu, formatPriceFromCents } from '@/lib/menu-api';
import paniniImage from '@/assets/home/panini.png';
import ravierBoloImage from '@/assets/home/ravier_bolo.png';
import ravierCremeImage from '@/assets/home/ravier_creme.png';
import ravierOrangeImage from '@/assets/home/ravier_orange.png';

interface FeaturedProductCard {
  id: string;
  name: string;
  description: string;
  minPriceCents: number;
}

interface SavedTrackedOrder {
  orderNumber: string;
  trackingToken: string;
  savedAt: string;
}

const LAST_TRACKED_ORDER_STORAGE_KEY = 'pasta-house-last-tracked-order';

function formatHourLabel(time: string | null | undefined): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':');
  if (minutes === '00') return `${hours}h`;
  return `${hours}h${minutes}`;
}

export default function HomePage() {
  const [featuredPastas, setFeaturedPastas] = useState<FeaturedProductCard[]>([]);
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [deliveryZoneLabel, setDeliveryZoneLabel] = useState('Bruxelles');
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(500);
  const [estimatedDeliveryTimeMin, setEstimatedDeliveryTimeMin] = useState(30);
  const [openingLabel, setOpeningLabel] = useState('20h – 01h');
  const [lastTrackedOrder, setLastTrackedOrder] = useState<SavedTrackedOrder | null>(null);

  const heroVisuals = useMemo(
    () => [
      { id: 'bolo', src: ravierBoloImage, alt: 'Pâtes bolognaise' },
      { id: 'creme', src: ravierCremeImage, alt: 'Pâtes sauce crème' },
      { id: 'orange', src: ravierOrangeImage, alt: 'Pâtes gratinées' },
      { id: 'panini', src: paniniImage, alt: 'Panini grillé' },
    ],
    [],
  );
  const [activeVisual, setActiveVisual] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchPublicMenu();
        if (!mounted) return;
        const pastaCategory = data.categories.find((c) => c.slug === 'pates');
        const next = (pastaCategory?.products || [])
          .filter((p) => p.isFeatured)
          .slice(0, 4)
          .map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            minPriceCents: Math.min(...p.variants.map((v) => v.priceCents)),
          }));
        setFeaturedPastas(next);
        if (data.siteSettings?.restaurantName) setRestaurantName(data.siteSettings.restaurantName);
        if (data.deliverySettings?.deliveryZoneLabel) setDeliveryZoneLabel(data.deliverySettings.deliveryZoneLabel);
        if (typeof data.deliverySettings?.deliveryFeeCents === 'number') setDeliveryFeeCents(data.deliverySettings.deliveryFeeCents);
        if (typeof data.deliverySettings?.estimatedDeliveryTimeMin === 'number') setEstimatedDeliveryTimeMin(data.deliverySettings.estimatedDeliveryTimeMin);
        const firstOpen = data.openingHours.find((d) => d.isOpen);
        const o = formatHourLabel(firstOpen?.openTime);
        const c = formatHourLabel(firstOpen?.closeTime);
        if (o && c) setOpeningLabel(`${o} – ${c}`);
      } catch (e) {
        console.error('Home menu load:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_TRACKED_ORDER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.orderNumber && parsed?.trackingToken && parsed?.savedAt) {
        setLastTrackedOrder(parsed);
      } else {
        localStorage.removeItem(LAST_TRACKED_ORDER_STORAGE_KEY);
      }
    } catch (e) {
      console.error('tracked order localStorage:', e);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveVisual((v) => (v + 1) % heroVisuals.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [heroVisuals.length]);

  const deliveryFeeLabel = useMemo(() => formatPriceFromCents(deliveryFeeCents), [deliveryFeeCents]);

  const promises = [
    {
      icon: ChefHat,
      title: 'Préparé minute',
      text: 'Chaque assiette est cuisinée à la commande, avec des produits frais.',
    },
    {
      icon: Clock,
      title: `Livré en ~${estimatedDeliveryTimeMin} min`,
      text: `Livraison à ${deliveryZoneLabel} pour ${deliveryFeeLabel}, ouverts ${openingLabel}.`,
    },
    {
      icon: Leaf,
      title: 'Sauces maison',
      text: 'Recettes signature, fromages fondants et produits sélectionnés avec exigence.',
    },
  ];

  return (
    <ClientLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 halo-warm pointer-events-none" />

        <div className="container relative grid items-center gap-12 pt-12 pb-16 md:grid-cols-12 md:gap-10 md:pt-20 md:pb-24 lg:pt-24 lg:pb-28">
          <div className="md:col-span-6 lg:col-span-6 reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[0.72rem] font-medium tracking-wide text-foreground/80 shadow-xs">
              <Sparkles className="h-3 w-3 text-primary" strokeWidth={2} />
              Cuisine maison · Bruxelles
            </span>

            <h1 className="h-display mt-6 text-[3.25rem] sm:text-6xl lg:text-[5rem] xl:text-[5.75rem] text-foreground">
              Des pâtes
              <br />
              <span className="h-display-italic text-primary">généreuses,</span>
              <br />
              servies tard.
            </h1>

            <p className="mt-6 max-w-md text-base sm:text-[1.05rem] leading-relaxed text-muted-foreground">
              {restaurantName} prépare chaque soir des pâtes fraîches et des paninis chauds, livrés chez vous à {deliveryZoneLabel}.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 px-7 text-[0.95rem] font-semibold shadow-sm">
                <Link to="/commander">
                  Commander maintenant
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                </Link>
              </Button>

              {lastTrackedOrder ? (
                <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[0.95rem] border-border bg-card hover:bg-secondary">
                  <Link to={`/suivi/${lastTrackedOrder.trackingToken}`}>
                    Suivre ma commande
                  </Link>
                </Button>
              ) : (
                <Link
                  to="/commander"
                  className="link-underline self-center px-1 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
                >
                  Voir la carte
                </Link>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.82rem] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={2} /> {openingLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" strokeWidth={2} /> Livraison {deliveryZoneLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-olive" />
                Paiement sécurisé
              </span>
            </div>
          </div>

          <div className="md:col-span-6 lg:col-span-6 reveal reveal-delay-2">
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="absolute inset-0 -translate-x-2 translate-y-3 rounded-full bg-secondary/70" aria-hidden />

              <div className="relative aspect-square overflow-hidden rounded-full bg-card shadow-lg ring-1 ring-border/60">
                {heroVisuals.map((v, i) => (
                  <img
                    key={v.id}
                    src={v.src}
                    alt={v.alt}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out-soft ${
                      i === activeVisual ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
                    }`}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center justify-center gap-2.5">
                {heroVisuals.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveVisual(i)}
                    aria-label={`Voir ${v.alt}`}
                    className={`group relative h-12 w-12 overflow-hidden rounded-full border transition-all duration-300 ease-out-soft ${
                      i === activeVisual
                        ? 'border-primary scale-105 shadow-sm'
                        : 'border-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={v.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>

              <div className="absolute -left-3 bottom-10 hidden md:block">
                <div className="card-elevated px-3.5 py-2.5 animate-scale-in">
                  <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">À partir de</p>
                  <p className="price-tag text-base font-semibold text-foreground">6,00 €</p>
                </div>
              </div>
              <div className="absolute -right-2 top-8 hidden md:block">
                <div className="card-elevated px-3.5 py-2.5 animate-scale-in" style={{ animationDelay: '160ms' }}>
                  <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Cuisine</p>
                  <p className="text-sm font-semibold text-foreground">Faite maison</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 surface-warm">
        <div className="container py-14 md:py-16">
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {promises.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className={`reveal reveal-delay-${i + 1}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-primary">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </div>
                  <h3 className="mt-4 font-display text-[1.5rem] leading-tight text-foreground">{p.title}</h3>
                  <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground max-w-sm">{p.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container py-20 md:py-24">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div className="reveal">
            <p className="eyebrow">Notre sélection</p>
            <h2 className="h-display mt-3 text-4xl md:text-5xl text-foreground">
              Les pâtes <span className="h-display-italic text-primary">à essayer</span>
            </h2>
          </div>
          <Link
            to="/commander"
            className="link-underline hidden sm:inline-flex items-center gap-2 pb-1 text-sm font-medium text-foreground"
          >
            Voir la carte complète <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(featuredPastas.length > 0 ? featuredPastas : Array.from({ length: 4 }, (_, i) => ({
            id: `skel-${i}`, name: '', description: '', minPriceCents: 0,
          }))).map((p, i) => {
            const isSkeleton = !p.name;
            return (
              <div
                key={p.id}
                className={`card-elevated p-5 hover-lift reveal reveal-delay-${(i % 4) + 1}`}
              >
                {isSkeleton ? (
                  <div className="space-y-3">
                    <div className="h-5 w-3/4 rounded bg-secondary animate-pulse" />
                    <div className="h-3 w-full rounded bg-secondary animate-pulse" />
                    <div className="h-3 w-5/6 rounded bg-secondary animate-pulse" />
                    <div className="h-4 w-1/3 rounded bg-secondary animate-pulse mt-6" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-[1.4rem] leading-tight text-foreground">{p.name}</h3>
                      <span className="shrink-0 rounded-full bg-olive-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-olive">
                        Choisi
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3 min-h-[3.6rem]">
                      {p.description}
                    </p>
                    <div className="mt-5 flex items-baseline justify-between border-t border-border/60 pt-4">
                      <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">À partir de</span>
                      <span className="price-tag text-base font-semibold text-foreground">
                        {formatPriceFromCents(p.minPriceCents)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center sm:hidden">
          <Button asChild variant="outline" className="bg-card border-border">
            <Link to="/commander">
              Voir la carte complète <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-border/60 surface-warm">
        <div className="container py-20 md:py-24">
          <div className="max-w-2xl reveal">
            <p className="eyebrow">Comment ça marche</p>
            <h2 className="h-display mt-3 text-4xl md:text-5xl text-foreground">
              Trois étapes,
              <br />
              <span className="h-display-italic text-primary">aucun stress.</span>
            </h2>
          </div>

          <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius)] border border-border/70 bg-border/70 sm:grid-cols-3">
            {[
              { n: '01', title: 'Choisissez vos plats', text: 'Parcourez la carte et composez votre commande à votre rythme.' },
              { n: '02', title: 'Livraison ou retrait', text: `Choisissez la livraison à ${deliveryZoneLabel} ou venez chercher sur place.` },
              { n: '03', title: 'On prépare, on livre', text: `Cuisson minute, livraison en environ ${estimatedDeliveryTimeMin} min.` },
            ].map((s, i) => (
              <li key={s.n} className={`bg-card p-7 md:p-8 reveal reveal-delay-${i + 1}`}>
                <p className="font-display text-3xl text-primary">{s.n}</p>
                <h3 className="mt-3 font-display text-[1.45rem] leading-tight text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container py-20 md:py-28">
        <div className="relative overflow-hidden rounded-[calc(var(--radius)+10px)] border border-border bg-card px-6 py-14 text-center md:px-12 md:py-20 shadow-card">
          <div className="absolute inset-0 halo-warm pointer-events-none" />
          <div className="relative reveal">
            <p className="eyebrow">Prêt·e à commander ?</p>
            <h2 className="h-display mt-4 text-4xl md:text-6xl text-foreground">
              On vous prépare ça
              <br />
              <span className="h-display-italic text-primary">tout de suite.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
              Ouverts {openingLabel}. Livraison à {deliveryZoneLabel} pour {deliveryFeeLabel}.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="h-12 px-8 font-semibold shadow-sm">
                <Link to="/commander">
                  Commander maintenant <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Link to="/contact" className="link-underline px-2 py-2 text-sm font-medium text-foreground">
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ClientLayout>
  );
}