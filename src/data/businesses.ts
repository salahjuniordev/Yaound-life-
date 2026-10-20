export interface BusinessKindDef {
  id: string;
  name: string;
  nameFr: string;
  setupCost: number;
  rentPerDay: number;
  baseDemand: number;
  stockItems: string[];
  serviceIncome: number;
  description: string;
  descriptionFr: string;
  icon: string;
}

export const BUSINESS_KINDS: BusinessKindDef[] = [
  {
    id: 'food_stall',
    name: 'Snack table',
    nameFr: 'Table de snacks',
    setupCost: 15000,
    rentPerDay: 1800,
    baseDemand: 9,
    stockItems: ['beignets_haricots', 'soya', 'plantain_grille', 'koki'],
    serviceIncome: 0,
    description: 'Beignets, plantain, soya. Low cost, steady demand, fast stock turnover.',
    descriptionFr: 'Beignets, plantain, soya. Peu de frais, demande stable.',
    icon: 'food',
  },
  {
    id: 'drinks_kiosk',
    name: 'Cold drinks kiosk',
    nameFr: 'Kiosque de boissons fraîches',
    setupCost: 20000,
    rentPerDay: 2000,
    baseDemand: 11,
    stockItems: ['soda', 'water_sachet', 'jus_local', 'beer33'],
    serviceIncome: 0,
    description: 'Ice, bottles, a freezer box and shade. Sells hard on hot days.',
    descriptionFr: 'Glace, bouteilles, caisse et ombre. Se vend fort les jours chauds.',
    icon: 'drink',
  },
  {
    id: 'grocery',
    name: 'Neighbourhood grocery',
    nameFr: 'Épicerie de quartier',
    setupCost: 45000,
    rentPerDay: 3200,
    baseDemand: 8,
    stockItems: ['rice_kg', 'beans_kg', 'palm_oil_l', 'tomatoes_kg', 'spices_pack'],
    serviceIncome: 0,
    description: 'Rice, oil, tomatoes, spices. Households come back weekly.',
    descriptionFr: 'Riz, huile, tomates, épices. Les ménages reviennent chaque semaine.',
    icon: 'box',
  },
  {
    id: 'phone_kiosk',
    name: 'Phone accessories kiosk',
    nameFr: 'Kiosque accessoires téléphone',
    setupCost: 30000,
    rentPerDay: 2400,
    baseDemand: 6,
    stockItems: ['phone_charger', 'powerbank', 'refurb_phone'],
    serviceIncome: 0,
    description: 'Chargers, power banks, refurbished phones. Higher unit prices, slower sales.',
    descriptionFr: 'Chargeurs, power banks, téléphones reconditionnés. Panier plus cher, ventes plus lentes.',
    icon: 'phone',
  },
  {
    id: 'barber',
    name: 'Barber / salon chair',
    nameFr: 'Chaise de coiffure',
    setupCost: 18000,
    rentPerDay: 1800,
    baseDemand: 7,
    stockItems: [],
    serviceIncome: 1200,
    description: 'A chair, clippers, a mirror and conversation. Service income per client.',
    descriptionFr: 'Chaise, tondeuse, miroir et conversation. Revenu par client.',
    icon: 'scissors',
  },
  {
    id: 'tailor_shop',
    name: 'Tailoring workshop',
    nameFr: 'Atelier de couture',
    setupCost: 22000,
    rentPerDay: 2000,
    baseDemand: 5,
    stockItems: ['pagne', 'tshirt'],
    serviceIncome: 1500,
    description: 'Alterations and custom orders with fabric you stock.',
    descriptionFr: 'Retouches et commandes avec tissu en stock.',
    icon: 'scissors',
  },
  {
    id: 'poisson_stand',
    name: 'Poisson braise stand',
    nameFr: 'Stand de poisson braisé',
    setupCost: 20000,
    rentPerDay: 2200,
    baseDemand: 10,
    stockItems: ['fish_kg', 'plantain_bunch', 'palm_oil_l'],
    serviceIncome: 0,
    description: 'Evening grill. Strong demand on match nights, risk on perishables.',
    descriptionFr: 'Grill du soir. Forte demande les soirs de match.',
    icon: 'food',
  },
];

export const BUSINESS_MAP: Record<string, BusinessKindDef> = Object.fromEntries(BUSINESS_KINDS.map((b) => [b.id, b]));

export interface SupplierDef {
  id: 'neighbourhood' | 'haggle_market' | 'bulk_order';
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  priceFactor: number;
  reliability: number;
  quality: 'low' | 'ok' | 'good';
  minQty: number;
  deliveryDays: number;
}

export const SUPPLIERS: SupplierDef[] = [
  {
    id: 'neighbourhood',
    name: 'Neighbourhood wholesaler',
    nameFr: 'Grossiste du quartier',
    description: 'Fair price, reliably delivered today, ok quality.',
    descriptionFr: 'Prix correct, livré aujourd’hui, qualité correcte.',
    priceFactor: 1.0,
    reliability: 0.95,
    quality: 'ok',
    minQty: 1,
    deliveryDays: 0,
  },
  {
    id: 'haggle_market',
    name: 'Haggle at the market',
    nameFr: 'Marchander au marché',
    description: 'Cheapest unit price if you negotiate, but deliveries can come short.',
    descriptionFr: 'Prix unitaire le plus bas si vous négociez, mais livraisons parfois incomplètes.',
    priceFactor: 0.82,
    reliability: 0.75,
    quality: 'ok',
    minQty: 1,
    deliveryDays: 0,
  },
  {
    id: 'bulk_order',
    name: 'Bulk order (30+)',
    nameFr: 'Commande en gros (30+)',
    description: 'Best price and best quality, arrives tomorrow. Minimum 30 units.',
    descriptionFr: 'Meilleur prix et meilleure qualité, livré demain. Minimum 30 unités.',
    priceFactor: 0.7,
    reliability: 0.9,
    quality: 'good',
    minQty: 30,
    deliveryDays: 1,
  },
];

export const SUPPLIER_MAP: Record<string, SupplierDef> = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));

export const STAFF_DAILY_WAGE = 1000;
export const STAFF_TRAINING_COST = 2500;
export const MARKETING_CAMPAIGNS = [
  { id: 'flyers', name: 'Flyers around the quarter', nameFr: 'Tracts dans le quartier', cost: 2000, boost: 1.15, days: 3, minPosts: 0 },
  { id: 'radio', name: 'Radio mention', nameFr: 'Mention radio', cost: 9000, boost: 1.35, days: 5, minPosts: 0 },
  { id: 'social', name: 'Social media push', nameFr: 'Campagne sur les réseaux', cost: 0, boost: 1.2, days: 2, minPosts: 3 },
] as const;

export type MarketingCampaignId = (typeof MARKETING_CAMPAIGNS)[number]['id'];
