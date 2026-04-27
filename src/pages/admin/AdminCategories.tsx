import { useEffect, useState } from 'react';
import type { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { adminFetch } from '@/lib/adminCsrf';

interface AdminCategoriesResponse {
  ok: boolean;
  data?: {
    categories: Category[];
  };
  message?: string;
  error?: string;
}

interface UpdateCategoryActiveResponse {
  ok: boolean;
  data?: {
    id: string;
    active: boolean;
  };
  message?: string;
  error?: string;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/categories', {
        method: 'GET',
        credentials: 'include',
      });

      const data: AdminCategoriesResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de charger les catégories.');
        return;
      }

      setCategories(data.data.categories);
    } catch (err) {
      console.error('Admin categories fetch error:', err);
      setError('Impossible de charger les catégories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleActive = async (category: Category) => {
    try {
      setTogglingCategoryId(category.id);
      setError(null);

      const response = await adminFetch(`/api/admin/categories/${category.id}/active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          active: !category.active,
        }),
      });

      const data: UpdateCategoryActiveResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier la catégorie.');
        return;
      }

      setCategories((prev) =>
        prev.map((item) =>
          item.id === category.id ? { ...item, active: data.data!.active } : item
        )
      );
    } catch (err) {
      console.error('Admin category toggle error:', err);
      setError('Impossible de modifier la catégorie.');
    } finally {
      setTogglingCategoryId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="font-display text-xl font-bold">Catégories</h2>
        <p className="text-sm text-muted-foreground mt-6">Chargement des catégories...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Catégories</h2>

      <p className="text-sm text-muted-foreground mt-1">
        Activez ou désactivez les catégories visibles dans le menu public.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {categories
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((cat) => (
            <div
              key={cat.id}
              className={`card-premium p-4 flex items-center justify-between ${!cat.active ? 'opacity-50' : ''}`}
            >
              <div>
                <h3 className="font-medium">{cat.name}</h3>
                <p className="text-xs text-muted-foreground">Ordre : {cat.order}</p>
              </div>

              <Button
                size="sm"
                variant={cat.active ? 'outline' : 'default'}
                onClick={() => toggleActive(cat)}
                disabled={togglingCategoryId === cat.id}
              >
                {togglingCategoryId === cat.id
                  ? 'Enregistrement...'
                  : cat.active
                    ? 'Désactiver'
                    : 'Activer'}
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}