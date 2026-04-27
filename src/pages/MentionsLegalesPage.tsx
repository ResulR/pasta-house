import ClientLayout from '@/components/client/ClientLayout';
import { SITE_CONFIG } from '@/config/menu';

export default function MentionsLegalesPage() {
  return (
    <ClientLayout>
      <div className="container py-10 max-w-2xl prose-invert">
        <h1 className="font-display text-2xl font-bold">Mentions légales</h1>
        <div className="mt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Éditeur du site</h2>
            <p>Raison sociale : {SITE_CONFIG.legalName}</p>
            <p>Adresse : {SITE_CONFIG.address}</p>
            <p>Téléphone : {SITE_CONFIG.phone}</p>
            <p>Email : {SITE_CONFIG.email}</p>
            <p>Numéro TVA : {SITE_CONFIG.vatNumber}</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Hébergement</h2>
            <p>OVH SAS — 2 Rue Kellermann, 59100 Roubaix, France</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Propriété intellectuelle</h2>
            <p>L'ensemble des contenus présents sur ce site (textes, images, logo, graphismes) est protégé par le droit d'auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}
