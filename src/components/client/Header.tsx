import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { SITE_CONFIG } from '@/config/menu';

export default function Header() {
  const { itemCount } = useCart();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { to: '/', label: 'Accueil' },
    { to: '/commander', label: 'Commander' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ease-out-soft ${
        scrolled
          ? 'bg-background/85 backdrop-blur-md border-b border-border/70 shadow-xs'
          : 'bg-background/0 border-b border-transparent'
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link
          to="/"
          className="group flex items-center gap-2 text-foreground"
          aria-label={`${SITE_CONFIG.restaurantName} — accueil`}
        >
          <img
            src="/pasta-house-logo.png"
            alt={SITE_CONFIG.restaurantName}
            className="h-12 w-auto max-w-[190px] object-contain sm:h-14 sm:max-w-[230px]"
          />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const active = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className="hidden sm:inline-flex link-underline px-2 py-1 text-[0.85rem] font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-active={active}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            to="/commander"
            className="relative ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-all duration-200 hover:border-primary/40 hover:text-primary hover:shadow-xs"
            aria-label={`Panier — ${itemCount} article${itemCount > 1 ? 's' : ''}`}
          >
            <ShoppingBag className="h-[17px] w-[17px]" strokeWidth={1.6} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
                {itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}