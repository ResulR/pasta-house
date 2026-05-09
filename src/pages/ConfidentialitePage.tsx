import { useEffect, useState } from 'react';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu } from '@/lib/menu-api';

export default function ConfidentialitePage() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const data = await fetchPublicMenu();

        if (!isMounted) return;

        setEmail(data.siteSettings?.email || '');
      } catch (error) {
        console.error('Failed to load privacy settings:', error);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const contactEmail = email.trim() || 'Non renseigné';

  return (
    <ClientLayout>
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Politique de confidentialité</h1>
        <div className="mt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Données collectées</h2>
            <p>Lors d&apos;une commande, nous collectons : nom, téléphone, email et adresse de livraison. Ces données sont nécessaires au traitement de votre commande.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Utilisation</h2>
            <p>Vos données sont utilisées exclusivement pour la gestion de votre commande et la communication liée à celle-ci. Elles ne sont jamais vendues ni transmises à des tiers non liés à la prestation.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Paiement</h2>
            <p>Les paiements sont traités par Stripe. Nous ne stockons aucune donnée bancaire. Consultez la politique de confidentialité de Stripe pour plus d&apos;informations.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Vos droits</h2>
            <p>Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de modification et de suppression de vos données. Contactez-nous à {contactEmail}.</p>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}
