import ClientLayout from '@/components/client/ClientLayout';
import { SITE_CONFIG } from '@/config/menu';

export default function ConfidentialitePage() {
  return (
    <ClientLayout>
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Politique de confidentialité</h1>
        <div className="mt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Données collectées</h2>
            <p>Lors d'une commande, nous collectons : nom, téléphone, email, adresse de livraison. Ces données sont nécessaires au traitement de votre commande.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Utilisation</h2>
            <p>Vos données sont utilisées exclusivement pour la gestion de votre commande et la communication liée à celle-ci. Elles ne sont jamais vendues ni transmises à des tiers non liés à la prestation.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Paiement</h2>
            <p>Les paiements sont traités par Stripe. Nous ne stockons aucune donnée bancaire. Consultez la politique de confidentialité de Stripe pour plus d'informations.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Vos droits</h2>
            <p>Conformément au RGPD, vous disposez d'un droit d'accès, de modification et de suppression de vos données. Contactez-nous à {SITE_CONFIG.email}.</p>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}
