import type { DistrictId, GameState, NPCState, ScheduleSlot } from './types';
import { npcSchedulePosition } from '../data/places';
import { RNG, seedFromString } from './rng';

export function currentScheduleSlot(npc: NPCState, minute: number): ScheduleSlot | null {
  const h = minute % 1440;
  for (const slot of npc.schedule) {
    const from = slot.from % 1440;
    const to = slot.to % 1440;
    const wraps = to <= from;
    const inSlot = wraps ? h >= from || h < to : h >= from && h < to;
    if (inSlot) return slot;
  }
  return null;
}

export function npcPositionFor(npc: NPCState, minute: number): { district: DistrictId; pos: [number, number] } {
  const slot = currentScheduleSlot(npc, minute);
  const place = slot?.place ?? npc.homeDistrict;
  const base = npcSchedulePosition(place);
  const rng = new RNG(seedFromString(npc.id));
  const ox = rng.range(-3.5, 3.5);
  const oz = rng.range(-3.5, 3.5);
  return { district: base.district, pos: [base.pos[0] + ox, base.pos[1] + oz] };
}

export function npcActivityText(npc: NPCState, minute: number, fr: boolean): string {
  const slot = currentScheduleSlot(npc, minute);
  if (!slot) return fr ? 'Se repose' : 'Resting';
  const map: Record<string, { en: string; fr: string }> = {
    buying_fresh_produce: { en: 'Buying fresh produce', fr: 'Achète des produits frais' },
    running_restaurant: { en: 'Running the restaurant', fr: 'Gère le restaurant' },
    closing_shop: { en: 'Closing the shop', fr: 'Ferme la boutique' },
    sleeping: { en: 'Sleeping', fr: 'Dort' },
    selling_wholesale: { en: 'Selling wholesale', fr: 'Vend en gros' },
    lunch: { en: 'Eating lunch', fr: 'Déjeune' },
    family_time: { en: 'Family time', fr: 'Temps en famille' },
    riding: { en: 'Riding passengers', fr: 'Transporte des clients' },
    refueling: { en: 'Refueling', fr: 'Fait le plein' },
    parking_bike: { en: 'Parking the bike', fr: 'Gare la moto' },
    classes: { en: 'In class', fr: 'En cours' },
    studying: { en: 'Studying', fr: 'Étudie' },
    study_group: { en: 'Study group', fr: 'Groupe d\'étude' },
    resting: { en: 'Resting', fr: 'Se repose' },
    managing: { en: 'Managing the shop', fr: 'Gère la boutique' },
    supplies: { en: 'Buying supplies', fr: 'Achète des fournitures' },
    shifts: { en: 'On shift', fr: 'En service' },
    market_run: { en: 'Market run', fr: 'Courses au marché' },
    coaching: { en: 'Coaching', fr: 'Entraîne' },
    watching_matches: { en: 'Watching matches', fr: 'Regarde les matchs' },
    collecting_contributions: { en: 'Collecting njangi contributions', fr: 'Collecte les cotisations' },
    bookkeeping: { en: 'Doing the books', fr: 'Tient les comptes' },
    sitting: { en: 'At the njangi sitting', fr: 'À la réunion njangi' },
    checking_prices: { en: 'Checking market prices', fr: 'Vérifie les prix' },
    closing: { en: 'Closing up', fr: 'Ferme' },
    selling_vegetables: { en: 'Selling vegetables', fr: 'Vend des légumes' },
    looking_for_deals: { en: 'Looking for deals', fr: 'Cherche des affaires' },
    trading: { en: 'Trading', fr: 'Commerce' },
    networking: { en: 'Networking at the bar', fr: 'Réseautage au bar' },
    planning: { en: 'Planning tomorrow', fr: 'Planifie demain' },
    rehearsing: { en: 'Rehearsing', fr: 'Répète' },
    recording: { en: 'Recording music', fr: 'Enregistre' },
    performing: { en: 'Performing', fr: 'Se produit' },
    promoting: { en: 'Promoting the show', fr: 'Fait la promo' },
    training: { en: 'Training', fr: 'S\'entraîne' },
    teaching: { en: 'Teaching', fr: 'Enseigne' },
    job_hunting: { en: 'Job hunting', fr: 'Cherche du travail' },
  };
  const entry = map[slot.activity];
  if (!entry) return fr ? 'Occupé' : 'Busy';
  return fr ? entry.fr : entry.en;
}

export interface CrowdMember {
  id: string;
  pos: [number, number];
  district: DistrictId;
  shirt: string;
  pants: string;
  skin: number;
  hair: number;
  speed: number;
  phase: number;
  moving: boolean;
}

const CROWD_SHIRTS = ['#e0532f', '#2f6fe0', '#f2b134', '#2fa05a', '#8e44ad', '#e8e2d4', '#d94f6b', '#3b7ea1', '#c97b2f'];
const CROWD_PANTS = ['#2c3e50', '#3a2f28', '#5c6b73', '#1f2a30', '#4b3b6b', '#6d4c41'];

export function crowdForDistrict(district: DistrictId, day: number, minute: number, count: number, zoneCenter: [number, number], radius: number): CrowdMember[] {
  const rng = new RNG(seedFromString(`${district}_${day}_${Math.floor(minute / 180)}`));
  const members: CrowdMember[] = [];
  const hour = minute / 60;
  const isNight = hour >= 20 || hour < 5.5;
  const rushFactor = (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19.5) ? 1 : 0.55;
  const n = Math.max(4, Math.round(count * rushFactor * (isNight ? 0.35 : 1)));
  for (let i = 0; i < n; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(4, radius);
    members.push({
      id: `${district}_${i}`,
      pos: [zoneCenter[0] + Math.cos(angle) * dist, zoneCenter[1] + Math.sin(angle) * dist],
      district,
      shirt: rng.pick(CROWD_SHIRTS),
      pants: rng.pick(CROWD_PANTS),
      skin: rng.int(0, 7),
      hair: rng.int(0, 5),
      speed: rng.range(0.6, 1.8),
      phase: rng.range(0, Math.PI * 2),
      moving: rng.chance(isNight ? 0.25 : 0.6),
    });
  }
  return members;
}

export interface CityNewsItem {
  day: number;
  text: string;
  textFr: string;
}

const NEWS_TEMPLATES: { en: string; fr: string; cond?: (day: number) => boolean }[] = [
  { en: 'Mokolo traders report strong morning sales this week.', fr: 'Les commerçants de Mokolo signalent de bonnes ventes matinales.' },
  { en: 'Delestage rotations announced for eastern quartiers — charge devices early.', fr: 'Rotations de délestage annoncées dans les quartiers est — chargez tôt.' },
  { en: 'University clubs announce a weekend tournament at the campus pitch.', fr: 'Les clubs universitaires annoncent un tournoi ce week-end sur le terrain du campus.' },
  { en: 'Fuel prices stable at the pumps today, taxi fares unchanged.', fr: 'Prix du carburant stables, tarifs de taxi inchangés.' },
  { en: 'A new bakery opened on the Nlongkak commercial street.', fr: 'Une nouvelle boulangerie a ouvert à Nlongkak.' },
  { en: 'Rain expected in the afternoons — vendors cover your stock.', fr: 'Pluie attendue les après-midis — couvrez vos marchandises.' },
  { en: 'Njangi groups report healthy participation this month.', fr: 'Les groupes de njangi rapportent une bonne participation ce mois-ci.' },
  { en: 'Football fans prepare for Sunday\'s neighborhood derby.', fr: 'Les supporters préparent le derby de quartier de dimanche.', cond: (d) => d % 7 === 5 },
  { en: 'Phone repair kiosks busy — protect your screens.', fr: 'Les kiosques de réparation sont occupés — protégez vos écrans.' },
  { en: 'Local musicians announce an open mic night in Nlongkak.', fr: 'Des musiciens locaux annoncent une scène ouverte à Nlongkak.' },
];

export function generateCityNews(state: GameState): CityNewsItem[] {
  const rng = new RNG(seedFromString(`news_${state.characterId}_${state.world.day}`));
  const pool = NEWS_TEMPLATES.filter((n) => !n.cond || n.cond(state.world.day));
  const picked = new Set<number>();
  const items: CityNewsItem[] = [];
  while (items.length < 3 && picked.size < pool.length) {
    const idx = rng.int(0, pool.length - 1);
    if (picked.has(idx)) continue;
    picked.add(idx);
    items.push({ day: state.world.day, text: pool[idx].en, textFr: pool[idx].fr });
  }
  return items;
}
