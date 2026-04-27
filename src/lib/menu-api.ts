export interface ApiMenuVariant {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  sortOrder: number;
  isDefault: boolean;
}

export interface ApiMenuProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  variants: ApiMenuVariant[];
}

export interface ApiMenuCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  products: ApiMenuProduct[];
}

export interface ApiMenuBeverage {
  id: string;
  name: string;
  slug: string;
  priceCents: number | null;
  sortOrder: number;
  isActive: boolean;
  isMenuEligible: boolean;
}

export interface ApiSiteSettings {
  restaurantName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  legalName: string | null;
  vatNumber: string | null;
}

export interface ApiDeliverySettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  deliveryZoneLabel: string | null;
  estimatedDeliveryTimeMin: number;
  estimatedPickupTimeMin: number;
  rushModeEnabled: boolean;
}

export interface ApiOpeningHour {
  dayKey: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface PublicMenuResponse {
  ok: boolean;
  data: {
    categories: ApiMenuCategory[];
    beverages: ApiMenuBeverage[];
    siteSettings: ApiSiteSettings | null;
    deliverySettings: ApiDeliverySettings | null;
    openingHours: ApiOpeningHour[];
  };
}

const PUBLIC_MENU_CACHE_TTL_MS = 30_000;

let publicMenuCache: PublicMenuResponse["data"] | null = null;
let publicMenuCacheExpiresAt = 0;
let publicMenuRequestInFlight: Promise<PublicMenuResponse["data"]> | null = null;

function isPublicMenuCacheValid(): boolean {
  return publicMenuCache !== null && Date.now() < publicMenuCacheExpiresAt;
}

export function invalidatePublicMenuCache(): void {
  publicMenuCache = null;
  publicMenuCacheExpiresAt = 0;
  publicMenuRequestInFlight = null;
}

export async function fetchPublicMenu(options?: {
  forceRefresh?: boolean;
}): Promise<PublicMenuResponse["data"]> {
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh && isPublicMenuCacheValid()) {
    return publicMenuCache as PublicMenuResponse["data"];
  }

  if (!forceRefresh && publicMenuRequestInFlight) {
    return publicMenuRequestInFlight;
  }

  publicMenuRequestInFlight = (async () => {
    const response = await fetch("/api/public/menu", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch public menu: ${response.status}`);
    }

    const json = (await response.json()) as PublicMenuResponse;

    if (!json.ok || !json.data) {
      throw new Error("Invalid public menu response");
    }

    publicMenuCache = json.data;
    publicMenuCacheExpiresAt = Date.now() + PUBLIC_MENU_CACHE_TTL_MS;

    return json.data;
  })();

  try {
    return await publicMenuRequestInFlight;
  } finally {
    publicMenuRequestInFlight = null;
  }
}

export function formatPriceFromCents(priceCents: number): string {
  return (priceCents / 100).toFixed(2).replace(".", ",") + "€";
}