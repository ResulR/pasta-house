import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from '@/lib/adminCsrf';

interface LoginResponse {
  ok: boolean;
  admin?: {
    id: number;
    email: string;
    fullName: string | null;
  };
  message?: string;
}

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await adminFetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || 'Connexion impossible.');
        return;
      }

      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Connexion admin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour accéder à l’administration de Pasta House.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="admin@pastahouse.com"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-foreground">
              Mot de passe
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}