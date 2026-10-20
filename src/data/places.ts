import type { DistrictId } from '../sim/types';

export type PlaceKind = 'home' | 'vendor' | 'activity' | 'taxi' | 'landmark' | 'interior' | 'npc_spot';

export interface PlaceDef {
  id: string;
  name: string;
  nameFr: string;
  kind: PlaceKind;
  district: DistrictId;
  pos: [number, number];
  interior?: string;
  activities?: string[];
  vendor?: string;
  landmarkId?: string;
  icon: string;
}

export const PLACES: PlaceDef[] = [
  { id: 'home_mvog_mbi', name: 'Your room (Mvog-Mbi)', nameFr: 'Ta chambre (Mvog-Mbi)', kind: 'home', district: 'mvog_mbi', pos: [4, 74], interior: 'home_room', icon: 'home' },
  { id: 'home_ngoa_ekelle', name: 'Student room (Ngoa-Ekelle)', nameFr: 'Chambre étudiante (Ngoa-Ekelle)', kind: 'home', district: 'ngoa_ekelle', pos: [22, -98], interior: 'home_room', icon: 'home' },
  { id: 'home_mokolo', name: "Cousin's place (Mokolo)", nameFr: 'Chez le cousin (Mokolo)', kind: 'home', district: 'mokolo', pos: [112, -2], interior: 'home_room', icon: 'home' },
  { id: 'home_nlongkak', name: 'Your flat (Nlongkak)', nameFr: 'Ton appart (Nlongkak)', kind: 'home', district: 'nlongkak', pos: [-84, -12], interior: 'home_room', icon: 'home' },
  { id: 'home_mvan', name: 'Rented room (Mvan)', nameFr: 'Chambre louée (Mvan)', kind: 'home', district: 'mvan', pos: [200, 55], interior: 'home_room', icon: 'home' },

  { id: 'beignet_stand', name: 'Beignet stand', nameFr: 'Stand de beignets', kind: 'vendor', district: 'mvog_mbi', pos: [12, 66], vendor: 'street_food', activities: ['eat_beignets', 'buy_water'], icon: 'food' },
  { id: 'soya_stand', name: 'Evening soya grill', nameFr: 'Grill de soya', kind: 'vendor', district: 'nlongkak', pos: [-90, -45], vendor: 'soya', activities: ['eat_soya', 'buy_water'], icon: 'food' },
  { id: 'koki_vendor', name: 'Koki vendor', nameFr: 'Vendeuse de koki', kind: 'vendor', district: 'mvog_mbi', pos: [2, 92], vendor: 'koki', activities: ['eat_koki', 'drink_jus'], icon: 'food' },
  { id: 'poisson_grill', name: 'Poisson braise grill', nameFr: 'Grill poisson braisé', kind: 'vendor', district: 'mokolo', pos: [142, -32], vendor: 'poisson', activities: ['eat_poisson'], icon: 'food' },
  { id: 'restaurant_ada', name: 'Chez Mama Ada', nameFr: 'Chez Mama Ada', kind: 'interior', district: 'nlongkak', pos: [-102, -20], interior: 'restaurant', vendor: 'restaurant', activities: ['eat_ndole'], icon: 'food' },
  { id: 'food_campus', name: 'Campus canteen', nameFr: 'Cantine du campus', kind: 'vendor', district: 'ngoa_ekelle', pos: [34, -118], vendor: 'canteen', activities: ['eat_beignets', 'drink_jus'], icon: 'food' },

  { id: 'market_veg', name: 'Auntie Miranda\'s stall', nameFr: 'Étal de Tante Miranda', kind: 'vendor', district: 'mokolo', pos: [124, -18], vendor: 'market_food', activities: ['market_browse', 'bargain_practice'], icon: 'market' },
  { id: 'market_wholesale', name: 'Papa Ngassa - wholesale', nameFr: 'Papa Ngassa - gros', kind: 'vendor', district: 'mokolo', pos: [138, -22], vendor: 'wholesale', activities: ['source_stock'], icon: 'box' },
  { id: 'market_goods', name: 'Goods stalls', nameFr: 'Étals de marchandises', kind: 'vendor', district: 'mokolo', pos: [128, -8], vendor: 'goods', activities: ['market_browse', 'sell_on_street'], icon: 'box' },

  { id: 'cyber_shop', name: 'Cyber Poste Vert', nameFr: 'Cyber Poste Vert', kind: 'interior', district: 'nlongkak', pos: [-88, -33], interior: 'cyber', vendor: 'cyber', activities: ['cyber_work'], icon: 'laptop' },
  { id: 'shop_mbarga', name: 'Ets. Mbarga Freres', nameFr: 'Ets. Mbarga Frères', kind: 'interior', district: 'nlongkak', pos: [-100, -30], interior: 'shop', vendor: 'general_shop', activities: [], icon: 'shop' },
  { id: 'clinic_mvog', name: 'Mvog-Mbi Health Post', nameFr: 'Poste de santé Mvog-Mbi', kind: 'interior', district: 'mvog_mbi', pos: [26, 94], interior: 'clinic', vendor: 'clinic', activities: ['clinic_visit'], icon: 'health' },
  { id: 'pharmacy', name: 'Pharmacy', nameFr: 'Pharmacie', kind: 'vendor', district: 'nlongkak', pos: [-84, -24], vendor: 'pharmacy', activities: ['pharmacy'], icon: 'health' },
  { id: 'gym_nlongkak', name: 'Body Workshop Gym', nameFr: 'Salle Body Workshop', kind: 'interior', district: 'nlongkak', pos: [-106, -42], interior: 'gym', activities: ['gym'], icon: 'gym' },
  { id: 'bar_lounge', name: 'Le Kiosque Lounge', nameFr: 'Le Kiosque Lounge', kind: 'interior', district: 'nlongkak', pos: [-92, -48], interior: 'bar', vendor: 'bar', activities: ['bar_night', 'watch_match', 'karaoke_night', 'dance_practice'], icon: 'drink' },
  { id: 'pitch_mvog', name: 'Quartier football pitch', nameFr: 'Terrain de quartier', kind: 'activity', district: 'mvog_mbi', pos: [42, 104], activities: ['football_pitch', 'jog_mont'], icon: 'ball' },
  { id: 'library', name: 'University Library', nameFr: 'Bibliothèque universitaire', kind: 'interior', district: 'ngoa_ekelle', pos: [26, -108], interior: 'library', activities: ['library_study', 'study_group'], icon: 'book' },
  { id: 'campus_gate', name: 'Campus gate', nameFr: 'Portail du campus', kind: 'activity', district: 'ngoa_ekelle', pos: [30, -112], activities: ['study_group', 'networking'], icon: 'book' },
  { id: 'bank_centre', name: 'Bank - Centre', nameFr: 'Banque - Centre', kind: 'interior', district: 'boulevard', pos: [-30, -28], interior: 'bank', vendor: 'bank', activities: ['bank_queue'], icon: 'bank' },
  { id: 'momo_kiosk', name: 'MoMo kiosk', nameFr: 'Kiosque MoMo', kind: 'vendor', district: 'mvog_mbi', pos: [8, 62], vendor: 'momo', activities: ['momo_agent'], icon: 'phone' },
  { id: 'salon', name: 'Salon & barber', nameFr: 'Salon & coiffure', kind: 'interior', district: 'nlongkak', pos: [-80, -32], interior: 'salon', activities: ['haircut', 'tailor_order'], icon: 'scissors' },
  { id: 'tailor', name: 'Tailor workshop', nameFr: 'Atelier de couture', kind: 'interior', district: 'mokolo', pos: [130, -4], interior: 'tailor', activities: ['tailor_order'], icon: 'scissors' },
  { id: 'njangi_salle', name: 'Njangi meeting hall', nameFr: 'Salle de njangi', kind: 'interior', district: 'mvog_mbi', pos: [0, 96], interior: 'njangi', activities: [], icon: 'people' },
  { id: 'mechanic_mvan', name: 'Mvan workshop', nameFr: 'Atelier Mvan', kind: 'interior', district: 'mvan', pos: [206, 62], interior: 'workshop', activities: [], icon: 'tool' },
  { id: 'studio_nlongkak', name: 'Recording studio', nameFr: 'Studio d\'enregistrement', kind: 'interior', district: 'nlongkak', pos: [-98, -52], interior: 'studio', activities: ['record_track', 'music_practice'], icon: 'mic' },
  { id: 'museum', name: 'National Museum', nameFr: 'Musée National', kind: 'landmark', district: 'boulevard', pos: [-18, -48], landmarkId: 'museum', activities: ['museum_visit', 'photo_walk'], icon: 'museum' },
  { id: 'church_mvog', name: 'Parish church', nameFr: 'Église paroissiale', kind: 'activity', district: 'mvog_mbi', pos: [16, 100], activities: ['church_visit'], icon: 'church' },
  { id: 'mosque_mokolo', name: 'Central mosque', nameFr: 'Mosquée centrale', kind: 'activity', district: 'mokolo', pos: [134, -6], activities: ['mosque_visit'], icon: 'mosque' },
  { id: 'school_mvog', name: 'Bright Future School', nameFr: 'École Bright Future', kind: 'interior', district: 'mvog_mbi', pos: [22, 86], interior: 'school', activities: [], icon: 'book' },
  { id: 'febe_viewpoint', name: 'Mont Febe viewpoint', nameFr: 'Point de vue Mont Fébé', kind: 'landmark', district: 'mont_febe', pos: [-195, -120], landmarkId: 'febe_viewpoint', activities: ['mont_febe_walk', 'photo_walk', 'jog_mont'], icon: 'tree' },
  { id: 'lac_path', name: 'Lac Municipal path', nameFr: 'Sentier du Lac Municipal', kind: 'landmark', district: 'lac_municipal', pos: [80, -192], landmarkId: 'lac_path', activities: ['lac_walk', 'photo_walk'], icon: 'tree' },
  { id: 'univ_gate_landmark', name: 'University Gate landmark', nameFr: 'Portail universitaire', kind: 'landmark', district: 'ngoa_ekelle', pos: [30, -112], landmarkId: 'university_gate', activities: ['photo_walk'], icon: 'photo' },
  { id: 'market_hall_landmark', name: 'Mokolo Market Hall', nameFr: 'Halle Mokolo', kind: 'landmark', district: 'mokolo', pos: [130, -14], landmarkId: 'mokolo_hall', activities: ['photo_walk'], icon: 'photo' },
  { id: 'boulevard_landmark', name: 'Boulevard du 20 Mai', nameFr: 'Boulevard du 20 Mai', kind: 'landmark', district: 'boulevard', pos: [-25, -36], landmarkId: 'boulevard_parade', activities: ['photo_walk', 'volunteer_cleanup'], icon: 'photo' },
  { id: 'roundabout_nlongkak', name: 'Nlongkak Roundabout', nameFr: 'Rond-point Nlongkak', kind: 'landmark', district: 'nlongkak', pos: [-95, -25], landmarkId: 'nlongkak_roundabout', activities: ['photo_walk', 'public_transport_learn'], icon: 'photo' },

  { id: 'taxi_mvog', name: 'Taxi point - Mvog-Mbi', nameFr: 'Point taxi - Mvog-Mbi', kind: 'taxi', district: 'mvog_mbi', pos: [0, 82], icon: 'bus' },
  { id: 'taxi_mokolo', name: 'Taxi point - Mokolo', nameFr: 'Point taxi - Mokolo', kind: 'taxi', district: 'mokolo', pos: [126, -16], icon: 'bus' },
  { id: 'taxi_nlongkak', name: 'Taxi point - Nlongkak', nameFr: 'Point taxi - Nlongkak', kind: 'taxi', district: 'nlongkak', pos: [-94, -26], icon: 'bus' },
  { id: 'taxi_univ', name: 'Taxi point - University', nameFr: 'Point taxi - Université', kind: 'taxi', district: 'ngoa_ekelle', pos: [32, -108], icon: 'bus' },
  { id: 'taxi_mvan', name: 'Mvan transport hub', nameFr: 'Gare de Mvan', kind: 'taxi', district: 'mvan', pos: [210, 66], icon: 'bus' },
  { id: 'taxi_boulevard', name: 'Taxi point - Boulevard', nameFr: 'Point taxi - Boulevard', kind: 'taxi', district: 'boulevard', pos: [-26, -34], icon: 'bus' },
  { id: 'taxi_febe', name: 'Taxi point - Mont Febe', nameFr: 'Point taxi - Mont Fébé', kind: 'taxi', district: 'mont_febe', pos: [-185, -112], icon: 'bus' },
  { id: 'taxi_lac', name: 'Taxi point - Lac', nameFr: 'Point taxi - Lac', kind: 'taxi', district: 'lac_municipal', pos: [72, -186], icon: 'bus' },
  { id: 'taxi_bastos', name: 'Taxi point - Bastos', nameFr: 'Point taxi - Bastos', kind: 'taxi', district: 'bastos', pos: [160, -88], icon: 'bus' },
];

export const PLACE_MAP: Record<string, PlaceDef> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

export const PLACE_POSITIONS: Record<string, { district: DistrictId; pos: [number, number] }> = {};
for (const p of PLACES) {
  if (!PLACE_POSITIONS[p.id]) PLACE_POSITIONS[p.id] = { district: p.district, pos: p.pos };
}

export const NPC_PLACE_ALIASES: Record<string, { district: DistrictId; pos: [number, number] }> = {
  market_mokolo: { district: 'mokolo', pos: [130, -15] },
  market_wholesale: { district: 'mokolo', pos: [138, -22] },
  market_stall: { district: 'mokolo', pos: [124, -18] },
  restaurant_nlongkak: { district: 'nlongkak', pos: [-102, -20] },
  street_nlongkak: { district: 'nlongkak', pos: [-95, -25] },
  home_mvog_mbi: { district: 'mvog_mbi', pos: [10, 85] },
  home_ngoa_ekelle: { district: 'ngoa_ekelle', pos: [30, -115] },
  home_nlongkak: { district: 'nlongkak', pos: [-95, -25] },
  junction_mvan: { district: 'mvan', pos: [210, 65] },
  junction_mvog: { district: 'mvog_mbi', pos: [0, 82] },
  fuel_station: { district: 'mvog_mbi', pos: [30, 60] },
  street_mvog: { district: 'mvog_mbi', pos: [12, 76] },
  campus: { district: 'ngoa_ekelle', pos: [30, -112] },
  campus_canteen: { district: 'ngoa_ekelle', pos: [34, -118] },
  library: { district: 'ngoa_ekelle', pos: [26, -108] },
  cyber_nlongkak: { district: 'nlongkak', pos: [-88, -33] },
  clinic_mvog: { district: 'mvog_mbi', pos: [26, 94] },
  market_mvog: { district: 'mvog_mbi', pos: [12, 66] },
  pitch_mvog: { district: 'mvog_mbi', pos: [42, 104] },
  bar_mvog: { district: 'mvog_mbi', pos: [-2, 90] },
  bar_nlongkak: { district: 'nlongkak', pos: [-92, -48] },
  salle_njangi: { district: 'mvog_mbi', pos: [0, 96] },
  shop_nlongkak: { district: 'nlongkak', pos: [-100, -30] },
};

export function npcSchedulePosition(place: string, opts?: { jitter?: number }): { district: DistrictId; pos: [number, number] } {
  const base = NPC_PLACE_ALIASES[place] ?? PLACE_POSITIONS[place];
  if (base) return base;
  return { district: 'mvog_mbi', pos: [10, 85] };
}

export const INTERIORS: Record<string, { name: string; nameFr: string; actions: string[]; vendor?: string; special?: string }> = {
  home_room: { name: 'Your room', nameFr: 'Ta chambre', actions: ['sleep', 'nap', 'shower', 'shower_cold', 'clean_room', 'cook_meal', 'cook_ndole', 'eat_leftovers', 'watch_tv', 'listen_music_home', 'study_home', 'charge_phone', 'music_practice'], special: 'home' },
  restaurant: { name: 'Chez Mama Ada', nameFr: 'Chez Mama Ada', actions: ['eat_ndole', 'drink_jus'], vendor: 'restaurant', special: 'counter' },
  cyber: { name: 'Cyber Poste Vert', nameFr: 'Cyber Poste Vert', actions: ['cyber_work'], vendor: 'cyber', special: 'counter' },
  shop: { name: 'Ets. Mbarga Freres', nameFr: 'Ets. Mbarga Frères', actions: [], vendor: 'general_shop', special: 'counter' },
  clinic: { name: 'Health Post', nameFr: 'Poste de santé', actions: ['clinic_visit', 'pharmacy'], vendor: 'clinic', special: 'counter' },
  gym: { name: 'Body Workshop Gym', nameFr: 'Salle de sport', actions: ['gym'], special: 'floor' },
  bar: { name: 'Le Kiosque Lounge', nameFr: 'Le Kiosque Lounge', actions: ['bar_night', 'watch_match', 'karaoke_night', 'dance_practice'], vendor: 'bar', special: 'counter' },
  library: { name: 'University Library', nameFr: 'Bibliothèque', actions: ['library_study', 'study_group'], special: 'floor' },
  bank: { name: 'Bank', nameFr: 'Banque', actions: ['bank_queue'], special: 'bank' },
  salon: { name: 'Salon', nameFr: 'Salon', actions: ['haircut'], special: 'counter' },
  tailor: { name: 'Tailor workshop', nameFr: 'Atelier de couture', actions: ['tailor_order'], special: 'counter' },
  njangi: { name: 'Njangi hall', nameFr: 'Salle de njangi', actions: [], special: 'njangi' },
  workshop: { name: 'Workshop', nameFr: 'Atelier', actions: ['public_transport_learn', 'driving_lessons'], special: 'counter' },
  studio: { name: 'Recording studio', nameFr: 'Studio', actions: ['record_track', 'music_practice'], special: 'floor' },
  school: { name: 'School', nameFr: 'École', actions: [], special: 'counter' },
};
