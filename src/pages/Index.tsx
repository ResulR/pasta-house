import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu, formatPriceFromCents } from '@/lib/menu-api';
import paniniImage from '@/assets/home/panini.png';
import pastaAssietteImage from '@/assets/home/pasta_assiette.png';
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

const MARQUEE_ITEMS = [
  'Pâtes fraîches',
  'Sauces maison',
  'Paninis chauds',
  'Livraison rapide',
  'Cuisine du soir',
  'Fait minute',
];

const CARD_IMAGES = [ravierBoloImage, ravierCremeImage, ravierOrangeImage, paniniImage];

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
      { id: 'bolo',     src: ravierBoloImage,    alt: 'Pâtes bolognaise' },
      { id: 'creme',    src: ravierCremeImage,   alt: 'Pâtes sauce crème' },
      { id: 'orange',   src: ravierOrangeImage,  alt: 'Pâtes gratinées' },
      { id: 'panini',   src: paniniImage,         alt: 'Panini grillé' },
      { id: 'assiette', src: pastaAssietteImage,  alt: 'Assiette de pâtes' },
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

  return (
    <ClientLayout>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-background">
        <div className="absolute inset-0 halo-warm pointer-events-none" />

        <div className="container relative grid items-center gap-10 pt-12 pb-16 md:grid-cols-12 md:gap-12 md:pt-20 md:pb-24 lg:pt-28 lg:pb-32">

          {/* Left — copy */}
          <div className="md:col-span-6 reveal">

            {/* Status pill — basil green */}
            <span className="inline-flex items-center gap-2 rounded-full border border-basil/30 bg-oliveSoft px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-widest text-basil">
              <span className="h-1.5 w-1.5 rounded-full bg-basil" aria-hidden />
              Ouvert ce soir · {openingLabel}
            </span>

            {/* Headline */}
            <h1 className="h-display mt-5 text-[4.5rem] leading-[0.88] sm:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] text-foreground">
              Des pâtes
              <br />
              <span className="italic-serif text-primary">généreuses,</span>
              <br />
              servies tard.
            </h1>

            <p className="mt-6 max-w-md text-base sm:text-[1.05rem] leading-relaxed text-muted-foreground">
              {restaurantName} prépare chaque soir des pâtes fraîches et des paninis chauds, livrés chez vous à {deliveryZoneLabel}.
            </p>

            {/* CTA row */}
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                to="/commander"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[0.95rem] font-semibold text-primary-foreground shadow-md transition-colors hover:bg-sugo-dark"
              >
                Commander maintenant
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>

              {lastTrackedOrder ? (
                <Link
                  to={`/suivi/${lastTrackedOrder.trackingToken}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-[0.95rem] font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  Suivre ma commande
                </Link>
              ) : (
                <Link
                  to="/commander"
                  className="link-underline self-center px-1 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
                >
                  Voir la carte
                </Link>
              )}
            </div>

            {/* Mono info bar */}
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.78rem] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                {openingLabel}
              </span>
              <span className="h-3 w-px bg-border" aria-hidden />
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                {deliveryZoneLabel} · {deliveryFeeLabel}
              </span>
              <span className="h-3 w-px bg-border" aria-hidden />
              <span>~{estimatedDeliveryTimeMin} min</span>
            </div>
          </div>

          {/* Right — photo stack */}
          <div className="md:col-span-6 reveal reveal-delay-2">
            <div className="relative mx-auto w-full max-w-[460px]">

              {/* Decorative offset shadow card */}
              <div
                className="absolute inset-x-0 top-0 aspect-[4/5] -translate-x-2 translate-y-3 rounded-2xl bg-secondary/70"
                aria-hidden
              />

              {/* Main photo frame */}
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border/60">
                {heroVisuals.map((v, i) => (
                  <img
                    key={v.id}
                    src={v.src}
                    alt={v.alt}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out-soft ${
                      i === activeVisual ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.03]'
                    }`}
                  />
                ))}

                {/* Gradient overlay */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/60 to-transparent pointer-events-none"
                  aria-hidden
                />

                {/* Floating dark info card */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="rounded-xl bg-ink/80 px-4 py-3 backdrop-blur-sm">
                    <p className="font-mono text-[0.6rem] font-medium uppercase tracking-[0.12em] text-cream2/60">
                      Plat du soir
                    </p>
                    <p className="mt-0.5 font-display text-[1.1rem] font-extrabold leading-tight text-cream2">
                      {heroVisuals[activeVisual]?.alt ?? 'Pâtes maison'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="mt-4 flex items-center justify-center gap-2">
                {heroVisuals.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveVisual(i)}
                    aria-label={`Voir ${v.alt}`}
                    className={`relative h-10 w-10 overflow-hidden rounded-full border-2 transition-all duration-300 ease-out-soft ${
                      i === activeVisual
                        ? 'border-primary scale-110 shadow-sm'
                        : 'border-border opacity-60 hover:opacity-90 hover:scale-105'
                    }`}
                  >
                    <img src={v.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          MARQUEE STRIP
      ════════════════════════════════════════════ */}
      <div className="border-y border-border bg-card py-4 overflow-hidden">
        <div className="marquee">
          <div className="marquee-track">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-4">
                <span className="font-display font-black uppercase text-[1.35rem] tracking-tight text-foreground whitespace-nowrap">
                  {item}
                </span>
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-sugo" aria-hidden />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          FEATURED CARDS
      ════════════════════════════════════════════ */}
      <section className="container py-20 md:py-24">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div className="reveal">
            <p className="eyebrow">Notre sélection</p>
            <h2 className="h-display mt-3 text-4xl md:text-5xl text-foreground">
              Les pâtes{' '}
              <span className="italic-serif text-primary">à essayer</span>
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
          {(featuredPastas.length > 0
            ? featuredPastas
            : Array.from({ length: 4 }, (_, i) => ({
                id: `skel-${i}`, name: '', description: '', minPriceCents: 0,
              }))
          ).map((p, i) => {
            const isSkeleton = !p.name;
            const imgSrc = CARD_IMAGES[i % CARD_IMAGES.length];
            const isBestSeller = i === 0;

            return (
              <div
                key={p.id}
                className={`overflow-hidden rounded-[var(--radius)] border border-border bg-card reveal reveal-delay-${(i % 4) + 1}`}
              >
                {/* Square photo */}
                <div className="aspect-square w-full overflow-hidden bg-secondary">
                  {isSkeleton ? (
                    <div className="h-full w-full animate-pulse bg-secondary" />
                  ) : (
                    <img
                      src={imgSrc}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {isSkeleton ? (
                    <div className="space-y-3">
                      <div className="h-5 w-3/4 rounded bg-secondary animate-pulse" />
                      <div className="h-3 w-full rounded bg-secondary animate-pulse" />
                      <div className="h-3 w-5/6 rounded bg-secondary animate-pulse" />
                      <div className="h-4 w-1/3 rounded bg-secondary animate-pulse mt-6" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-[1.3rem] font-extrabold leading-tight text-foreground">
                          {p.name}
                        </h3>
                        {isBestSeller && (
                          <span className="shrink-0 rounded-full border border-primary/20 bg-sugo-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Best-seller
                          </span>
                        )}
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
                        {p.description}
                      </p>

                      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                        <span className="price-tag text-base font-semibold text-foreground">
                          {formatPriceFromCents(p.minPriceCents)}
                        </span>
                        <Link
                          to="/commander"
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-4 text-[0.78rem] font-semibold text-background transition-colors hover:bg-ink-2"
                        >
                          Choisir <ArrowRight className="h-3 w-3" strokeWidth={2} />
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile CTA */}
        <div className="mt-10 flex justify-center sm:hidden">
          <Link
            to="/commander"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Voir la carte complète <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          STEPS — flat divide-y list
      ════════════════════════════════════════════ */}
      <section className="border-t border-border bg-card">
        <div className="container py-20 md:py-24">
          <div className="max-w-2xl reveal">
            <p className="eyebrow">Comment ça marche</p>
            <h2 className="h-display mt-3 text-4xl md:text-5xl text-foreground">
              Trois étapes,
              <br />
              <span className="italic-serif text-primary">aucun stress.</span>
            </h2>
          </div>

          <ol className="mt-12 divide-y divide-border">
            {[
              {
                n: '01',
                title: 'Choisissez vos plats',
                text: 'Parcourez la carte et composez votre commande à votre rythme.',
              },
              {
                n: '02',
                title: 'Livraison ou retrait',
                text: `Choisissez la livraison à ${deliveryZoneLabel} ou venez chercher sur place.`,
              },
              {
                n: '03',
                title: 'On prépare, on livre',
                text: `Cuisson minute, livraison en environ ${estimatedDeliveryTimeMin} min.`,
              },
            ].map((s, i) => (
              <li
                key={s.n}
                className={`flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:gap-10 reveal reveal-delay-${i + 1}`}
              >
                <span className="w-20 flex-shrink-0 font-display text-[3.5rem] font-extrabold leading-none text-primary">
                  {s.n}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-[1.5rem] font-extrabold leading-tight text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 reveal">
            <Link
              to="/commander"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[0.95rem] font-semibold text-primary-foreground shadow-md transition-colors hover:bg-sugo-dark"
            >
              Commander maintenant <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CTA FINALE — dark ink background
      ════════════════════════════════════════════ */}
      <section className="container py-20 md:py-28">
        <div className="grain relative overflow-hidden rounded-[calc(var(--radius)+10px)] bg-foreground px-6 py-16 text-center md:px-12 md:py-24">
          <div className="relative reveal">
            <p className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-background/50">
              Prêt·e à commander ?
            </p>
            <h2 className="h-display mt-4 text-4xl md:text-6xl text-background">
              On vous prépare ça
              <br />
              <span className="italic-serif text-primary">tout de suite.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[0.95rem] leading-relaxed text-background/60">
              Ouverts {openingLabel}. Livraison à {deliveryZoneLabel} pour {deliveryFeeLabel}.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/commander"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-[0.95rem] font-semibold text-primary-foreground shadow-md transition-colors hover:bg-sugo-dark"
              >
                Commander maintenant <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="link-underline px-2 py-2 text-sm font-medium text-background/70 hover:text-background"
              >
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>

    </ClientLayout>
  );
}
