import type { GameState, NeedsState, NeedKey } from './types';

export const NEED_KEYS: NeedKey[] = ['energy', 'hunger', 'hygiene', 'health', 'mood', 'social'];

export const NEED_LABELS: Record<NeedKey, { en: string; fr: string; icon: string }> = {
  energy: { en: 'Energy', fr: 'Énergie', icon: 'bolt' },
  hunger: { en: 'Fullness', fr: 'Satiété', icon: 'food' },
  hygiene: { en: 'Hygiene', fr: 'Hygiène', icon: 'water' },
  health: { en: 'Health', fr: 'Santé', icon: 'health' },
  mood: { en: 'Mood', fr: 'Humeur', icon: 'mood' },
  social: { en: 'Social', fr: 'Social', icon: 'people' },
};

const DECAY_PER_HOUR: Record<NeedKey, number> = {
  energy: 5.5,
  hunger: 6.5,
  hygiene: 3.2,
  health: 0.4,
  mood: 2.2,
  social: 2.6,
};

export function decayNeeds(state: GameState, gameMinutes: number) {
  const relaxed = state.settings.relaxedNeeds ? 0.45 : 1;
  const hours = gameMinutes / 60;
  const n = state.player.needs;
  n.energy = clamp(n.energy - DECAY_PER_HOUR.energy * hours * relaxed);
  n.hunger = clamp(n.hunger - DECAY_PER_HOUR.hunger * hours * relaxed);
  n.hygiene = clamp(n.hygiene - DECAY_PER_HOUR.hygiene * hours * relaxed);
  n.social = clamp(n.social - DECAY_PER_HOUR.social * hours * relaxed);
  n.mood = clamp(n.mood - DECAY_PER_HOUR.mood * hours * relaxed);

  if (n.hunger < 15) {
    n.health = clamp(n.health - 1.6 * hours);
    n.mood = clamp(n.mood - 1.2 * hours);
  } else if (n.hunger > 60 && n.energy > 40) {
    n.health = clamp(n.health + 0.6 * hours);
  }
  if (n.energy < 10) {
    n.mood = clamp(n.mood - 1.0 * hours);
  }
  if (n.hygiene < 20) {
    n.mood = clamp(n.mood - 0.8 * hours);
    n.social = clamp(n.social - 0.5 * hours);
  }
}

export function applyNeedEffects(needs: NeedsState, effects: Partial<NeedsState> | undefined) {
  if (!effects) return;
  for (const key of NEED_KEYS) {
    const delta = effects[key];
    if (typeof delta === 'number') {
      needs[key] = clamp(needs[key] + delta);
    }
  }
}

export function qualityModifier(needs: NeedsState): { value: number; label: string; labelFr: string } {
  if (needs.energy < 25) return { value: -0.1, label: 'You are tired: work quality -10%', labelFr: 'Tu es fatigué : qualité -10%' };
  if (needs.hunger < 20) return { value: -0.1, label: 'You are hungry: focus -10%', labelFr: 'Tu as faim : concentration -10%' };
  if (needs.mood < 25) return { value: -0.08, label: 'Your mood is low: performance -8%', labelFr: 'Mauvaise humeur : performance -8%' };
  return { value: 0, label: '', labelFr: '' };
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export function dayPart(minute: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (minute >= 300 && minute < 720) return 'morning';
  if (minute >= 720 && minute < 1020) return 'afternoon';
  if (minute >= 1020 && minute < 1260) return 'evening';
  return 'night';
}

export function formatClock(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
