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

  const update = (field: keyof SiteSettingsForm, value: string) => {
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