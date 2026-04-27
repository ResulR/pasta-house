import { useEffect, useState } from 'react';
import type { DeliverySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminFetch } from '@/lib/adminCsrf';

interface AdminDeliveryResponse {
  ok: boolean;
  data?: DeliverySettings & { id?: string };
  message?: string;
  error?: string;
}

interface UpdateDeliveryResponse {
  ok: boolean;
  data?: DeliverySettings & { id?: string };
  message?: string;
  error?: string;
}

export default function AdminDelivery() {
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDeliverySettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/delivery', {
        method: 'GET',
        credentials: 'include',
      });

      const data: AdminDeliveryResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de charger les paramètres de livraison.');
        return;
      }

      setSettings({
        enabled: data.data.enabled,
        pickupEnabled: data.data.pickupEnabled,
        fee: data.data.fee,
        minimumOrder: data.data.minimumOrder,
        zone: data.data.zone,
        estimatedDeliveryTime: data.data.estimatedDeliveryTime,
        estimatedPickupTime: data.data.estimatedPickupTime,
        rushModeEnabled: data.data.rushModeEnabled,
      });
    } catch (err) {
      console.error('Admin delivery fetch error:', err);
      setError('Impossible de charger les paramètres de livraison.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliverySettings();
  }, []);

  const update = (field: keyof DeliverySettings, value: string | number | boolean) => {
    setSettings((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, [field]: value };
    });
  };

  const saveSettings = async () => {
    if (!settings) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch('/api/admin/delivery', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      const data: UpdateDeliveryResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de sauvegarder les paramètres de livraison.');
        return;
      }

      setSettings({
        enabled: data.data.enabled,
        pickupEnabled: data.data.pickupEnabled,
        fee: data.data.fee,
        minimumOrder: data.data.minimumOrder,
        zone: data.data.zone,
        estimatedDeliveryTime: data.data.estimatedDeliveryTime,
        estimatedPickupTime: data.data.estimatedPickupTime,
        rushModeEnabled: data.data.rushModeEnabled,
      });
      setSuccessMessage(data.message || 'Paramètres de livraison mis à jour avec succès.');
    } catch (err) {
      console.error('Admin delivery save error:', err);
      setError('Impossible de sauvegarder les paramètres de livraison.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg">
        <h2 className="font-display text-xl font-bold">Livraison</h2>
        <p className="text-sm text-muted-foreground mt-6">Chargement des paramètres de livraison...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-lg">
        <h2 className="font-display text-xl font-bold">Livraison</h2>
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {error || 'Impossible de charger les paramètres de livraison.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-xl font-bold">Livraison</h2>

      <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-muted-foreground">
          Gérez les paramètres réels de livraison et de retrait utilisés par le checkout.
        </p>

        <Button onClick={saveSettings} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </Button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!error && successMessage && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <p className="text-sm text-primary">{successMessage}</p>
        </div>
      )}

      <div className="mt-6 space-y-5">
        <div className="card-premium p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Livraison activée</p>
            <p className="text-xs text-muted-foreground">Les clients peuvent commander en livraison</p>
          </div>
          <button
            type="button"
            onClick={() => update('enabled', !settings.enabled)}
            className={`h-6 w-11 rounded-full transition-colors ${settings.enabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-foreground transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        <div className="card-premium p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Retrait activé</p>
            <p className="text-xs text-muted-foreground">Les clients peuvent venir chercher sur place</p>
          </div>
          <button
            type="button"
            onClick={() => update('pickupEnabled', !settings.pickupEnabled)}
            className={`h-6 w-11 rounded-full transition-colors ${settings.pickupEnabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-foreground transition-transform ${settings.pickupEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        <div>
          <Label>Frais de livraison (€)</Label>
          <Input
            type="number"
            step="0.50"
            min="0"
            value={settings.fee}
            onChange={(e) => update('fee', parseFloat(e.target.value) || 0)}
            className="w-32 mt-1"
          />
        </div>

        <div>
          <Label>Minimum de commande livraison (€)</Label>
          <Input
            type="number"
            step="0.50"
            min="0"
            value={settings.minimumOrder}
            onChange={(e) => update('minimumOrder', parseFloat(e.target.value) || 0)}
            className="w-32 mt-1"
          />
        </div>

        <div>
          <Label>Zone de livraison</Label>
          <Input
            value={settings.zone}
            onChange={(e) => update('zone', e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            V1 : zone affichée côté client. Pourra évoluer plus tard vers des zones plus précises.
          </p>
        </div>
                <div>
          <Label>Temps estimé livraison (min)</Label>
          <Input
            type="number"
            step="1"
            min="1"
            value={settings.estimatedDeliveryTime}
            onChange={(e) => update('estimatedDeliveryTime', parseInt(e.target.value, 10) || 1)}
            className="w-32 mt-1"
          />
        </div>

        <div>
          <Label>Temps estimé retrait (min)</Label>
          <Input
            type="number"
            step="1"
            min="1"
            value={settings.estimatedPickupTime}
            onChange={(e) => update('estimatedPickupTime', parseInt(e.target.value, 10) || 1)}
            className="w-32 mt-1"
          />
        </div>

        <div className="card-premium p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Mode rush activé</p>
            <p className="text-xs text-muted-foreground">
              Affiche un message d’affluence après commande et dans l’email de confirmation
            </p>
          </div>
          <button
            type="button"
            onClick={() => update('rushModeEnabled', !settings.rushModeEnabled)}
            className={`h-6 w-11 rounded-full transition-colors ${settings.rushModeEnabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-foreground transition-transform ${settings.rushModeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}