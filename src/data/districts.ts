import type { DistrictId } from '../sim/types';

export interface ZoneDef {
  id: DistrictId;
  name: string;
  nameFr: string;
  flavor: string;
  flavorFr: string;
  center: [number, number];
  radius: number;
  priceMultiplier: number;
  footTraffic: number;
  powerReliability: number;
  safetyDay: number;
  safetyNight: number;
  connected: DistrictId[];
  tags: string[];
}

export const ZONES: ZoneDef[] = [
  {
    id: 'mvog_mbi',
    name: 'Mvog-Mbi',
    nameFr: 'Mvog-Mbi',
    flavor: 'Dense old quartier. Compound life, small trade, football on the bare pitch, neighbours who know your name.',
    flavorFr: 'Quartier dense et populaire. Vie de concession, petit commerce, foot sur le terrain vide, voisins qui connaissent ton nom.',
    center: [10, 85],
    radius: 70,
    priceMultiplier: 1.0,
    footTraffic: 0.75,
    powerReliability: 0.62,
    safetyDay: 0.95,
    safetyNight: 0.78,
    tags: ['residential', 'football', 'community'],
    connected: ['mokolo', 'nlongkak', 'ngoa_ekelle'],
  },
  {
    id: 'mokolo',
    name: 'Mokolo Market',
    nameFr: 'Marché Mokolo',
    flavor: 'Towering aisles of goods, porters, bargain calls, wholesale prices before noon.',
    flavorFr: 'Des allées de marchandises, porteurs, marchandage, prix de gros avant midi.',
    center: [130, -15],
    radius: 60,
    priceMultiplier: 0.85,
    footTraffic: 1.0,
    powerReliability: 0.55,
    safetyDay: 0.8,
    safetyNight: 0.6,
    tags: ['market', 'wholesale', 'crowd'],
    connected: ['mvog_mbi', 'mvan', 'nlongkak', 'boulevard'],
  },
  {
    id: 'nlongkak',
    name: 'Nlongkak',
    nameFr: 'Nlongkak',
    flavor: 'Commercial street: shops, cybercafes, offices, restaurants, the roundabout everyone meets at.',
    flavorFr: 'Rue commerciale : boutiques, cybercafés, bureaux, restaurants, le rond-point où tout le monde se retrouve.',
    center: [-95, -25],
    radius: 55,
    priceMultiplier: 1.1,
    footTraffic: 0.9,
    powerReliability: 0.7,
    safetyDay: 0.9,
    safetyNight: 0.75,
    tags: ['commercial', 'services', 'nightlife'],
    connected: ['mvog_mbi', 'mokolo', 'boulevard', 'bastos'],
  },
  {
    id: 'ngoa_ekelle',
    name: 'Ngoa-Ekelle',
    nameFr: 'Ngoa-Ekelle',
    flavor: 'University hill. Study groups under trees, photocopy kiosks, student food spots.',
    flavorFr: "Colline universitaire. Groupes d'étude sous les arbres, kiosques de photocopie, gargotes étudiantes.",
    center: [30, -115],
    radius: 55,
    priceMultiplier: 0.9,
    footTraffic: 0.85,
    powerReliability: 0.68,
    safetyDay: 0.94,
    safetyNight: 0.8,
    tags: ['education', 'students', 'cheap_food'],
    connected: ['mvog_mbi', 'lac_municipal', 'boulevard'],
  },
  {
    id: 'bastos',
    name: 'Bastos',
    nameFr: 'Bastos',
    flavor: 'Upscale homes, embassies, restaurants with tablecloths. Expensive, quieter, jobs behind guarded gates.',
    flavorFr: 'Maisons cossues, ambassades, restaurants. Cher, plus calme, emplois derrière des portails gardés.',
    center: [165, -95],
    radius: 60,
    priceMultiplier: 1.8,
    footTraffic: 0.5,
    powerReliability: 0.85,
    safetyDay: 0.97,
    safetyNight: 0.9,
    tags: ['upscale', 'offices', 'restaurants'],
    connected: ['nlongkak', 'lac_municipal'],
  },
  {
    id: 'mvan',
    name: 'Mvan',
    nameFr: 'Mvan',
    flavor: 'Transport hub and workshops. Buses, mechanics, warehouses, and power that comes and goes.',
    flavorFr: 'Pôle de transport et ateliers. Bus, mécaniciens, entrepôts, et un courant qui va et vient.',
    center: [210, 65],
    radius: 55,
    priceMultiplier: 0.95,
    footTraffic: 0.8,
    powerReliability: 0.5,
    safetyDay: 0.85,
    safetyNight: 0.68,
    tags: ['transport', 'industrial', 'workshops'],
    connected: ['mokolo', 'lac_municipal'],
  },
  {
    id: 'mont_febe',
    name: 'Mont Febe',
    nameFr: 'Mont Fébé',
    flavor: 'Scenic hill with viewpoints over the city. Quiet walks, photos, calm contrast to the market chaos.',
    flavorFr: 'Colline panoramique avec vues sur la ville. Promenades calmes, photos, contraste avec le marché.',
    center: [-195, -120],
    radius: 55,
    priceMultiplier: 1.0,
    footTraffic: 0.35,
    powerReliability: 0.75,
    safetyDay: 0.95,
    safetyNight: 0.82,
    tags: ['landmark', 'viewpoint', 'quiet'],
    connected: ['nlongkak', 'lac_municipal'],
  },
  {
    id: 'lac_municipal',
    name: 'Lac Municipal',
    nameFr: 'Lac Municipal',
    flavor: 'Lakeside path, meetups, casual walks and photos. A calm lung of the city.',
    flavorFr: 'Sentier au bord du lac, rencontres, balades et photos. Un poumon calme de la ville.',
    center: [80, -195],
    radius: 50,
    priceMultiplier: 1.0,
    footTraffic: 0.55,
    powerReliability: 0.72,
    safetyDay: 0.95,
    safetyNight: 0.8,
    tags: ['landmark', 'leisure', 'quiet'],
    connected: ['ngoa_ekelle', 'mvan', 'bastos'],
  },
  {
    id: 'boulevard',
    name: 'Boulevard du 20 Mai',
    nameFr: 'Boulevard du 20 Mai',
    flavor: 'The wide spine of the city. Parades, gatherings, taxi flow, civic events.',
    flavorFr: 'La grande artère de la ville. Défilés, rassemblements, taxis, événements civiques.',
    center: [-25, -35],
    radius: 45,
    priceMultiplier: 1.05,
    footTraffic: 0.85,
    powerReliability: 0.78,
    safetyDay: 0.92,
    safetyNight: 0.8,
    tags: ['civic', 'meeting_point', 'events'],
    connected: ['mvog_mbi', 'nlongkak', 'mokolo', 'ngoa_ekelle'],
  },
];

export const DISTRICT_MAP: Record<DistrictId, ZoneDef> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
) as Record<DistrictId, ZoneDef>;

export const ROADS: { points: [number, number][]; width: number }[] = [
  { points: [[10, 90], [45, 55], [95, 20], [130, -15]], width: 9 },
  { points: [[10, 90], [-35, 45], [-70, 5], [-95, -25]], width: 9 },
  { points: [[-95, -25], [-60, -32], [-25, -35], [10, -40], [20, -70], [30, -115]], width: 8 },
  { points: [[30, -115], [50, -155], [70, -185], [80, -195]], width: 7 },
  { points: [[130, -15], [165, -50], [165, -95]], width: 8 },
  { points: [[130, -15], [160, 20], [195, 50], [210, 65]], width: 8 },
  { points: [[210, 65], [190, 0], [160, -60], [165, -95]], width: 7 },
  { points: [[-95, -25], [-140, -60], [-185, -105], [-195, -120]], width: 6 },
  { points: [[10, 90], [0, 130], [-10, 165]], width: 6 },
  { points: [[210, 65], [230, 100], [240, 140]], width: 6 },
];

export const HILLS: { x: number; z: number; height: number; radius: number }[] = [
  { x: -195, z: -120, height: 16, radius: 70 },
  { x: 30, z: -115, height: 9, radius: 55 },
  { x: 130, z: -15, height: 4, radius: 50 },
  { x: 10, z: 85, height: 5, radius: 60 },
  { x: -95, z: -25, height: 6, radius: 45 },
  { x: 165, z: -95, height: 8, radius: 55 },
  { x: -30, z: 150, height: 10, radius: 50 },
  { x: 220, z: -20, height: 12, radius: 60 },
];

export const LANDMARKS: {
  id: string;
  name: string;
  nameFr: string;
  district: DistrictId;
  pos: [number, number];
  kind: 'viewpoint' | 'monument' | 'lake' | 'museum' | 'market_hall' | 'university_gate' | 'roundabout';
  description: string;
  descriptionFr: string;
}[] = [
  { id: 'febe_viewpoint', name: 'Mont Febe Viewpoint', nameFr: 'Point de vue du Mont Fébé', district: 'mont_febe', pos: [-195, -120], kind: 'viewpoint', description: 'A quiet balcony over the city. Bring a camera.', descriptionFr: 'Un balcon calme sur la ville. Prends ton appareil photo.' },
  { id: 'lac_path', name: 'Lac Municipal Path', nameFr: 'Sentier du Lac Municipal', district: 'lac_municipal', pos: [80, -195], kind: 'lake', description: 'Lakeside walk, good for meetups and calm talks.', descriptionFr: 'Promenade au bord du lac, idéale pour se retrouver et discuter.' },
  { id: 'nlongkak_roundabout', name: 'Nlongkak Roundabout', nameFr: 'Rond-point Nlongkak', district: 'nlongkak', pos: [-95, -25], kind: 'roundabout', description: 'The taxi junction everyone knows.', descriptionFr: 'Le carrefour des taxis que tout le monde connaît.' },
  { id: 'university_gate', name: 'University Gate', nameFr: 'Portail Universitaire', district: 'ngoa_ekelle', pos: [30, -110], kind: 'university_gate', description: 'Study groups, photocopy kiosks, cheap food.', descriptionFr: "Groupes d'étude, kiosques, nourriture pas chère." },
  { id: 'mokolo_hall', name: 'Mokolo Market Hall', nameFr: 'Halle du Marché Mokolo', district: 'mokolo', pos: [130, -15], kind: 'market_hall', description: 'Wholesale before noon, bargains if you practice.', descriptionFr: 'Gros avant midi, bonnes affaires si tu t\'exerces.' },
  { id: 'boulevard_parade', name: 'Boulevard du 20 Mai', nameFr: 'Boulevard du 20 Mai', district: 'boulevard', pos: [-25, -35], kind: 'monument', description: 'The city gathers here. Parades and public events.', descriptionFr: 'La ville se rassemble ici. Défilés et événements publics.' },
];

export function districtAt(x: number, z: number): DistrictId {
  let best: DistrictId = 'mvog_mbi';
  let bestD = Infinity;
  for (const zone of ZONES) {
    const dx = x - zone.center[0];
    const dz = z - zone.center[1];
    const d = Math.sqrt(dx * dx + dz * dz) / zone.radius;
    if (d < bestD) {
      bestD = d;
      best = zone.id;
    }
  }
  return best;
}
