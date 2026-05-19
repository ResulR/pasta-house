import { useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import { Minus, Plus, Trash2, X, Bike, Store, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  ordersEnabled?: boolean;
  ordersDisabledReason?: string;
}

export default function CartDrawer({
  open,
  onClose,
  ordersEnabled = true,
  ordersDisabledReason = '',
}: Props) {
  const {
    items, mode, setMode,
    subtotal, deliveryFee, total,
    removeItem, updateQuantity,
    meetsMinimum, minimumOrder, clearCart,
  } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const goToCheckout = () => {
    if (!ordersEnabled) {
      return;
    }
    onClose();
    navigate('/checkout');
  };

  const remainingForMin = mode === 'livraison' ? Math.max(0, minimumOrder - subtotal) : 0;
  const progressPct = Math.min(100, (subtotal / Math.max(1, minimumOrder)) * 100);

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-40 bg-espresso/20 backdrop-blur-[2px] transition-opacity duration-300 ease-out-soft ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* ── Drawer panel ── */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-line bg-background shadow-lg transition-transform duration-400 ease-out-soft ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Votre panier"
      >
        <div className="flex h-full flex-col">

          {/* ── Header — dark ink ── */}
          <div className="flex items-center justify-between border-b border-background/10 bg-foreground px-5 py-4">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="h-[18px] w-[18px] text-primary" strokeWidth={1.6} />
              <h2 className="font-display text-[1.35rem] font-extrabold leading-none text-background">
                Votre panier
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-background/50 transition-colors hover:bg-background/10 hover:text-background"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>

          {/* ── Mode toggle + progress ── */}
          <div className="px-5 pt-4">
            <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-secondary p-1">
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
                    className={`flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.7} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {mode === 'livraison' && remainingForMin > 0 && items.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between font-mono text-[0.78rem] text-ink-3">
                  <span>
                    Encore{' '}
                    <span className="font-semibold text-foreground">{formatPrice(remainingForMin)}</span>{' '}
                    pour la livraison
                  </span>
                  <span>{formatPrice(minimumOrder)}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-cream2">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out-soft"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Items list ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream2 text-ink-3">
                  <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <p className="mt-4 font-display text-xl text-foreground">Votre panier est vide</p>
                <p className="mt-1 max-w-[240px] text-sm text-ink-3">
                  Ajoutez vos plats préférés pour commencer.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-line bg-card p-3 animate-fade-in-soft transition-colors hover:border-line-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[1rem] font-extrabold text-foreground">
                        {item.productName}
                      </p>
                      <p className="eyebrow mt-0.5">
                        {item.type === 'pates' ? SIZE_LABELS[item.size] : SIZE_LABELS[item.formula]}
                        {item.type === 'paninis' && item.beverageName && ` · ${item.beverageName}`}
                      </p>
                      <p className="font-mono mt-1.5 text-sm font-semibold text-foreground">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-ink-3 transition-colors hover:text-destructive"
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                      <div className="flex items-center gap-1.5 rounded-full border border-line bg-card px-1 py-1">
                        <button
                          onClick={() => updateQuantity(i, item.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-foreground transition-colors hover:bg-cream2"
                          aria-label="Réduire"
                        >
                          <Minus className="h-3 w-3" strokeWidth={2} />
                        </button>
                        <span className="font-mono w-4 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(i, item.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-foreground transition-colors hover:bg-cream2"
                          aria-label="Augmenter"
                        >
                          <Plus className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Footer — totals + checkout ── */}
          {items.length > 0 && (
            <div className="border-t border-line bg-card px-5 py-4">
              <dl className="space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-[0.85rem] text-ink-3">Sous-total</dt>
                  <dd className="font-mono text-[0.85rem] font-medium text-foreground">
                    {formatPrice(subtotal)}
                  </dd>
                </div>
                {mode === 'livraison' && (
                  <div className="flex justify-between">
                    <dt className="text-[0.85rem] text-ink-3">Livraison</dt>
                    <dd className="font-mono text-[0.85rem] font-medium text-foreground">
                      {formatPrice(deliveryFee)}
                    </dd>
                  </div>
                )}
                <div className="mt-2 flex items-baseline justify-between border-t border-line/70 pt-3">
                  <dt className="font-display text-lg text-foreground">Total</dt>
                  <dd className="font-mono text-[1.5rem] font-semibold text-foreground">
                    {formatPrice(total)}
                  </dd>
                </div>
              </dl>

              {!meetsMinimum && mode === 'livraison' && (
                <p className="mt-3 text-xs text-destructive">
                  Minimum de commande en livraison : {formatPrice(minimumOrder)}.
                </p>
              )}

              {!ordersEnabled && (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {ordersDisabledReason || 'Les commandes sont temporairement fermées.'}
                </p>
              )}

              <button
                type="button"
                onClick={goToCheckout}
                disabled={!meetsMinimum || !ordersEnabled}
                className="mt-4 h-12 w-full rounded-full bg-primary font-mono text-[0.95rem] font-semibold text-primary-foreground shadow-md transition-colors hover:bg-sugo-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ordersEnabled ? `Commander · ${formatPrice(total)}` : 'Commandes fermées'}
              </button>

              <button
                type="button"
                onClick={clearCart}
                className="mt-2 w-full text-[0.78rem] text-ink-3 transition-colors hover:text-destructive"
              >
                Vider le panier
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
