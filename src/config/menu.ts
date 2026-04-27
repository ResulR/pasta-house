import type { Category, Product, Beverage, DeliverySettings, DaySchedule, SiteConfig } from '@/types';

// ===== CATÉGORIES =====
export const CATEGORIES: Category[] = [
  { id: 'cat-pates', slug: 'pates', name: 'Pâtes', order: 1, active: true },
  { id: 'cat-paninis', slug: 'paninis', name: 'Paninis', order: 2, active: true },
];

// ===== PÂTES =====
export const PASTA_PRODUCTS: Product[] = [
  { id: 'p1', categoryId: 'cat-pates', name: 'Bolognaise', description: 'Sauce tomate riche à la viande hachée, mijotée lentement.', active: true, order: 1, featured: true, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p2', categoryId: 'cat-pates', name: 'Bolognaise 4 Fromages', description: 'Bolognaise généreuse rehaussée d\'un mélange fondant de quatre fromages.', active: true, order: 2, featured: false, variants: [{ size: 'ravier', price: 7.00, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p3', categoryId: 'cat-pates', name: 'Bolognaise Poulet', description: 'Sauce bolognaise accompagnée de morceaux de poulet tendres.', active: true, order: 3, featured: false, variants: [{ size: 'ravier', price: 7.50, active: true }, { size: 'assiette', price: 12.00, active: true }] },
  { id: 'p4', categoryId: 'cat-pates', name: 'Saumon', description: 'Pâtes crémeuses au saumon frais et à l\'aneth.', active: true, order: 4, featured: true, variants: [{ size: 'ravier', price: 7.00, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p5', categoryId: 'cat-pates', name: 'Poulet Blanche', description: 'Poulet dans une sauce blanche onctueuse.', active: true, order: 5, featured: false, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p6', categoryId: 'cat-pates', name: 'Poulet Épinard', description: 'Poulet et épinards frais dans une sauce crémeuse.', active: true, order: 6, featured: false, variants: [{ size: 'ravier', price: 6.50, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p7', categoryId: 'cat-pates', name: 'Poulet Champignon', description: 'Poulet et champignons sautés, sauce onctueuse.', active: true, order: 7, featured: false, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p8', categoryId: 'cat-pates', name: 'Poulet Andalouse', description: 'Poulet relevé d\'une touche de sauce andalouse maison.', active: true, order: 8, featured: false, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p9', categoryId: 'cat-pates', name: 'Poulet Curry', description: 'Poulet épicé au curry doux et crémeux.', active: true, order: 9, featured: false, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p10', categoryId: 'cat-pates', name: 'Poulet Pili', description: 'Poulet relevé au pili pili, pour les amateurs de piquant.', active: true, order: 10, featured: false, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p11', categoryId: 'cat-pates', name: 'Poulet Chef', description: 'Recette signature du chef, poulet et sauce secrète.', active: true, order: 11, featured: true, variants: [{ size: 'ravier', price: 6.50, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p12', categoryId: 'cat-pates', name: 'Poulet + Salami', description: 'Duo généreux de poulet et salami dans une sauce relevée.', active: true, order: 12, featured: false, variants: [{ size: 'ravier', price: 7.50, active: true }, { size: 'assiette', price: 12.00, active: true }] },
  { id: 'p13', categoryId: 'cat-pates', name: 'Salami Blanche', description: 'Salami fondant dans une sauce blanche crémeuse.', active: true, order: 13, featured: false, variants: [{ size: 'ravier', price: 7.00, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p14', categoryId: 'cat-pates', name: 'Poulet Brocoli', description: 'Poulet tendre et brocoli dans une sauce légère.', active: true, order: 14, featured: false, variants: [{ size: 'ravier', price: 6.50, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p15', categoryId: 'cat-pates', name: 'Quatre Fromages', description: 'Quatre fromages fondus dans une sauce généreuse et gourmande.', active: true, order: 15, featured: false, variants: [{ size: 'ravier', price: 6.00, active: true }, { size: 'assiette', price: 10.00, active: true }] },
  { id: 'p16', categoryId: 'cat-pates', name: 'Carbonara', description: 'La classique italienne, crémeuse et savoureuse.', active: true, order: 16, featured: true, variants: [{ size: 'ravier', price: 7.00, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p17', categoryId: 'cat-pates', name: 'Arabiata', description: 'Sauce tomate épicée, pour les amateurs de caractère.', active: true, order: 17, featured: false, variants: [{ size: 'ravier', price: 7.00, active: true }, { size: 'assiette', price: 11.00, active: true }] },
  { id: 'p18', categoryId: 'cat-pates', name: 'Scampis', description: 'Scampis juteux dans une sauce à l\'ail et au beurre.', active: true, order: 18, featured: true, variants: [{ size: 'ravier', price: 9.00, active: true }, { size: 'assiette', price: 12.50, active: true }] },
];

// ===== PANINIS =====
export const PANINI_PRODUCTS: Product[] = [
  { id: 'pn1', categoryId: 'cat-paninis', name: 'Panini Poulet', description: 'Panini garni de poulet grillé, fromage fondant et crudités.', active: true, order: 1, featured: true, variants: [{ formula: 'seul', price: 6.00, active: true }, { formula: 'menu', price: 10.00, active: true }] },
  { id: 'pn2', categoryId: 'cat-paninis', name: 'Panini Kefta', description: 'Panini au kefta épicé, oignons et sauce maison.', active: true, order: 2, featured: false, variants: [{ formula: 'seul', price: 6.00, active: true }, { formula: 'menu', price: 10.00, active: true }] },
  { id: 'pn3', categoryId: 'cat-paninis', name: 'Panini Quatre Fromages', description: 'Panini fondant au mélange de quatre fromages.', active: true, order: 3, featured: false, variants: [{ formula: 'seul', price: 6.00, active: true }, { formula: 'menu', price: 10.00, active: true }] },
];

export const ALL_PRODUCTS: Product[] = [...PASTA_PRODUCTS, ...PANINI_PRODUCTS];

// ===== BOISSONS MENU PANINI =====
export const BEVERAGES: Beverage[] = [
  { id: 'bev-coca', name: 'Coca', active: true, order: 1 },
  { id: 'bev-fanta', name: 'Fanta', active: true, order: 2 },
  { id: 'bev-icetea', name: 'Ice Tea', active: true, order: 3 },
];

// ===== LIVRAISON =====
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  enabled: true,
  fee: 5.00,
  minimumOrder: 15.00,
  zone: 'Bruxelles',
  pickupEnabled: true,
};

// ===== HORAIRES =====
export const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 'lundi', open: true, openTime: '20:00', closeTime: '01:00' },
  { day: 'mardi', open: true, openTime: '20:00', closeTime: '01:00' },
  { day: 'mercredi', open: true, openTime: '20:00', closeTime: '01:00' },
  { day: 'jeudi', open: true, openTime: '20:00', closeTime: '01:00' },
  { day: 'vendredi', open: true, openTime: '20:00', closeTime: '01:00' },
  { day: 'samedi', open: true, openTime: '20:00', closeTime: '01:00' },
  { day: 'dimanche', open: true, openTime: '20:00', closeTime: '01:00' },
];

// ===== CONFIG SITE =====
export const SITE_CONFIG: SiteConfig = {
  restaurantName: 'Pasta House',
  phone: '[À définir]',
  email: '[À définir]',
  address: '[Adresse à définir], Bruxelles',
  legalName: '[Raison sociale à définir]',
  vatNumber: '[Numéro TVA à définir]',
};

// ===== HELPERS =====
export function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',') + '€';
}

export function getProductById(id: string): Product | undefined {
  return ALL_PRODUCTS.find(p => p.id === id);
}

export function getActiveProducts(categorySlug?: string): Product[] {
  const cat = categorySlug ? CATEGORIES.find(c => c.slug === categorySlug) : undefined;
  return ALL_PRODUCTS
    .filter(p => p.active && (!cat || p.categoryId === cat.id))
    .sort((a, b) => a.order - b.order);
}

export function getActiveBeverages(): Beverage[] {
  return BEVERAGES.filter(b => b.active).sort((a, b) => a.order - b.order);
}

export const SIZE_LABELS: Record<string, string> = {
  ravier: 'Ravier',
  assiette: 'Assiette',
  seul: 'Seul',
  menu: 'Menu',
};
