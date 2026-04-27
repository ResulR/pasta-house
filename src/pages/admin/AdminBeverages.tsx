import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminFetch } from '@/lib/adminCsrf';

interface AdminBeverageItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  order: number;
  active: boolean;
  menuEligible: boolean;
}

interface AdminBeveragesResponse {
  ok: boolean;
  data?: {
    beverages: AdminBeverageItem[];
  };
  message?: string;
  error?: string;
}

interface ToggleBeverageActiveResponse {
  ok: boolean;
  data?: {
    id: string;
    active: boolean;
  };
  message?: string;
  error?: string;
}

interface UpdateBeverageResponse {
  ok: boolean;
  data?: AdminBeverageItem;
  message?: string;
  error?: string;
}

interface CreateBeverageResponse {
  ok: boolean;
  data?: AdminBeverageItem;
  message?: string;
  error?: string;
}

interface DeleteBeverageResponse {
  ok: boolean;
  data?: {
    id: string;
  };
  message?: string;
  error?: string;
}

export default function AdminBeverages() {
  const [beverages, setBeverages] = useState<AdminBeverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editingBeverageId, setEditingBeverageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOrder, setEditOrder] = useState('0');
  const [editActive, setEditActive] = useState(true);
  const [editMenuEligible, setEditMenuEligible] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const [creatingBeverage, setCreatingBeverage] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createOrder, setCreateOrder] = useState('');
  const [createActive, setCreateActive] = useState(true);
  const [createMenuEligible, setCreateMenuEligible] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);

  const [deletingBeverageId, setDeletingBeverageId] = useState<string | null>(null);

  const fetchAdminBeverages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/beverages', {
        method: 'GET',
        credentials: 'include',
      });

      const data: AdminBeveragesResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de charger les boissons.');
        return;
      }

      setBeverages(data.data.beverages);
    } catch (err) {
      console.error('Admin beverages fetch error:', err);
      setError('Impossible de charger les boissons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminBeverages();
  }, []);

  const sortedBeverages = useMemo(
    () => [...beverages].sort((a, b) => a.order - b.order),
    [beverages],
  );

  const resetCreateForm = () => {
    setCreateName('');
    setCreatePrice('');
    setCreateOrder('');
    setCreateActive(true);
    setCreateMenuEligible(true);
    setSavingCreate(false);
  };

  const startEditBeverage = (beverage: AdminBeverageItem) => {
    setError(null);
    setSuccessMessage(null);
    setEditingBeverageId(beverage.id);
    setEditName(beverage.name);
    setEditPrice(String(beverage.price));
    setEditOrder(String(beverage.order));
    setEditActive(beverage.active);
    setEditMenuEligible(beverage.menuEligible);
  };

  const cancelEditBeverage = () => {
    setEditingBeverageId(null);
    setEditName('');
    setEditPrice('');
    setEditOrder('0');
    setEditActive(true);
    setEditMenuEligible(true);
    setSavingEdit(false);
  };

  const toggleActive = async (id: string) => {
    const currentBeverage = beverages.find((beverage) => beverage.id === id);

    if (!currentBeverage) {
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/beverages/${id}/active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          active: !currentBeverage.active,
        }),
      });

      const data: ToggleBeverageActiveResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier la boisson.');
        return;
      }

      setBeverages((prev) =>
        prev.map((beverage) =>
          beverage.id === id ? { ...beverage, active: data.data!.active } : beverage,
        ),
      );
    } catch (err) {
      console.error('Admin toggle beverage active error:', err);
      setError('Impossible de modifier la boisson.');
    }
  };

  const saveEditBeverage = async () => {
    if (!editingBeverageId) {
      return;
    }

    const parsedPrice = Number(editPrice);
    const parsedOrder = Number(editOrder);

    if (!editName.trim()) {
      setError('Le nom de la boisson est obligatoire.');
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Le prix doit être un nombre supérieur ou égal à 0.');
      return;
    }

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setError("L'ordre doit être un nombre entier supérieur ou égal à 0.");
      return;
    }

    try {
      setSavingEdit(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/beverages/${editingBeverageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editName,
          price: parsedPrice,
          order: parsedOrder,
          active: editActive,
          menuEligible: editMenuEligible,
        }),
      });

      const data: UpdateBeverageResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier la boisson.');
        return;
      }

      setBeverages((prev) =>
        prev.map((beverage) =>
          beverage.id === editingBeverageId ? data.data! : beverage,
        ),
      );

      setSuccessMessage('Boisson mise à jour avec succès.');
      cancelEditBeverage();
    } catch (err) {
      console.error('Admin update beverage error:', err);
      setError('Impossible de modifier la boisson.');
      setSavingEdit(false);
    }
  };

  const createBeverage = async () => {
    if (!createName.trim()) {
      setError('Le nom de la boisson est obligatoire.');
      return;
    }

    const parsedPrice = Number(createPrice);
    const parsedOrder = createOrder.trim() === '' ? null : Number(createOrder);

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Le prix doit être un nombre supérieur ou égal à 0.');
      return;
    }

    if (parsedOrder !== null && (!Number.isInteger(parsedOrder) || parsedOrder < 0)) {
      setError("L'ordre doit être un nombre entier supérieur ou égal à 0.");
      return;
    }

    try {
      setSavingCreate(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch('/api/admin/beverages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: createName,
          price: parsedPrice,
          order: parsedOrder,
          active: createActive,
          menuEligible: createMenuEligible,
        }),
      });

      const data: CreateBeverageResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de créer la boisson.');
        return;
      }

      setBeverages((prev) => [...prev, data.data!]);
      setSuccessMessage('Boisson créée avec succès.');
      resetCreateForm();
      setCreatingBeverage(false);
    } catch (err) {
      console.error('Admin create beverage error:', err);
      setError('Impossible de créer la boisson.');
    } finally {
      setSavingCreate(false);
    }
  };

  const deleteBeverage = async (id: string) => {
    const currentBeverage = beverages.find((beverage) => beverage.id === id);

    if (!currentBeverage) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement la boisson "${currentBeverage.name}" ? Cette action est irréversible.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingBeverageId(id);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/beverages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: DeleteBeverageResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de supprimer la boisson.');
        return;
      }

      setBeverages((prev) => prev.filter((beverage) => beverage.id !== id));

      if (editingBeverageId === id) {
        cancelEditBeverage();
      }

      setSuccessMessage('Boisson supprimée avec succès.');
    } catch (err) {
      console.error('Admin delete beverage error:', err);
      setError('Impossible de supprimer la boisson.');
    } finally {
      setDeletingBeverageId(null);
    }
  };

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Boissons</h2>

      <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-muted-foreground">
          Gérez les boissons disponibles, leur prix et leur éligibilité au menu.
        </p>

        <Button
          onClick={() => {
            if (creatingBeverage) {
              resetCreateForm();
              setSuccessMessage(null);
              setCreatingBeverage(false);
              return;
            }

            setError(null);
            setSuccessMessage(null);
            setCreatingBeverage(true);
          }}
        >
          {creatingBeverage ? 'Fermer' : 'Ajouter une boisson'}
        </Button>
      </div>

      {creatingBeverage && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Ajouter une boisson</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Créez une nouvelle boisson avec son prix et ses réglages.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nom
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Prix (€)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={createPrice}
                onChange={(e) => setCreatePrice(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Ordre
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={createOrder}
                onChange={(e) => setCreateOrder(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Laisser vide pour auto"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={createMenuEligible}
                  onChange={(e) => setCreateMenuEligible(e.target.checked)}
                />
                Autorisée dans le menu panini
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={createBeverage} disabled={savingCreate}>
              {savingCreate ? 'Création...' : 'Créer la boisson'}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                resetCreateForm();
                setCreatingBeverage(false);
                setSuccessMessage(null);
              }}
              disabled={savingCreate}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground mt-6">
          Chargement des boissons...
        </p>
      )}

      {!loading && error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && successMessage && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <p className="text-sm text-primary">{successMessage}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 space-y-2">
          {sortedBeverages.map((beverage) => (
            <div key={beverage.id} className="space-y-2">
              <div className={`card-premium p-4 ${!beverage.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{beverage.name}</h3>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          beverage.active
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {beverage.active ? 'Active' : 'Inactive'}
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          beverage.menuEligible
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {beverage.menuEligible ? 'Menu autorisé' : 'Menu interdit'}
                      </span>
                    </div>

                    <div className="flex gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
                      <span>
                        Prix : <span className="font-medium text-foreground">{beverage.price.toFixed(2)} €</span>
                      </span>
                      <span>
                        Ordre : <span className="font-medium text-foreground">{beverage.order}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditBeverage(beverage)}
                      disabled={deletingBeverageId === beverage.id}
                    >
                      Modifier
                    </Button>

                    <Button
                      size="sm"
                      variant={beverage.active ? 'outline' : 'default'}
                      onClick={() => toggleActive(beverage.id)}
                      disabled={deletingBeverageId === beverage.id}
                    >
                      {beverage.active ? 'Désactiver' : 'Activer'}
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteBeverage(beverage.id)}
                      disabled={deletingBeverageId === beverage.id}
                    >
                      {deletingBeverageId === beverage.id ? 'Suppression...' : 'Supprimer'}
                    </Button>
                  </div>
                </div>
              </div>

              {editingBeverageId === beverage.id && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">Modifier la boisson</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Modifiez ici les champs de la boisson sélectionnée.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Nom
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Prix (€)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Ordre
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                        Active
                      </label>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={editMenuEligible}
                          onChange={(e) => setEditMenuEligible(e.target.checked)}
                        />
                        Autorisée dans le menu panini
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveEditBeverage} disabled={savingEdit}>
                      {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={cancelEditBeverage}
                      disabled={savingEdit}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sortedBeverages.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Aucune boisson disponible.
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Note : cette liste est maintenant chargée depuis le backend et les actions modifient réellement les boissons en base.
      </p>
    </div>
  );
}