import { useEffect, useState } from 'react';
import ClientLayout from '@/components/client/ClientLayout';
import { SITE_CONFIG } from '@/config/menu';
import { fetchPublicMenu, formatPriceFromCents } from '@/lib/menu-api';

export default function CGVPage() {
  const [restaurantName, setRestaurantName] = useState(SITE_CONFIG.restaurantName);
  const [email, setEmail] = useState(SITE_CONFIG.email);
  const [phone, setPhone] = useState(SITE_CONFIG.phone);
  const [deliveryZoneLabel, setDeliveryZoneLabel] = useState('Bruxelles');
  const [deliveryFeeLabel, setDeliveryFeeLabel] = useState<string | null>(null);
  const [minimumOrderLabel, setMinimumOrderLabel] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLegalData() {
      try {
        const data = await fetchPublicMenu();

        if (!isMounted) return;

        if (data.siteSettings?.restaurantName) {
          setRestaurantName(data.siteSettings.restaurantName);
        }

        if (data.siteSettings?.email) {
          setEmail(data.siteSettings.email);
        }

        if (data.siteSettings?.phone) {
          setPhone(data.siteSettings.phone);
        }

        if (data.deliverySettings?.deliveryZoneLabel) {
          setDeliveryZoneLabel(data.deliverySettings.deliveryZoneLabel);
        }

        if (typeof data.deliverySettings?.deliveryFeeCents === 'number') {
          setDeliveryFeeLabel(formatPriceFromCents(data.deliverySettings.deliveryFeeCents));
        }

        if (typeof data.deliverySettings?.minimumOrderCents === 'number') {
          setMinimumOrderLabel(formatPriceFromCents(data.deliverySettings.minimumOrderCents));
        }
      } catch (error) {
        console.error('Failed to load CGV settings:', error);
      }
    }

    loadLegalData();

    return () => {
      isMounted = false;
    };
  }, []);

  const deliveryText =
    deliveryFeeLabel && minimumOrderLabel
      ? `La livraison est disponible dans la zone définie (${deliveryZoneLabel}). Des frais de livraison de ${deliveryFeeLabel} s'appliquent. Un minimum de commande de ${minimumOrderLabel} est requis pour la livraison.`
      : `La livraison est disponible dans la zone définie (${deliveryZoneLabel}). Les frais de livraison et le minimum de commande applicables sont indiqués avant la validation de la commande.`;

  return (
    <ClientLayout>
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Conditions Générales de Vente</h1>
        <div className="mt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Objet</h2>
            <p>Les présentes conditions régissent les ventes de produits alimentaires par {restaurantName} via son site de commande en ligne.</p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Commandes</h2>
            <p>Toute commande implique l&apos;acceptation des présentes CGV. Le client s&apos;engage à fournir des informations exactes. La commande est confirmée après paiement réussi.</p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Prix</h2>
            <p>Les prix sont indiqués en euros TTC. {restaurantName} se réserve le droit de modifier ses prix à tout moment. Les prix applicables sont ceux en vigueur au moment de la commande.</p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Livraison</h2>
            <p>{deliveryText}</p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Paiement</h2>
            <p>Le paiement s&apos;effectue en ligne par carte bancaire via la plateforme sécurisée Stripe.</p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Annulation</h2>
            <p>En raison de la nature périssable des produits, aucune annulation n&apos;est possible une fois la commande confirmée et le paiement effectué, sauf accord du restaurant.</p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Contact</h2>
            <p>Pour toute question : {email} / {phone}</p>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}
