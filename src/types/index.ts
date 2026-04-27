// ===== PRODUITS =====
export type CategorySlug = 'pates' | 'paninis';

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  order: number;
  active: boolean;
}

export type PastaSize = 'ravier' | 'assiette';
export type PaniniFormula = 'seul' | 'menu';

export interface PastaVariant {
  size: PastaSize;
  price: number;
  active: boolean;
}

export interface PaniniVariant {
  formula: PaniniFormula;
  price: number;
  active: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  active: boolean;
  order: number;
  featured: boolean;
  variants: PastaVariant[] | PaniniVariant[];
}

export interface Beverage {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

// ===== PANIER =====
export type OrderMode = 'livraison' | 'retrait';

export interface CartItemPasta {
  type: 'pates';
  productId: string;
  productName: string;
  size: PastaSize;
  price: number;
  quantity: number;
}

export interface CartItemPanini {
  type: 'paninis';
  productId: string;
  productName: string;
  formula: PaniniFormula;
  price: number;
  quantity: number;
  beverageId?: string; // obligatoire si formula === 'menu'
  beverageName?: string;
}

export type CartItem = CartItemPasta | CartItemPanini;

// ===== CHECKOUT =====
export interface DeliveryInfo {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  commune: string;
  codePostal: string;
  instructions?: string;
}

export interface PickupInfo {
  nom: string;
  telephone: string;
  email: string;
  note?: string;
}

export type CustomerInfo = DeliveryInfo | PickupInfo;

// ===== COMMANDES =====
export type OrderStatus = 'recue' | 'en_preparation' | 'prete' | 'en_livraison' | 'terminee' | 'annulee';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  recue: 'Reçue',
  en_preparation: 'En préparation',
  prete: 'Prête',
  en_livraison: 'En livraison',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'recue', 'en_preparation', 'prete', 'en_livraison', 'terminee',
];

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'En attente de paiement',
  paid: 'Payé',
  failed: 'Paiement échoué',
  cancelled: 'Paiement annulé',
};

export interface OrderLine {
  productId: string;
  productName: string;
  category: CategorySlug;
  variant: string; // "ravier", "assiette", "seul", "menu"
  beverageName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  mode: OrderMode;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customer: CustomerInfo;
  paymentStatus: PaymentStatus;
  stripePaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== HORAIRES =====
export type DayOfWeek = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

export interface DaySchedule {
  day: DayOfWeek;
  open: boolean;
  openTime: string; // "20:00"
  closeTime: string; // "01:00"
}

export interface ExceptionalClosure {
  id: string;
  date: string; // "2026-04-10"
  reason?: string;
}

export interface ScheduleOverride {
  id: string;
  date: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  reason?: string;
}

// ===== LIVRAISON =====
export interface DeliverySettings {
  enabled: boolean;
  fee: number;
  minimumOrder: number;
  zone: string; // "Bruxelles" for V1
  pickupEnabled: boolean;
  estimatedDeliveryTime: number;
  estimatedPickupTime: number;
  rushModeEnabled: boolean;
}

// ===== CONFIG SITE =====
export interface SiteConfig {
  restaurantName: string;
  phone: string;
  email: string;
  address: string;
  legalName: string;
  vatNumber: string;
}
