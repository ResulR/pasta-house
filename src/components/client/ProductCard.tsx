import { useMemo, useState } from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import type { Product, PastaVariant, PaniniVariant, CartItemPasta, CartItemPanini, Beverage } from '@/types';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { useCart } from '@/contexts/CartContext';

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
    <div className="group flex h-full flex-col gap-4 rounded-[var(--radius)] border border-line bg-card p-5 shadow-card transition-all duration-300 ease-out-soft hover:border-line-2 hover:shadow-md">

      {/* ── Product name + badge ── */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[1.35rem] font-extrabold leading-tight text-foreground">
            {product.name}
          </h3>
          {product.featured && (
            <span className="shrink-0 rounded-full border border-primary/20 bg-sugo-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sugo">
              Best-seller
            </span>
          )}
        </div>
        {product.description && (
          <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-3">
            {product.description}
          </p>
        )}
      </div>

      {/* ── Variant selector ── */}
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
                  ? 'border-ink bg-ink text-background'
                  : 'border-line bg-card text-ink hover:border-ink/30'
              }`}
            >
              <div className={`font-mono text-[0.6rem] uppercase tracking-[0.1em] ${active ? 'text-background/60' : 'text-ink-3'}`}>
                {label}
              </div>
              <div className={`font-mono mt-0.5 text-[0.95rem] font-semibold ${active ? 'text-background' : 'text-ink'}`}>
                {formatPrice(v.price)}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Beverage picker (panini menu only) ── */}
      {isPaniniMenu && (
        <div className="rounded-[var(--radius)] border border-basil/20 bg-oliveSoft/50 p-3">
          <p className="eyebrow text-basil">
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
                      ? 'border-basil bg-basil text-background'
                      : 'border-line bg-card text-ink hover:border-basil/40'
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

      {/* ── Quantity stepper + add button ── */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line/60 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            aria-label="Réduire la quantité"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-foreground transition-colors hover:border-ink/30 hover:bg-cream2"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <span className="font-mono w-5 text-center text-sm font-semibold tabular-nums text-ink">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            aria-label="Augmenter la quantité"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-foreground transition-colors hover:border-ink/30 hover:bg-cream2"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!ordersEnabled}
          className={`h-9 rounded-full px-5 font-mono text-[0.82rem] font-semibold transition-colors ${
            !ordersEnabled
              ? 'cursor-not-allowed bg-sugo-soft text-primary'
              : justAdded
              ? 'bg-basil text-background'
              : 'bg-primary text-primary-foreground hover:bg-sugo-dark'
          }`}
        >
          {!ordersEnabled ? (
            <span>Commandes fermées</span>
          ) : justAdded ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> Ajouté ✓
            </span>
          ) : (
            <span>{`Ajouter · ${formatPrice(currentVariant.price * quantity)}`}</span>
          )}
        </button>
      </div>
    </div>
  );
}
