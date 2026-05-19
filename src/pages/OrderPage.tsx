import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Bike, Store } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import ProductCard from '@/components/client/ProductCard';
import CartDrawer from '@/components/client/CartDrawer';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/config/menu';
import { fetchPublicMenu } from '@/lib/menu-api';
import type {
  Beverage, Category, CategorySlug, Product, PastaVariant, PaniniVariant,
} from '@/types';

function isCategorySlug(value: string): value is CategorySlug {
  return value === 'pates' || value === 'paninis';
}

export default function OrderPage() {
  const [activeCategory, setActiveCategory] = useState<CategorySlug>('pates');
  const [cartOpen, setCartOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<Record<CategorySlug, Product[]>>({
    pates: [], paninis: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimatedDeliveryTimeMin, setEstimatedDeliveryTimeMin] = useState(30);
  const [estimatedPickupTimeMin, setEstimatedPickupTimeMin] = useState(15);
  const [ordersEnabled, setOrdersEnabled] = useState(true);
  const [ordersDisabledReason, setOrdersDisabledReason] = useState('');

  const { itemCount, total } = useCart();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true); setError(null);
        const data = await fetchPublicMenu();
        if (!mounted) return;

        if (typeof data.deliverySettings?.estimatedDeliveryTimeMin === 'number') {
          setEstimatedDeliveryTimeMin(data.deliverySettings.estimatedDeliveryTimeMin);
        }
        if (typeof data.deliverySettings?.estimatedPickupTimeMin === 'number') {
          setEstimatedPickupTimeMin(data.deliverySettings.estimatedPickupTimeMin);
        }

        setOrdersEnabled(data.siteSettings?.ordersEnabled !== false);
        setOrdersDisabledReason(data.siteSettings?.ordersDisabledReason || 'Les commandes sont temporairement fermées.');

        const nextCategories: Category[] = [];
        const nextBeverages: Beverage[] = data.beverages.map((b) => ({
          id: b.id, name: b.name, active: b.isActive, order: b.sortOrder,
        }));
        const nextProductsByCategory: Record<CategorySlug, Product[]> = { pates: [], paninis: [] };

        for (const category of data.categories) {
          if (!isCategorySlug(category.slug)) continue;
          nextCategories.push({
            id: category.id, slug: category.slug, name: category.name,
            order: category.sortOrder, active: category.isActive,
          });
          nextProductsByCategory[category.slug] = category.products.map((product) => {
            const variants =
              category.slug === 'pates'
                ? product.variants.map<PastaVariant>((v) => ({
                    size: v.code as PastaVariant['size'],
                    price: v.priceCents / 100,
                    active: true,
                  }))
                : product.variants.map<PaniniVariant>((v) => ({
                    formula: v.code as PaniniVariant['formula'],
                    price: v.priceCents / 100,
                    active: true,
                  }));
            return {
              id: product.id, categoryId: category.id, name: product.name,
              description: product.description, active: product.isActive,
              order: product.sortOrder, featured: !!product.isFeatured, variants,
            };
          });
        }

        nextCategories.sort((a, b) => a.order - b.order);
        nextProductsByCategory.pates.sort((a, b) => a.order - b.order);
        nextProductsByCategory.paninis.sort((a, b) => a.order - b.order);

        setCategories(nextCategories);
        setBeverages(nextBeverages);
        setProductsByCategory(nextProductsByCategory);

        if (!nextCategories.some((c) => c.slug === activeCategory)) {
          const first = nextCategories[0];
          if (first && isCategorySlug(first.slug)) setActiveCategory(first.slug);
        }
      } catch (err) {
        console.error('Failed to load public menu:', err);
        if (!mounted) return;
        setError('Impossible de charger la carte pour le moment.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeCategory]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active).sort((a, b) => a.order - b.order),
    [categories],
  );
  const products = useMemo(
    () => productsByCategory[activeCategory] ?? [],
    [productsByCategory, activeCategory],
  );

  return (
    <ClientLayout>
      <div className="border-b border-border/60 surface-warm">
        <div className="container py-10 md:py-14">
          <p className="eyebrow reveal">Notre carte</p>
          <h1 className="h-display mt-3 text-4xl md:text-5xl text-foreground reveal">
            {!loading && activeCategories.length > 0 ? (
              <>
                {activeCategories.find((c) => c.slug === activeCategory)?.name ?? 'La carte'}
                <span className="h-display-italic text-primary"> · {products.length}</span>
              </>
            ) : (
              <>Composez votre <span className="h-display-italic text-primary">commande.</span></>
            )}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-3 reveal reveal-delay-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[0.82rem] font-medium text-primary">
              <Bike className="h-3.5 w-3.5" strokeWidth={1.8} />
              Livraison ≈ {estimatedDeliveryTimeMin} min
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-[0.82rem] font-medium text-accent">
              <Store className="h-3.5 w-3.5" strokeWidth={1.8} />
              Retrait ≈ {estimatedPickupTimeMin} min
            </span>
          </div>
        </div>
      </div>

      <div className="container pb-32 pt-8 md:pt-10">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-[var(--radius)] border border-border bg-card" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <>
            {!ordersEnabled && (
              <div className="mb-6 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
                <p className="font-semibold">Commandes temporairement fermées</p>
                <p className="mt-1">{ordersDisabledReason || 'Les commandes sont temporairement fermées.'}</p>
              </div>
            )}

            <div className="sticky top-16 z-20 -mx-5 mb-6 border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur-md md:mx-0 md:rounded-full md:border md:px-3 md:py-2 md:bg-card md:shadow-sm md:static md:top-auto">
              <div className="flex items-center gap-1.5 overflow-x-auto md:justify-start">
                {activeCategories.map((cat) => {
                  const active = activeCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setActiveCategory(cat.slug)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-[0.85rem] font-medium transition-all duration-200 ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {products.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product, i) => (
                  <div
                    key={product.id}
                    className="reveal"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <ProductCard
                      product={product}
                      categorySlug={activeCategory}
                      beverages={beverages}
                      ordersEnabled={ordersEnabled}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Aucun produit disponible dans cette catégorie.
              </div>
            )}
          </>
        )}
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md animate-slide-up">
          <div className="container py-4">
            <button
              onClick={() => setCartOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-full bg-foreground px-5 py-3 text-background shadow-md transition-transform duration-200 active:scale-[0.98]"
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/15 text-[11px] font-bold">
                  {itemCount}
                </span>
                Voir le panier
              </span>
              <span className="price-tag text-sm font-semibold">{formatPrice(total)}</span>
            </button>
          </div>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        ordersEnabled={ordersEnabled}
        ordersDisabledReason={ordersDisabledReason}
      />
    </ClientLayout>
  );
}
