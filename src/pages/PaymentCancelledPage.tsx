import { Link, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';

export default function PaymentCancelledPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('orderNumber');

  return (
    <ClientLayout>
      <div className="container py-20 max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="font-display text-2xl font-bold mt-6">Paiement annulé</h1>

        <p className="text-muted-foreground mt-2">
          Votre paiement n&apos;a pas été finalisé. Vous pouvez réessayer ou modifier votre commande avant de relancer le paiement.
        </p>

        {orderNumber && (
          <div className="card-premium p-5 mt-8 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">N° de commande</span>
              <span className="text-sm font-semibold text-primary">{orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Statut</span>
              <span className="text-sm font-medium">En attente de paiement</span>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/checkout">Réessayer</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/commander">Modifier la commande</Link>
          </Button>
        </div>
      </div>
    </ClientLayout>
  );
}