import type { GameState, MemoryEntry, RelationshipStage, RelationshipState, NPCState } from './types';
import { RNG } from './rng';

export const RELATION_STAGE_LABELS: Record<RelationshipStage, { en: string; fr: string }> = {
  stranger: { en: 'Stranger', fr: 'Inconnu' },
  acquaintance: { en: 'Acquaintance', fr: 'Connaissance' },
  friend: { en: 'Friend', fr: 'Ami' },
  close_friend: { en: 'Close friend', fr: 'Ami proche' },
  colleague: { en: 'Colleague', fr: 'Collègue' },
  business_contact: { en: 'Business contact', fr: 'Contact pro' },
  rival: { en: 'Rival', fr: 'Rival' },
  dating: { en: 'Dating', fr: 'En couple' },
  partner: { en: 'Partner', fr: 'Partenaire' },
};

export function defaultRelationship(npcId: string, day: number): RelationshipState {  return {
    npcId,
    stage: 'stranger',
    trust: 0,
    affection: 0,
    respect: 0,
    compatibility: 0,
    metDay: day,
    lastTalkDay: day,
    memory: [],
  };
}

export function stageFor(rel: RelationshipState, isColleague: boolean): RelationshipStage {
  const score = rel.trust * 0.4 + rel.affection * 0.3 + rel.respect * 0.2 + rel.compatibility * 0.1;
  if (rel.trust < -20 || rel.affection < -20) return 'rival';
  if (rel.affection > 70 && rel.trust > 60) return 'dating';
  if (score > 65) return 'close_friend';
  if (score > 40) return 'friend';
  if (isColleague && score > 15) return 'colleague';
  if (score > 15) return 'acquaintance';
  return 'stranger';
}

export interface RelationDelta {
  trust?: number;
  affection?: number;
  respect?: number;
  compatibility?: number;
  memory?: Omit<MemoryEntry, 'day'>;
}

export function applyRelationDelta(state: GameState, npcId: string, delta: RelationDelta): string {
  const rel = state.relationships[npcId] ?? defaultRelationship(npcId, state.world.day);
  state.relationships[npcId] = rel;
  rel.trust = clampRel(rel.trust + (delta.trust ?? 0));
  rel.affection = clampRel(rel.affection + (delta.affection ?? 0));
  rel.respect = clampRel(rel.respect + (delta.respect ?? 0));
  rel.compatibility = clampRel(rel.compatibility + (delta.compatibility ?? 0));
  rel.lastTalkDay = state.world.day;
  if (delta.memory) {
    rel.memory.push({ day: state.world.day, ...delta.memory });
    if (rel.memory.length > 20) rel.memory.shift();
  }
  const npc = state.npcs[npcId];
  const isColleague = Boolean(npc?.jobId && state.player.job?.jobId === npc.jobId) || Boolean(npc && state.businesses.some((b) => b.staffIds.includes(npcId)));
  const oldStage = rel.stage;
  rel.stage = stageFor(rel, isColleague);
  return rel.stage !== oldStage ? rel.stage : '';
}

function clampRel(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

export function relationshipSummary(state: GameState, npcId: string, fr = false): string {
  const rel = state.relationships[npcId];
  if (!rel) return fr ? 'Vous ne l’avez pas encore rencontré(e).' : 'You have not met them yet.';
  const parts: string[] = [];
  if (rel.trust > 30) parts.push(fr ? 'vous fait confiance' : 'trusts you');
  else if (rel.trust < -10) parts.push(fr ? 'se méfie de vous' : 'wary of you');
  if (rel.affection > 40) parts.push(fr ? 'apprécie votre compagnie' : 'enjoys your company');
  else if (rel.affection < -10) parts.push(fr ? 'garde ses distances' : 'keeps distance');
  if (rel.respect > 40) parts.push(fr ? 'respecte votre travail' : 'respects your work');
  if (rel.memory.length > 0) {
    const last = rel.memory[rel.memory.length - 1];
    parts.push(fr ? `se souvient : ${last.note}` : `remembers: ${last.note}`);
  }
  if (parts.length) return parts.join(', ');
  return fr ? 'Une nouvelle connaissance.' : 'A fresh connection.';
}

export function dailyRelationshipDrift(state: GameState, rng: RNG) {
  for (const rel of Object.values(state.relationships)) {
    const daysSinceTalk = state.world.day - rel.lastTalkDay;
    if (daysSinceTalk > 6) {
      rel.affection = clampRel(rel.affection - 1.5);
      rel.trust = clampRel(rel.trust - 0.5);
    }
    if (rel.stage === 'rival' && rng.chance(0.15)) {
      rel.trust = clampRel(rel.trust + 1);
    }
  }
}

export function npcRelationshipScore(state: GameState, npcId: string): number {
  const rel = state.relationships[npcId];
  if (!rel) return 0;
  return rel.trust * 0.4 + rel.affection * 0.3 + rel.respect * 0.2 + rel.compatibility * 0.1;
}

export function npcDialogueTone(state: GameState, npc: NPCState): 'greeting' | 'friendly' | 'busy' {
  const score = npcRelationshipScore(state, npc.id);
  const hour = state.world.minute;
  const slot = npc.schedule.find((s) => {
    const from = s.from % 1440;
    const to = s.to % 1440;
    const wrap = to <= from;
    return wrap ? hour >= from || hour < to : hour >= from && hour < to;
  });
  if (slot && (slot.activity === 'running_restaurant' || slot.activity === 'selling_wholesale' || slot.activity === 'managing') && score < 40) {
    return 'busy';
  }
  if (score > 35) return 'friendly';
  return 'greeting';
}
