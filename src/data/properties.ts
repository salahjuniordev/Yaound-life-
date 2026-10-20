import type { DistrictId } from '../sim/types';

export interface RentalPropertyDef {
  id: string;
  name: string;
  nameFr: string;
  district: DistrictId;
  price: number;
  weeklyRent: number;
  maintenance: number;
  description: string;
  descriptionFr: string;
}

export const RENTAL_PROPERTIES: RentalPropertyDef[] = [
  {
    id: 'studio_mvog',
    name: 'Two-room studio, Mvog-Mbi',
    nameFr: 'Studio deux pièces, Mvog-Mbi',
    district: 'mvog_mbi',
    price: 800000,
    weeklyRent: 22000,
    maintenance: 4000,
    description: 'Near the market and the school. Easy tenants, small margins.',
    descriptionFr: 'Près du marché et de l’école. Locataires faciles, petites marges.',
  },
  {
    id: 'flat_nlongkak',
    name: 'Commercial flat, Nlongkak',
    nameFr: 'Appartement commercial, Nlongkak',
    district: 'nlongkak',
    price: 1200000,
    weeklyRent: 32000,
    maintenance: 5500,
    description: 'Above the busy street. Tenants who pay on time because business is good.',
    descriptionFr: 'Au-dessus de la rue passante. Des locataires qui paient à l’heure.',
  },
  {
    id: 'duplex_bastos',
    name: 'Duplex, Bastos',
    nameFr: 'Duplex, Bastos',
    district: 'bastos',
    price: 3000000,
    weeklyRent: 85000,
    maintenance: 15000,
    description: 'Expat neighbourhood. Serious money, serious paperwork, serious repairs.',
    descriptionFr: 'Quartier expat. Gros loyers, gros dossiers, grosses réparations.',
  },
];

export const PROPERTY_MAP: Record<string, RentalPropertyDef> = Object.fromEntries(RENTAL_PROPERTIES.map((p) => [p.id, p]));

export interface PremisesLevelDef {
  level: number;
  name: string;
  nameFr: string;
  cost: number;
  rentPerDay: number;
  demandFactor: number;
}

export const PREMISES_LEVELS: PremisesLevelDef[] = [
  { level: 1, name: 'Container shop', nameFr: 'Boutique conteneur', cost: 120000, rentPerDay: 1500, demandFactor: 1.15 },
  { level: 2, name: 'Real shopfront', nameFr: 'Vraie devanture', cost: 400000, rentPerDay: 5000, demandFactor: 1.35 },
];

export function premisesLevelDef(level: number): PremisesLevelDef | null {
  return PREMISES_LEVELS.find((p) => p.level === level) ?? null;
}
