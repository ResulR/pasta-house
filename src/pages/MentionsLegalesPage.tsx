import { useEffect, useMemo, useState } from 'react';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu } from '@/lib/menu-api';

type LegalSettings = {
  restaurantName: string;
  phone: string;
  email: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
  legalName: string;
  vatNumber: string;
};

const FALLBACK_SETTINGS: LegalSettings = {
  restaurantName: 'Pasta House',
  phone: '',
  email: '',
  addressLine1: '',
  postalCode: '',
  city: '',
  country: 'Belgique',
  legalName: '',
  vatNumber: '',
};

function displayValue(value: string) {
  return value.trim() || 'Non renseigné';
}

export default function MentionsLegalesPage() {
  const [settings, setSettings] = useState<LegalSettings>(FALLBACK_SETTINGS);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const data = await fetchPublicMenu();

        if (!isMounted) return;

        setSettings({
          restaurantName: data.siteSettings?.restaurantName || FALLBACK_SETTINGS.restaurantName,
          phone: data.siteSettings?.phone || '',
          email: data.siteSettings?.email || '',
          addressLine1: data.siteSettings?.addressLine1 || '',
          postalCode: data.siteSettings?.postalCode || '',
          city: data.siteSettings?.city || '',
          country: data.siteSettings?.country || FALLBACK_SETTINGS.country,
          legalName: data.siteSettings?.legalName || '',
          vatNumber: data.siteSettings?.vatNumber || '',
        });
      } catch (error) {
        console.error('Failed to load legal settings:', error);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const address = useMemo(() => {
    return [settings.addressLine1, settings.postalCode, settings.city, settings.country]
      .filter((part) => part && part.trim())
      .join(', ');
  }, [settings]);

  return (
    <ClientLayout>
      <div className="container py-10 max-w-2xl prose-invert">
        <h1 className="font-display text-2xl font-bold">Mentions légales</h1>
        <div className="mt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Éditeur du site</h2>
            <p>Nom commercial : {displayValue(settings.restaurantName)}</p>
            <p>Raison sociale : {displayValue(settings.legalName)}</p>
            <p>Adresse : {displayValue(address)}</p>
            <p>Téléphone : {displayValue(settings.phone)}</p>
            <p>Email : {displayValue(settings.email)}</p>
            <p>Numéro TVA : {displayValue(settings.vatNumber)}</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Hébergement</h2>
            <p>OVH SAS — 2 Rue Kellermann, 59100 Roubaix, France</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Propriété intellectuelle</h2>
            <p>L&apos;ensemble des contenus présents sur ce site, notamment les textes, images, logo et graphismes, est protégé par le droit d&apos;auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}
