import { useMemo, useState } from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import type { Product, PastaVariant, PaniniVariant, CartItemPasta, CartItemPanini, Beverage } from '@/types';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

interface Props {
  product: Product;
  categorySlug: 'pates' | 'paninis';
  beverages: Beverage[];
  ordersEnabled?: boolean;
}

export default function ProductCard({ product, categorySlug, beverages, ordersEnabled = true }: Props) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedBeverageId, setSelectedBeverageId] = useState('');
  const [showBeverageError, setShowBeverageError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const activeVariants = product.variants.filter((v) => v.active);
  const activeBeverages = useMemo(
    () => beverages.filter((b) => b.active).sort((a, b) => a.order - b.order),
    [beverages],
  );
  const currentVariant = activeVariants[selectedVariantIndex];
  if (!currentVariant) return null;

  const isPaniniMenu =
    categorySlug === 'paninis' && (currentVariant as PaniniVariant).formula === 'menu';

  const handleAdd = () => {
    if (!ordersEnabled) {
      return;
    }

    if (isPaniniMenu && !selectedBeverageId) {
      setShowBeverageError(true);
      return;
    }
    setShowBeverageError(false);

    if (categorySlug === 'pates') {
      const v = currentVariant as PastaVariant;
      const item: CartItemPasta = {
        type: 'pates',
        productId: product.id,
        productName: product.name,
        size: v.size,
        price: v.price,
        quantity,
      };
      addItem(item);
    } else {
      const v = currentVariant as PaniniVariant;
      const bev = beverages.find((b) => b.id === selectedBeverageId);
      const item: CartItemPanini = {
        type: 'paninis',
        productId: product.id,
        productName: product.name,
        formula: v.formula,
        price: v.price,
        quantity,
        beverageId: v.formula === 'menu' ? selectedBeverageId : undefined,
        beverageName: v.formula === 'menu' ? bev?.name : undefined,
      };
      addItem(item);
    }

    setQuantity(1);
    setSelectedBeverageId('');
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  const getVariantLabel = (v: PastaVariant | PaniniVariant) => {
    if ('size' in v) return SIZE_LABELS[v.size];
    return SIZE_LABELS[v.formula];
  };

  return (
    <div className="group flex h-full flex-col gap-4 rounded-[var(--radius)] border border-border/70 bg-card p-5 shadow-card transition-all duration-300 ease-out-soft hover:border-border hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[1.35rem] leading-tight text-foreground">
            {product.name}
          </h3>
          {product.featured && (
            <span className="shrink-0 rounded-full bg-olive-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-olive">
              Populaire
            </span>
          )}
        </div>
        {product.description && (
          <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {activeVariants.map((v, i) => {
          const label = getVariantLabel(v);
          const active = i === selectedVariantIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSelectedVariantIndex(i);
                setSelectedBeverageId('');
                setShowBeverageError(false);
              }}
              className={`relative rounded-[calc(var(--radius)-2px)] border px-3 py-2.5 text-left transition-all duration-200 ${
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-foreground hover:border-foreground/40 hover:bg-secondary/50'
              }`}
            >
              <div className="text-[0.78rem] font-medium opacity-90">{label}</div>
              <div className="price-tag mt-0.5 text-[0.95rem] font-semibold">{formatPrice(v.price)}</div>
            </button>
          );
        })}
      </div>

      {isPaniniMenu && (
        <div className="rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/40 p-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Boisson incluse <span className="text-primary">*</span>
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {activeBeverages.map((b) => {
              const active = selectedBeverageId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBeverageId(b.id);
                    setShowBeverageError(false);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-[0.78rem] font-medium transition-all duration-200 ${
                    active
                      ? 'border-olive bg-olive text-background'
                      : 'border-border bg-card text-foreground hover:border-olive/50'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {active && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
          {activeBeverages.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Aucune boisson disponible.</p>
          )}
          {showBeverageError && (
            <p className="mt-2 text-xs text-destructive">Veuillez choisir une boisson.</p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            aria-label="Réduire la quantité"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <span className="price-tag w-5 text-center text-sm font-semibold tabular-nums">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            aria-label="Augmenter la quantité"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        <Button
          onClick={handleAdd}
          disabled={!ordersEnabled}
          size="sm"
          className="h-9 rounded-[calc(var(--radius)-2px)] px-4 text-[0.82rem] font-semibold shadow-xs transition-all"
        >
          {!ordersEnabled ? (
            <span>Commandes fermées</span>
          ) : justAdded ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> Ajouté
            </span>
          ) : (
            <span className="price-tag">Ajouter · {formatPrice(currentVariant.price * quantity)}</span>
          )}
        </Button>
      </div>
    </div>
  );
}