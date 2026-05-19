import { Link, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';

export default function PaymentCancelledPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('orderNumber');

  return (
    <ClientLayout>
      <div className="container max-w-lg py-20 text-center reveal">

        {/* ── Icon ── */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
          <XCircle className="h-7 w-7 text-destructive" strokeWidth={1.7} />
        </div>

        {/* ── Heading ── */}
        <h1 className="h-display mt-6 text-4xl md:text-5xl text-foreground">Paiement annulé</h1>

        <p className="mt-3 text-ink-3 max-w-sm mx-auto">
          Votre paiement n&apos;a pas été finalisé. Vous pouvez réessayer ou modifier votre commande avant de relancer le paiement.
        </p>

        {/* ── Order info card ── */}
        {orderNumber && (
          <div className="mt-8 rounded-[var(--radius)] border border-line bg-card p-5 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.78rem] text-ink-3">N° de commande</span>
              <span className="font-mono font-semibold text-primary">{orderNumber}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-3">
              <span className="font-mono text-[0.78rem] text-ink-3">Statut</span>
              <span className="font-mono text-[0.82rem] text-ink-3">En attente de paiement</span>
            </div>
          </div>
        )}

        {/* ── CTAs ── */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/checkout"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 font-semibold text-primary-foreground transition-colors hover:bg-sugo-dark"
          >
            Réessayer
          </Link>
          <Link
            to="/commander"
            className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-card px-6 font-semibold text-foreground transition-colors hover:bg-cream2"
          >
            Modifier la commande
          </Link>
        </div>

      </div>
    </ClientLayout>
  );
}
