import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicMenu } from '@/lib/menu-api';

export default function Footer() {
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('Bruxelles');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchPublicMenu();
        if (!isMounted) return;
        if (data.siteSettings?.restaurantName) setRestaurantName(data.siteSettings.restaurantName);
        const parts = [data.siteSettings?.addressLine1, data.siteSettings?.postalCode, data.siteSettings?.city].filter(Boolean);
        if (parts.length) setAddressLine(parts.join(', '));
        if (data.siteSettings?.phone) setPhone(data.siteSettings.phone);
      } catch (e) {
        console.error('Footer load:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer className="mt-24 border-t border-border/70 surface-warm">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
                ph
              </span>
              <span className="font-display text-[1.45rem] leading-none">{restaurantName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Des pâtes fraîches et des paninis généreux, préparés chaque soir avec soin et livrés chez vous.
            </p>
          </div>

          <div className="md:col-span-3">
            <p className="eyebrow">Nous trouver</p>
            <p className="mt-3 text-sm text-foreground leading-relaxed">{addressLine}</p>
            {phone && <p className="mt-1 text-sm text-muted-foreground">{phone}</p>}
          </div>

          <div className="md:col-span-2">
            <p className="eyebrow">Menu</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/" className="text-foreground/80 hover:text-primary transition-colors">Accueil</Link></li>
              <li><Link to="/commander" className="text-foreground/80 hover:text-primary transition-colors">Commander</Link></li>
              <li><Link to="/contact" className="text-foreground/80 hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="eyebrow">Légal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/mentions-legales" className="text-muted-foreground hover:text-foreground transition-colors">Mentions légales</Link></li>
              <li><Link to="/confidentialite" className="text-muted-foreground hover:text-foreground transition-colors">Confidentialité</Link></li>
              <li><Link to="/cgv" className="text-muted-foreground hover:text-foreground transition-colors">CGV</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col-reverse items-start gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} {restaurantName}. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground">
            Préparé avec soin · Livraison à Bruxelles
          </p>
        </div>
      </div>
    </footer>
  );
}