import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '@/contexts/OrdersContext';
import { formatPrice } from '@/config/menu';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getSevenDaysAgoInputValue() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

export default function AdminOrders() {
  const { orders, isLoading, error } = useOrders();
  const [exportFrom, setExportFrom] = useState(getSevenDaysAgoInputValue);
  const [exportTo, setExportTo] = useState(getTodayInputValue);
  const [exportError, setExportError] = useState('');

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (exportFrom) {
      params.set('from', exportFrom);
    }

    if (exportTo) {
      params.set('to', exportTo);
    }

    const queryString = params.toString();
    return `/api/admin/orders/export${queryString ? `?${queryString}` : ''}`;
  }, [exportFrom, exportTo]);

  const handleExport = () => {
    setExportError('');

    if (exportFrom && exportTo && exportFrom > exportTo) {
      setExportError('La date de début doit être avant la date de fin.');
      return;
    }

    window.location.href = exportUrl;
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="font-display text-xl font-bold">Commandes</h2>
        <p className="mt-6 text-sm text-muted-foreground">Chargement des commandes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="font-display text-xl font-bold">Commandes</h2>
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Commandes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exportez les commandes par période pour la compta, le suivi ou l’archivage.
          </p>
        </div>

        <div className="card-premium w-full p-4 lg:max-w-xl">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="export-from" className="text-xs text-muted-foreground">
                Du
              </Label>
              <Input
                id="export-from"
                type="date"
                value={exportFrom}
                onChange={(event) => setExportFrom(event.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="export-to" className="text-xs text-muted-foreground">
                Au
              </Label>
              <Input
                id="export-to"
                type="date"
                value={exportTo}
                onChange={(event) => setExportTo(event.target.value)}
                className="mt-1"
              />
            </div>

            <Button type="button" onClick={handleExport} className="sm:mb-0.5">
              Exporter CSV
            </Button>
          </div>

          {exportError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {exportError}
            </p>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Aucune commande pour le moment.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="pb-3 pr-4">N°</th>
                <th className="pb-3 pr-4">Heure</th>
                <th className="pb-3 pr-4">Client</th>
                <th className="pb-3 pr-4">Mode</th>
                <th className="pb-3 pr-4">Total</th>
                <th className="pb-3 pr-4">Paiement</th>
                <th className="pb-3 pr-4">Statut</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(order => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-primary">{order.orderNumber}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{order.customer.nom}</div>
                    <div className="text-xs text-muted-foreground">{order.customer.telephone}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${order.mode === 'livraison' ? 'bg-olive/15 text-olive' : 'bg-secondary text-secondary-foreground'}`}>
                      {order.mode === 'livraison' ? '🛵 Livraison' : '🏠 Retrait'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-semibold">{formatPrice(order.total)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        order.paymentStatus === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : order.paymentStatus === 'failed'
                            ? 'bg-destructive/10 text-destructive'
                            : order.paymentStatus === 'cancelled'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-amber-500/10 text-amber-700'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="py-3">
                    <Link to={`/admin/commandes/${order.id}`} className="text-xs text-primary hover:underline">
                      Détails →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
