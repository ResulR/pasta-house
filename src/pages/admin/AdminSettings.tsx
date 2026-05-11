import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminFetch } from '@/lib/adminCsrf';

interface SiteSettingsForm {
  restaurantName: string;
  phone: string;
  email: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
  legalName: string;
  vatNumber: string;
  ordersEnabled: boolean;
  ordersDisabledReason: string;
}

interface AdminSettingsResponse {
  ok: boolean;
  data?: SiteSettingsForm & { id?: string };
  message?: string;
  error?: string;
}

interface UpdateSettingsResponse {
  ok: boolean;
  data?: SiteSettingsForm & { id?: string };
  message?: string;
  error?: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/settings', {
        method: 'GET',
        credentials: 'include',
      });

      const data: AdminSettingsResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de charger les paramètres du site.');
        return;
      }

      setSettings({
        restaurantName: data.data.restaurantName,
        phone: data.data.phone,
        email: data.data.email,
        addressLine1: data.data.addressLine1,
        postalCode: data.data.postalCode,
        city: data.data.city,
        country: data.data.country,
        legalName: data.data.legalName,
        vatNumber: data.data.vatNumber,
        ordersEnabled: data.data.ordersEnabled,
        ordersDisabledReason: data.data.ordersDisabledReason,
      });
    } catch (err) {
      console.error('Admin settings fetch error:', err);
      setError('Impossible de charger les paramètres du site.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const update = (field: keyof SiteSettingsForm, value: string | boolean) => {
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

      const response = await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      const data: UpdateSettingsResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de sauvegarder les paramètres du site.');
        return;
      }

      setSettings({
        restaurantName: data.data.restaurantName,
        phone: data.data.phone,
        email: data.data.email,
        addressLine1: data.data.addressLine1,
        postalCode: data.data.postalCode,
        city: data.data.city,
        country: data.data.country,
        legalName: data.data.legalName,
        vatNumber: data.data.vatNumber,
        ordersEnabled: data.data.ordersEnabled,
        ordersDisabledReason: data.data.ordersDisabledReason,
      });
      setSuccessMessage(data.message || 'Paramètres du site mis à jour avec succès.');
    } catch (err) {
      console.error('Admin settings save error:', err);
      setError('Impossible de sauvegarder les paramètres du site.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-xl font-bold">Paramètres</h2>
        <p className="text-sm text-muted-foreground mt-6">Chargement des paramètres...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-xl font-bold">Paramètres</h2>
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {error || 'Impossible de charger les paramètres du site.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl font-bold">Paramètres</h2>

      <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-muted-foreground">
          Gérez les informations réelles du restaurant utilisées par le site.
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

      <div className="mt-6 card-premium p-4 space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Prise de commandes</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Désactivez ce bouton pour fermer immédiatement les commandes côté client et API.
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={settings.ordersEnabled}
                onChange={(e) => update('ordersEnabled', e.target.checked)}
                className="h-4 w-4"
              />
              {settings.ordersEnabled ? 'Ouvert' : 'Fermé'}
            </label>
          </div>

          {!settings.ordersEnabled && (
            <div className="mt-4">
              <Label>Message affiché aux clients</Label>
              <Input
                value={settings.ordersDisabledReason}
                onChange={(e) => update('ordersDisabledReason', e.target.value)}
                placeholder="Exemple : Les commandes sont temporairement fermées."
                className="mt-1"
              />
            </div>
          )}
        </div>

        <div>
          <Label>Nom du restaurant</Label>
          <Input
            value={settings.restaurantName}
            onChange={(e) => update('restaurantName', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Téléphone</Label>
          <Input
            value={settings.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Email</Label>
          <Input
            value={settings.email}
            onChange={(e) => update('email', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Adresse</Label>
          <Input
            value={settings.addressLine1}
            onChange={(e) => update('addressLine1', e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Code postal</Label>
            <Input
              value={settings.postalCode}
              onChange={(e) => update('postalCode', e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Ville</Label>
            <Input
              value={settings.city}
              onChange={(e) => update('city', e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Pays</Label>
            <Input
              value={settings.country}
              onChange={(e) => update('country', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Raison sociale</Label>
          <Input
            value={settings.legalName}
            onChange={(e) => update('legalName', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>N° TVA</Label>
          <Input
            value={settings.vatNumber}
            onChange={(e) => update('vatNumber', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}