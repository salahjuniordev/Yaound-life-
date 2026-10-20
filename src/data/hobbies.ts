import type { SkillKey } from '../sim/types';

export interface HobbyDef {
  id: string;
  name: string;
  nameFr: string;
  icon: string;
  skill: SkillKey;
  activities: string[];
  thresholds: number[];
  gear: { name: string; nameFr: string; cost: number };
  competition: { name: string; nameFr: string; minutes: number; entryCost: number; basePrize: number; cooldownDays: number };
}

export const HOBBY_DEFS: HobbyDef[] = [
  {
    id: 'football',
    name: 'Football',
    nameFr: 'Football',
    icon: 'ball',
    skill: 'fitness',
    activities: ['football_pitch'],
    thresholds: [10, 25, 50, 90, 140],
    gear: { name: 'Good boots', nameFr: 'Bons crampons', cost: 12000 },
    competition: { name: 'Quartier tournament', nameFr: 'Tournoi de quartier', minutes: 240, entryCost: 2000, basePrize: 20000, cooldownDays: 3 },
  },
  {
    id: 'music',
    name: 'Music',
    nameFr: 'Musique',
    icon: 'music',
    skill: 'music',
    activities: ['music_practice', 'record_track', 'music_session', 'music_gig_paid', 'karaoke_night'],
    thresholds: [10, 25, 50, 90, 140],
    gear: { name: 'Home keyboard', nameFr: 'Clavier maison', cost: 25000 },
    competition: { name: 'Open mic night', nameFr: 'Scène ouverte', minutes: 180, entryCost: 1500, basePrize: 18000, cooldownDays: 3 },
  },
  {
    id: 'photography',
    name: 'Photography',
    nameFr: 'Photographie',
    icon: 'camera',
    skill: 'creativity',
    activities: ['photo_walk'],
    thresholds: [8, 20, 45, 80, 130],
    gear: { name: 'Prime lens', nameFr: 'Objectif fixe', cost: 30000 },
    competition: { name: 'City photo contest', nameFr: 'Concours photo de la ville', minutes: 240, entryCost: 2500, basePrize: 22000, cooldownDays: 4 },
  },
  {
    id: 'cooking',
    name: 'Cooking',
    nameFr: 'Cuisine',
    icon: 'pot',
    skill: 'cooking',
    activities: ['cook_meal', 'cook_ndole'],
    thresholds: [8, 20, 45, 80, 130],
    gear: { name: 'Quality pots', nameFr: 'Marmites de qualité', cost: 15000 },
    competition: { name: 'Neighbourhood cook-off', nameFr: 'Concours de cuisine du quartier', minutes: 180, entryCost: 2000, basePrize: 16000, cooldownDays: 3 },
  },
  {
    id: 'dance',
    name: 'Dance',
    nameFr: 'Danse',
    icon: 'note',
    skill: 'charisma',
    activities: ['dance_practice'],
    thresholds: [8, 20, 45, 80, 130],
    gear: { name: 'Bluetooth speaker', nameFr: 'Enceinte Bluetooth', cost: 18000 },
    competition: { name: 'Dance battle', nameFr: 'Battle de danse', minutes: 180, entryCost: 1500, basePrize: 17000, cooldownDays: 3 },
  },
];

export const HOBBY_MAP: Record<string, HobbyDef> = Object.fromEntries(HOBBY_DEFS.map((h) => [h.id, h]));

export const MAX_HOBBY_LEVEL = 5;

export function hobbyLevelFor(hobbyId: string, xp: number): number {
  const def = HOBBY_MAP[hobbyId];
  if (!def) return 0;
  let level = 0;
  for (const t of def.thresholds) if (xp >= t) level += 1;
  return level;
}

export function hobbyXpForActivity(activityId: string): HobbyDef | undefined {
  return HOBBY_DEFS.find((h) => h.activities.includes(activityId));
}

export function hobbyProgressFor(hobbyId: string, xp: number): { level: number; xpInLevel: number; levelSpan: number | null } {
  const level = hobbyLevelFor(hobbyId, xp);
  const def = HOBBY_MAP[hobbyId];
  if (!def || level >= MAX_HOBBY_LEVEL) return { level, xpInLevel: xp, levelSpan: null };
  const floor = level > 0 ? def.thresholds[level - 1] : 0;
  return { level, xpInLevel: Math.round((xp - floor) * 10) / 10, levelSpan: def.thresholds[level] - floor };
}
