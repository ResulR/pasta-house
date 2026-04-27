import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Package, Tag, Coffee, Clock, Truck, Settings, Menu, X, LogOut } from 'lucide-react';
import { adminFetch } from '@/lib/adminCsrf';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Commandes', path: '/admin/commandes', icon: ClipboardList },
  { label: 'Produits', path: '/admin/produits', icon: Package },
  { label: 'Catégories', path: '/admin/categories', icon: Tag },
  { label: 'Boissons', path: '/admin/boissons', icon: Coffee },
  { label: 'Horaires', path: '/admin/horaires', icon: Clock },
  { label: 'Livraison', path: '/admin/livraison', icon: Truck },
  { label: 'Paramètres', path: '/admin/parametres', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);

      await adminFetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      navigate('/admin/login', { replace: true });
    } catch (error) {
      console.error('Admin logout error:', error);
      navigate('/admin/login', { replace: true });
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-background/60 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card transform transition-transform md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link to="/admin" className="font-display text-lg font-bold text-primary">Admin</Link>
          <button onClick={() => setMobileOpen(false)} className="md:hidden"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex h-[calc(100%-3.5rem)] flex-col">
          <nav className="p-3 space-y-1 flex-1">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-3 space-y-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {logoutLoading ? 'Déconnexion...' : 'Se déconnecter'}
            </button>

            <Link
              to="/"
              className="block px-3 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Retour au site
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center border-b border-border px-4 md:px-6">
          <button onClick={() => setMobileOpen(true)} className="mr-3 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">Pasta House — Admin</h1>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
