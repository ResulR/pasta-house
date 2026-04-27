import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatPrice, SIZE_LABELS } from '@/config/menu';
import type { Category, Product, PastaVariant, PaniniVariant } from '@/types';
import { Button } from '@/components/ui/button';
import { adminFetch } from '@/lib/adminCsrf';

interface AdminVariantBase {
  id: string;
  code: string;
  name: string;
  price: number;
  active: boolean;
}

type AdminPastaVariant = PastaVariant & AdminVariantBase;
type AdminPaniniVariant = PaniniVariant & AdminVariantBase;

interface AdminProductItem extends Omit<Product, 'variants'> {
  available?: boolean;
  variants: (AdminPastaVariant | AdminPaniniVariant)[];
}

interface AdminProductsResponse {
  ok: boolean;
  data?: {
    categories: Category[];
    products: AdminProductItem[];
  };
  message?: string;
  error?: string;
}

interface ToggleProductActiveResponse {
  ok: boolean;
  data?: {
    id: string;
    active: boolean;
  };
  message?: string;
  error?: string;
}

interface ToggleProductAvailabilityResponse {
  ok: boolean;
  data?: {
    id: string;
    available: boolean;
  };
  message?: string;
  error?: string;
}

interface UpdateProductDetailsResponse {
  ok: boolean;
  data?: {
    id: string;
    categoryId: string;
    name: string;
    description: string;
    active: boolean;
    available?: boolean;
    order: number;
    featured: boolean;
  };
  message?: string;
  error?: string;
}

interface UpdateProductVariantsResponse {
  ok: boolean;
  data?: {
    productId: string;
    variants: (AdminPastaVariant | AdminPaniniVariant)[];
  };
  message?: string;
  error?: string;
}

interface DeleteProductResponse {
  ok: boolean;
  data?: {
    id: string;
  };
  message?: string;
  error?: string;
}

interface CreateProductResponse {
  ok: boolean;
  data?: AdminProductItem;
  message?: string;
  error?: string;
}

interface CreateVariantDraft {
  code: string;
  name: string;
  price: string;
  active: boolean;
  isDefault: boolean;
}

export default function AdminProducts() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOrder, setEditOrder] = useState('0');
  const [editFeatured, setEditFeatured] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editVariants, setEditVariants] = useState<(AdminPastaVariant | AdminPaniniVariant)[]>([]);
  const [savingVariants, setSavingVariants] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createOrder, setCreateOrder] = useState('');
  const [createFeatured, setCreateFeatured] = useState(false);
  const [createActive, setCreateActive] = useState(true);
  const [createAvailable, setCreateAvailable] = useState(true);
  const [createVariants, setCreateVariants] = useState<CreateVariantDraft[]>([]);
  const [savingCreate, setSavingCreate] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [openCategoryIds, setOpenCategoryIds] = useState<string[]>([]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const fetchAdminProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      

      const response = await fetch('/api/admin/products', {
        method: 'GET',
        credentials: 'include',
      });

      const data: AdminProductsResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de charger les produits.');
        return;
      }

      setCategories(data.data.categories);
      setProducts(data.data.products);
    } catch (err) {
      console.error('Admin products fetch error:', err);
      setError('Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProducts();
  }, []);

    const buildDefaultVariantsForCategory = (categoryId: string): CreateVariantDraft[] => {
    const category = categories.find((item) => item.id === categoryId);

    if (!category) {
      return [];
    }

    const normalizedSlug = category.slug?.toLowerCase();

    if (normalizedSlug === 'pates') {
      return [
        {
          code: 'ravier',
          name: 'Ravier',
          price: '',
          active: true,
          isDefault: true,
        },
        {
          code: 'assiette',
          name: 'Assiette',
          price: '',
          active: true,
          isDefault: false,
        },
      ];
    }

    if (normalizedSlug === 'paninis') {
      return [
        {
          code: 'seul',
          name: 'Seul',
          price: '',
          active: true,
          isDefault: true,
        },
        {
          code: 'menu',
          name: 'Menu',
          price: '',
          active: true,
          isDefault: false,
        },
      ];
    }

    return [];
  };

  const resetCreateForm = () => {
    setCreateCategoryId('');
    setCreateName('');
    setCreateDescription('');
    setCreateOrder('');
    setCreateFeatured(false);
    setCreateActive(true);
    setCreateAvailable(true);
    setCreateVariants([]);
    setSavingCreate(false);
  };

  const handleCreateCategoryChange = (categoryId: string) => {
    setCreateCategoryId(categoryId);
    setCreateVariants(buildDefaultVariantsForCategory(categoryId));
  };

  const updateCreateVariantPrice = (variantCode: string, value: string) => {
    setCreateVariants((prev) =>
      prev.map((variant) =>
        variant.code === variantCode
          ? {
              ...variant,
              price: value,
            }
          : variant,
      ),
    );
  };

  const updateCreateVariantActive = (variantCode: string, active: boolean) => {
    setCreateVariants((prev) =>
      prev.map((variant) =>
        variant.code === variantCode
          ? {
              ...variant,
              active,
            }
          : variant,
      ),
    );
  };

  const toggleActive = async (id: string) => {
    const currentProduct = products.find((p) => p.id === id);

    if (!currentProduct) {
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/products/${id}/active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          active: !currentProduct.active,
        }),
      });

      const data: ToggleProductActiveResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier le produit.');
        return;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, active: data.data!.active } : p,
        ),
      );
    } catch (err) {
      console.error('Admin toggle product active error:', err);
      setError('Impossible de modifier le produit.');
    }
  };

    const toggleAvailability = async (id: string) => {
    const currentProduct = products.find((p) => p.id === id);

    if (!currentProduct) {
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/products/${id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          available: !currentProduct.available,
        }),
      });

      const data: ToggleProductAvailabilityResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier la disponibilité du produit.');
        return;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, available: data.data!.available } : p,
        ),
      );
    } catch (err) {
      console.error('Admin toggle product availability error:', err);
      setError('Impossible de modifier la disponibilité du produit.');
    }
  };

  const startEditProduct = (product: AdminProductItem) => {
    setError(null);
    setSuccessMessage(null);
    setEditingProductId(product.id);
    setEditName(product.name);
    setEditDescription(product.description);
    setEditOrder(String(product.order));
    setEditFeatured(product.featured);
    setEditVariants(product.variants.map((variant) => ({ ...variant })));
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setEditName('');
    setEditDescription('');
    setEditOrder('0');
    setEditFeatured(false);
    setEditVariants([]);
    setSavingEdit(false);
    setSavingVariants(false);
  };

  const saveEditProduct = async () => {
    if (!editingProductId) {
      return;
    }

    const parsedOrder = Number(editOrder);

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setError("L'ordre doit être un nombre entier supérieur ou égal à 0.");
      return;
    }

    try {
      setSavingEdit(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/products/${editingProductId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          order: parsedOrder,
          featured: editFeatured,
        }),
      });

      const data: UpdateProductDetailsResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier le produit.');
        return;
      }

      setProducts((prev) =>
        prev.map((product) =>
          product.id === editingProductId
            ? {
                ...product,
                name: data.data!.name,
                description: data.data!.description,
                order: data.data!.order,
                featured: data.data!.featured,
                active: data.data!.active,
                available: data.data!.available,
              }
            : product,
        ),
      );
      setSuccessMessage('Produit mis à jour avec succès.');

      cancelEditProduct();
    } catch (err) {
      console.error('Admin update product details error:', err);
      setError('Impossible de modifier le produit.');
      setSavingEdit(false);
    }
  };

    const updateEditVariantPrice = (variantId: string, value: string) => {
    setEditVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              price: value === '' ? 0 : Number(value),
            }
          : variant,
      ),
    );
  };

  const updateEditVariantActive = (variantId: string, active: boolean) => {
    setEditVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              active,
            }
          : variant,
      ),
    );
  };

  const saveEditVariants = async () => {
    if (!editingProductId) {
      return;
    }

    if (editVariants.some((variant) => Number.isNaN(variant.price) || variant.price < 0)) {
      setError('Chaque prix de variante doit être un nombre supérieur ou égal à 0.');
      return;
    }

    try {
      setSavingVariants(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch(`/api/admin/products/${editingProductId}/variants`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          variants: editVariants.map((variant) => ({
            id: variant.id,
            price: variant.price,
            active: variant.active,
          })),
        }),
      });

      const data: UpdateProductVariantsResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de modifier les variantes.');
        return;
      }

      setProducts((prev) =>
        prev.map((product) =>
          product.id === editingProductId
            ? {
                ...product,
                variants: data.data!.variants,
              }
            : product,
        ),
      );

      setEditVariants(data.data.variants);
      setSuccessMessage('Variantes mises à jour avec succès.');
    } catch (err) {
      console.error('Admin update product variants error:', err);
      setError('Impossible de modifier les variantes.');
    } finally {
      setSavingVariants(false);
    }
  };

    const createProduct = async () => {
    if (!createCategoryId) {
      setError('La catégorie est obligatoire.');
      return;
    }

    if (!createName.trim()) {
      setError('Le nom du produit est obligatoire.');
      return;
    }

    if (createVariants.length === 0) {
      setError('Au moins une variante est obligatoire.');
      return;
    }

    if (
      createVariants.some(
        (variant) =>
          variant.price.trim() === '' ||
          Number.isNaN(Number(variant.price)) ||
          Number(variant.price) < 0,
      )
    ) {
      setError('Chaque prix de variante doit être un nombre supérieur ou égal à 0.');
      return;
    }

    const parsedOrder =
      createOrder.trim() === '' ? null : Number(createOrder);

    if (
      parsedOrder !== null &&
      (!Number.isInteger(parsedOrder) || parsedOrder < 0)
    ) {
      setError("L'ordre doit être un nombre entier supérieur ou égal à 0.");
      return;
    }

    try {
      setSavingCreate(true);
      setError(null);
      setSuccessMessage(null);

      const response = await adminFetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: createCategoryId,
          name: createName,
          description: createDescription,
          order: parsedOrder,
          featured: createFeatured,
          active: createActive,
          available: createAvailable,
          variants: createVariants.map((variant) => ({
            code: variant.code,
            name: variant.name,
            price: Number(variant.price),
            active: variant.active,
            isDefault: variant.isDefault,
          })),
        }),
      });

      const data: CreateProductResponse = await response.json();

      if (!response.ok || !data.ok || !data.data) {
        setError(data.message || data.error || 'Impossible de créer le produit.');
        return;
      }

      setProducts((prev) => [...prev, data.data!]);
      setSuccessMessage('Produit créé avec succès.');
      resetCreateForm();
      setCreatingProduct(false);
    } catch (err) {
      console.error('Admin create product error:', err);
      setError('Impossible de créer le produit.');
    } finally {
      setSavingCreate(false);
    }
  };

  const deleteProduct = async (id: string) => {
  const currentProduct = products.find((product) => product.id === id);

  if (!currentProduct) {
    return;
  }

  const confirmed = window.confirm(
    `Supprimer définitivement le produit "${currentProduct.name}" ? Cette action est irréversible.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    setDeletingProductId(id);
    setError(null);
    setSuccessMessage(null);

    const response = await adminFetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data: DeleteProductResponse = await response.json();

    if (!response.ok || !data.ok || !data.data) {
      setError(data.message || data.error || 'Impossible de supprimer le produit.');
      return;
    }

    setProducts((prev) => prev.filter((product) => product.id !== id));

    if (editingProductId === id) {
      cancelEditProduct();
    }

    setSuccessMessage('Produit supprimé avec succès.');
  } catch (err) {
    console.error('Admin delete product error:', err);
    setError('Impossible de supprimer le produit.');
  } finally {
    setDeletingProductId(null);
  }
};

  const grouped = useMemo(
    () =>
      categories
        .filter((c) => c.active)
        .map((cat) => ({
          ...cat,
          products: products
            .filter((p) => p.categoryId === cat.id)
            .sort((a, b) => a.order - b.order),
        })),
    [categories, products],
  );

    useEffect(() => {
    if (grouped.length === 0) {
      return;
    }

    setOpenCategoryIds((prev) => {
      if (prev.length > 0) {
        return prev;
      }

      return [grouped[0].id];
    });
  }, [grouped]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Produits</h2>
            <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-muted-foreground">
          Activez/désactivez les produits et gérez les prix.
        </p>

        <Button
          onClick={() => {
if (creatingProduct) {
  resetCreateForm();
  setSuccessMessage(null);
  setCreatingProduct(false);
  return;
}

setError(null);
setSuccessMessage(null);
setCreatingProduct(true);
          }}
        >
          {creatingProduct ? 'Fermer' : 'Ajouter un produit'}
        </Button>
      </div>

            {creatingProduct && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Ajouter un produit</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Créez un nouveau produit avec ses variantes initiales.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Catégorie
              </label>
              <select
                value={createCategoryId}
                onChange={(e) => handleCreateCategoryChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Sélectionner une catégorie</option>
                {categories
                  .filter((category) => category.active)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
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

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={createFeatured}
                  onChange={(e) => setCreateFeatured(e.target.checked)}
                />
                Produit mis en avant
              </label>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-end">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                />
                Actif
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={createAvailable}
                  onChange={(e) => setCreateAvailable(e.target.checked)}
                />
                Disponible
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Variantes initiales</h4>

            {createCategoryId === '' && (
              <p className="mt-2 text-sm text-muted-foreground">
                Choisissez d’abord une catégorie pour préremplir les variantes.
              </p>
            )}

            {createCategoryId !== '' && createVariants.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Aucune variante par défaut disponible pour cette catégorie.
              </p>
            )}

            <div className="mt-3 space-y-3">
              {createVariants.map((variant) => (
                <div
                  key={variant.code}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {variant.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Code : {variant.code}
                      </p>
                    </div>

                    <div className="w-full md:w-40">
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Prix (€)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={variant.price}
                        onChange={(e) =>
                          updateCreateVariantPrice(variant.code, e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={variant.active}
                        onChange={(e) =>
                          updateCreateVariantActive(variant.code, e.target.checked)
                        }
                      />
                      Variante active
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={createProduct} disabled={savingCreate}>
              {savingCreate ? 'Création...' : 'Créer le produit'}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                resetCreateForm();
                setCreatingProduct(false);
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
          Chargement des produits...
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

      {!loading && !error && grouped.map((cat) => {
        const isOpen = openCategoryIds.includes(cat.id);

        return (
          <div key={cat.id} className="mt-8">
            <button
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
              <div>
                <h3 className="font-display text-lg font-semibold text-primary">{cat.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {cat.products.length} produit{cat.products.length > 1 ? 's' : ''}
                </p>
              </div>

              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2">
                {cat.products.map((product) => (
                  <div key={product.id} className="space-y-2">
                    <div
                      className={`card-premium p-4 ${!product.active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium truncate">{product.name}</h4>
                            {product.featured && <span className="text-xs text-primary">★</span>}

                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${
                                product.active
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {product.active ? 'Actif' : 'Inactif'}
                            </span>

                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${
                                product.available
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {product.available ? 'Disponible' : 'Indisponible'}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {product.description}
                          </p>

                          <div className="flex gap-3 mt-2 flex-wrap">
                            {product.variants
                              .filter((v) => v.active)
                              .map((v, i) => {
                                const label =
                                  'size' in v
                                    ? SIZE_LABELS[(v as PastaVariant).size]
                                    : SIZE_LABELS[(v as PaniniVariant).formula];

                                return (
                                  <span key={i} className="text-xs text-muted-foreground">
                                    {label}:{' '}
                                    <span className="font-medium text-foreground">
                                      {formatPrice(v.price)}
                                    </span>
                                  </span>
                                );
                              })}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditProduct(product)}
                            disabled={deletingProductId === product.id}
                          >
                            Modifier
                          </Button>

                          <Button
                            size="sm"
                            variant={product.active ? 'outline' : 'default'}
                            onClick={() => toggleActive(product.id)}
                            disabled={deletingProductId === product.id}
                          >
                            {product.active ? 'Désactiver' : 'Activer'}
                          </Button>

                          <Button
                            size="sm"
                            variant={product.available ? 'outline' : 'default'}
                            onClick={() => toggleAvailability(product.id)}
                            disabled={deletingProductId === product.id}
                          >
                            {product.available ? 'Indisponible' : 'Disponible'}
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProduct(product.id)}
                            disabled={deletingProductId === product.id}
                          >
                            {deletingProductId === product.id ? 'Suppression...' : 'Supprimer'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {editingProductId === product.id && (
                      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                        <div>
                          <h3 className="font-display text-lg font-semibold">Modifier le produit</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Modifiez ici les champs simples du produit sélectionné.
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

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-foreground">
                              Description
                            </label>
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={3}
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
                                checked={editFeatured}
                                onChange={(e) => setEditFeatured(e.target.checked)}
                              />
                              Produit mis en avant
                            </label>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">Variantes</h4>
                            <div className="mt-3 space-y-3">
                              {editVariants.map((variant) => {
                                const label =
                                  'size' in variant
                                    ? SIZE_LABELS[variant.size]
                                    : SIZE_LABELS[variant.formula];

                                return (
                                  <div
                                    key={variant.id}
                                    className="rounded-lg border border-border bg-background p-3"
                                  >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">
                                          {label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Code : {variant.code}
                                        </p>
                                      </div>

                                      <div className="w-full md:w-40">
                                        <label className="mb-1 block text-sm font-medium text-foreground">
                                          Prix (€)
                                        </label>
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={variant.price}
                                          onChange={(e) =>
                                            updateEditVariantPrice(variant.id, e.target.value)
                                          }
                                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                        />
                                      </div>

                                      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <input
                                          type="checkbox"
                                          checked={variant.active}
                                          onChange={(e) =>
                                            updateEditVariantActive(variant.id, e.target.checked)
                                          }
                                        />
                                        Variante active
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button onClick={saveEditProduct} disabled={savingEdit || savingVariants}>
                              {savingEdit ? 'Enregistrement...' : 'Enregistrer le produit'}
                            </Button>

                            <Button
                              variant="outline"
                              onClick={saveEditVariants}
                              disabled={savingEdit || savingVariants}
                            >
                              {savingVariants ? 'Enregistrement...' : 'Enregistrer les variantes'}
                            </Button>

                            <Button
                              variant="outline"
                              onClick={cancelEditProduct}
                              disabled={savingEdit || savingVariants}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {cat.products.length === 0 && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-sm text-muted-foreground">
                      Aucun produit dans cette catégorie.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground mt-6">
        Note : la liste est chargée depuis le backend et les boutons modifient
        maintenant réellement l’état actif et la disponibilité du produit en base.
      </p>
    </div>
  );
}