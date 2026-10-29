import type {
  Appearance,
  BackgroundId,
  GameSettings,
  GameState,
  InventoryItem,
  Message,
  NeedsState,
  NPCState,
  PhoneState,
  SkillKey,
  WorldStateData,
  NjangiGroup,
} from './types';
import { BACKGROUND_MAP } from '../data/backgrounds';
import { NAMED_NPCS } from '../data/npcs';
import { VEHICLE_MAP } from '../data/vehicles';
import { RNG, seedFromString } from './rng';
import { defaultRelationship } from './relationships';
import { ZONES } from '../data/districts';
import { createCityHallState, ensureCityHall, syncCityFlags } from './city';

const ALL_SKILLS: SkillKey[] = ['cooking', 'driving', 'sales', 'negotiation', 'management', 'marketing', 'tech', 'creativity', 'music', 'fitness', 'academics', 'charisma'];

export interface NewGameOptions {
  name: string;
  gender: 'm' | 'f' | 'x';
  background: BackgroundId;
  appearance: Appearance;
  settings?: Partial<GameSettings>;
}

export function defaultSettings(overrides?: Partial<GameSettings>): GameSettings {
  return {
    language: 'en',
    quality: 'mid',
    qualityAuto: true,
    relaxedNeeds: false,
    camfranglais: 'light',
    sound: true,
    notifications: true,
    dataSaver: false,
    reduceMotion: false,
    textSize: 'normal',
    ...overrides,
  };
}

export function createInitialWorldState(seedRng: RNG): WorldStateData {
  return {
    day: 1,
    minute: 7 * 60,
    dayOfWeek: 1,
    weather: seedRng.chance(0.25) ? 'rain' : seedRng.chance(0.35) ? 'cloud' : 'sun',
    fuelPrice: 840,
    outages: {},
    strike: false,
    matchDay: false,
    marketDay: true,
    headlines: [],
  };
}

export function createNPCs(rng: RNG): Record<string, NPCState> {
  const npcs: Record<string, NPCState> = {};
  for (const seed of NAMED_NPCS) {
    npcs[seed.id] = {
      id: seed.id,
      name: seed.name,
      role: seed.role,
      homeDistrict: seed.homeDistrict,
      district: seed.homeDistrict,
      traits: seed.traits,
      schedule: seed.schedule,
      vendorKind: seed.vendorKind,
      jobId: seed.jobId,
      morale: rng.range(55, 85),
      skill: rng.range(2, 7),
      reliability: rng.range(0.6, 0.98),
    };
  }
  return npcs;
}

function createNjangiGroups(rng: RNG): NjangiGroup[] {
  return [
    {
      id: 'njangi_mvog_reliable',
      name: "Uncle Baba's Njangi (Mvog-Mbi)",
      organizerId: 'uncle_baba',
      members: ['uncle_baba', 'mama_ada', 'sister_grace', 'coach_jules', 'auntie_miranda'],
      contribution: 5000,
      reliabilityOf: {
        uncle_baba: 0.98,
        mama_ada: 0.95,
        sister_grace: 0.97,
        coach_jules: 0.88,
        auntie_miranda: 0.92,
      },
      potHistory: [],
      sketchy: false,
      joinFee: 0,
      maxMembers: 8,
      status: 'active',
    },
    {
      id: 'njangi_digital_fast',
      name: '"Fast Pot" Digital Tontine',
      organizerId: 'david_hustler',
      members: ['david_hustler'],
      contribution: 2000,
      reliabilityOf: { david_hustler: 0.6 },
      potHistory: [],
      sketchy: true,
      joinFee: 1000,
      maxMembers: 6,
      status: 'active',
    },
  ];
}

export function createGameState(opts: NewGameOptions): GameState {
  const characterId = `char_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  const rng = new RNG(seedFromString(characterId));
  const bg = BACKGROUND_MAP[opts.background];

  const skills: Record<SkillKey, number> = Object.fromEntries(ALL_SKILLS.map((s) => [s, 0])) as Record<SkillKey, number>;
  for (const [k, v] of Object.entries(bg.skills)) {
    skills[k as SkillKey] = v ?? 0;
  }

  const needs: NeedsState = {
    energy: 88, hunger: 70, hygiene: 82, health: 90, mood: 76, social: 62,
    ...bg.needs,
  };

  const inventory: InventoryItem[] = bg.inventory.map((i) => ({ itemId: i.itemId, qty: i.qty, quality: 'ok' as const }));

  const npcs = createNPCs(rng);

  const relationships = Object.fromEntries(NAMED_NPCS.map((n) => [n.id, defaultRelationship(n.id, 1)]));

  if (opts.background === 'established') {
    relationships['mama_ada'] = { ...defaultRelationship('mama_ada', 1), stage: 'acquaintance', trust: 20, affection: 15, respect: 10 };
    relationships['manager_njoya'] = { ...defaultRelationship('manager_njoya', 1), stage: 'business_contact', trust: 18, respect: 20 };
  }
  if (opts.background === 'traders_child') {
    relationships['auntie_miranda'] = { ...defaultRelationship('auntie_miranda', 1), stage: 'acquaintance', trust: 25, affection: 30, respect: 10 };
    relationships['papa_ngassa'] = { ...defaultRelationship('papa_ngassa', 1), stage: 'acquaintance', trust: 10, respect: 15 };
  }
  if (opts.background === 'moto_driver') {
    relationships['brandon'] = { ...defaultRelationship('brandon', 1), stage: 'acquaintance', trust: 20, affection: 18 };
  }
  if (opts.background === 'student') {
    relationships['sandra'] = { ...defaultRelationship('sandra', 1), stage: 'acquaintance', trust: 15, affection: 12, compatibility: 20 };
  }

  const phone: PhoneState = {
    dataCreditMb: 250,
    airtimeFcfa: 1500,
    notifications: [
      { id: 'welcome', title: 'Welcome to Yaounde', body: 'Your journey begins. Check your goals in the Notes app.', day: 1, app: 'notes', read: false },
    ],
  };

  const messages: Message[] = [
    {
      id: 'msg_start_1',
      npcId: 'uncle_baba',
      day: 1,
      minute: 7 * 60 + 5,
      from: 'npc',
      text: opts.background === 'village_arrival'
        ? 'Welcome to the city! You can stay two weeks. After that, you must stand on your own two feet. The city rewards work.'
        : 'Good morning. The quarter is calm today. If you need advice about money, pass by the njangi hall.',
      read: false,
      kind: 'chat',
    },
    {
      id: 'msg_start_2',
      npcId: 'david_hustler',
      day: 1,
      minute: 7 * 60 + 12,
      from: 'npc',
      text: 'Bro, you just arrived? Check the Jobs app. There are small gigs around town. First money is the hardest.',
      read: false,
      kind: 'job',
    },
  ];

  const state: GameState = {
    version: 1,
    characterId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    world: createInitialWorldState(rng),
    player: {
      id: 'player',
      name: opts.name || 'Ngu',
      gender: opts.gender,
      background: opts.background,
      appearance: opts.appearance,
      needs,
      skills,
      traits: [...bg.traits],
      district: bg.district,
      job: null,
      jobHistory: [],
      education: { level: opts.background === 'student' ? 'Student' : opts.background === 'graduate' ? 'Bac+3' : 'GCE A-Level', enrolled: opts.background === 'student' ? 'University of Yaounde I' : null, examReady: false },
      hobbies: {},
      properties: [],
    },
    wallet: { cash: bg.cash, momo: bg.momo, bank: bg.bank, debt: bg.debt, debtTo: bg.debt > 0 ? (opts.background === 'entrepreneur' ? 'Brother' : 'Bike owner') : null },
    ledger: [],
    inventory,
    npcs,
    relationships,
    businesses: [],
    vehicles: [],
    njangi: { groups: createNjangiGroups(rng), membership: null },
    messages,
    pendingEvents: [],
    eventCooldowns: {},
    activeGoals: [
      { id: 'save_100k', status: 'active', progress: 0, target: 100000 },
      { id: 'first_job', status: 'active', progress: 0, target: 1 },
      { id: 'five_friends', status: 'active', progress: 0, target: 5 },
    ],
    achievements: [],
    reputation: { perDistrict: { [bg.district]: 1 }, circles: {} },
    milestones: [],
    stats: { gigsDone: 0, tradesDone: 0, totalEarned: 0, totalSpent: 0, daysPlayed: 1, photosTaken: 0, eventsAttended: 0, socialPosts: 0, njangiCyclesWon: 0, firstPayReceived: false, workStreak: 0, bestWorkStreak: 0 },
    learnedRoutes: [bg.district],
    settings: defaultSettings(opts.settings),
    phone,
    travelLog: [],
    storyFlags: { housing_stage: 1, tutorialStep: 0, rent: 15000, rentDueDay: 30, dayOfMonth: 1 },
    budget: { planned: {}, goals: [] },
    reports: [],
    city: createCityHallState(1),
    home: { items: [], comfort: 0, lastBonusDay: 0 },
    socialFeed: [
      { id: 'feed_1', authorId: 'david_hustler', authorName: 'David', text: 'Morning market run done. If you need a small delivery today, my line is open.', textFr: 'Tour du marché terminé. Si tu as besoin d’une petite livraison aujourd’hui, ma ligne est ouverte.', day: 1, minute: 7 * 60 + 20, likes: 7, likedByPlayer: false },
      { id: 'feed_2', authorId: 'sandra', authorName: 'Sandra', text: 'Anyone knows a quiet spot to study near Ngoa-Ekelle? The library is full again.', textFr: 'Quelqu’un connaît un coin calme pour étudier près de Ngoa-Ekelle ? La bibliothèque est encore pleine.', day: 1, minute: 7 * 60 + 34, likes: 4, likedByPlayer: false },
      { id: 'feed_3', authorId: 'brandon', authorName: 'Brandon', text: 'Roads are moving well this morning. Avoid the usual jam at the roundabout after 17h.', textFr: 'La circulation est fluide ce matin. Évite le bouchon habituel après 17h.', day: 1, minute: 7 * 60 + 45, likes: 9, likedByPlayer: false },
    ],
    log: [
      { day: 1, minute: 7 * 60, text: 'You wake up in Yaounde. The day is yours.' },
    ],
  };

  void ZONES;
  syncCityFlags(state);
  return state;
}

export function migrateState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState>;
  if (s.version !== 1 || !s.world || !s.player || !s.wallet) return null;
  const base = createGameState({
    name: s.player.name ?? 'Ngu',
    gender: s.player.gender ?? 'x',
    background: s.player.background ?? 'hustler',
    appearance: s.player.appearance ?? { skinTone: 3, hair: 'fade', bodyType: 'medium', shirtColor: '#e0532f', pantsColor: '#2c3e50' },
    settings: s.settings,
  });
  const merged: GameState = {
    ...base,
    ...s,
    version: 1,
    world: { ...base.world, ...s.world },
    player: { ...base.player, ...s.player, needs: { ...base.player.needs, ...s.player.needs }, skills: { ...base.player.skills, ...s.player.skills }, hobbies: { ...base.player.hobbies, ...(s.player.hobbies ?? {}) }, properties: s.player.properties ?? [], education: { ...base.player.education, ...(s.player.education ?? {}) } },
    wallet: { ...base.wallet, ...s.wallet },
    npcs: { ...base.npcs, ...(s.npcs ?? {}) },
    relationships: { ...base.relationships, ...(s.relationships ?? {}) },
    njangi: { groups: s.njangi?.groups ?? base.njangi.groups, membership: s.njangi?.membership ?? null },
    phone: { ...base.phone, ...(s.phone ?? {}) },
    settings: defaultSettings(s.settings),
    stats: { ...base.stats, ...(s.stats ?? {}) },
    ledger: s.ledger ?? [],
    inventory: s.inventory ?? [],
    messages: s.messages ?? [],
    pendingEvents: s.pendingEvents ?? [],
    eventCooldowns: s.eventCooldowns ?? {},
    activeGoals: s.activeGoals ?? base.activeGoals,
    achievements: s.achievements ?? [],
    reputation: s.reputation ?? base.reputation,
    milestones: s.milestones ?? [],
    learnedRoutes: s.learnedRoutes ?? base.learnedRoutes,
    businesses: (s.businesses ?? []).map((b) => ({
      ...b,
      stockQuality: b.stockQuality ?? 'ok',
      staffInfo: b.staffInfo ?? Object.fromEntries(b.staffIds.map((id) => [id, { morale: 70, skill: 2 }])),
      marketing: b.marketing ?? null,
      pendingDeliveries: b.pendingDeliveries ?? [],
      premises: b.premises ?? 0,
    })),
    vehicles: (s.vehicles ?? []).map((v) => {
      const def = VEHICLE_MAP[v.modelId];
      return {
        ...v,
        fuel: Math.max(0, Math.min(def?.tankLitres ?? 10, v.fuel ?? 0)),
        condition: Math.max(0, Math.min(100, v.condition ?? 100)),
        fleetRiderId: v.fleetRiderId ?? null,
        boughtDay: v.boughtDay ?? s.world?.day ?? 1,
        trips: v.trips ?? 0,
      };
    }),
    travelLog: s.travelLog ?? [],
    storyFlags: { ...base.storyFlags, ...(s.storyFlags ?? {}) },
    budget: { planned: s.budget?.planned ?? {}, goals: s.budget?.goals ?? [] },
    reports: s.reports ?? [],
    city: s.city ?? createCityHallState(s.world?.day ?? 1),
    home: s.home ?? { items: [], comfort: 0, lastBonusDay: 0 },
    socialFeed: s.socialFeed ?? [],
    log: s.log ?? [],
  };
  ensureCityHall(merged);
  syncCityFlags(merged);
  for (const n of NAMED_NPCS) {
    if (!merged.npcs[n.id]) {
      merged.npcs[n.id] = {
        id: n.id, name: n.name, role: n.role, homeDistrict: n.homeDistrict, district: n.homeDistrict,
        traits: n.traits, schedule: n.schedule, vendorKind: n.vendorKind,
      };
    }
  }
  for (const id of Object.keys(merged.npcs)) {
    if (!merged.relationships[id]) merged.relationships[id] = defaultRelationship(id, merged.world.day);
  }
  return merged;
}
