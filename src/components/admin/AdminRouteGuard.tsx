import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

interface MeResponse {
  ok: boolean;
  admin?: {
    id: number;
    email: string;
    fullName: string | null;
    lastLoginAt: string | null;
  };
  message?: string;
}

export default function AdminRouteGuard() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        setLoading(true);

        const response = await fetch('/api/admin/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        const data: MeResponse = await response.json();

        if (!cancelled) {
          setIsAuthenticated(response.ok && data.ok);
        }
      } catch (error) {
        console.error('Admin auth check error:', error);
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Vérification de la session admin...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}