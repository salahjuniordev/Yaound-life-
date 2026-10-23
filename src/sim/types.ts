export type Language = 'en' | 'fr';
export type QualityTier = 'low' | 'mid' | 'high';
export type Camfranglais = 'off' | 'light' | 'heavy';

export type NeedKey = 'energy' | 'hunger' | 'hygiene' | 'health' | 'mood' | 'social';

export type SkillKey =
  | 'cooking'
  | 'driving'
  | 'sales'
  | 'negotiation'
  | 'management'
  | 'marketing'
  | 'tech'
  | 'creativity'
  | 'music'
  | 'fitness'
  | 'academics'
  | 'charisma';

export type DistrictId =
  | 'mvog_mbi'
  | 'mokolo'
  | 'nlongkak'
  | 'ngoa_ekelle'
  | 'bastos'
  | 'mvan'
  | 'mont_febe'
  | 'lac_municipal'
  | 'boulevard';

export type BackgroundId =
  | 'student'
  | 'hustler'
  | 'graduate'
  | 'entrepreneur'
  | 'established'
  | 'traders_child'
  | 'moto_driver'
  | 'village_arrival'
  | 'civil_servant'
  | 'freelancer'
  | 'employee';

export type TravelMode = 'walk' | 'taxi' | 'moto' | 'vehicle' | 'fast';

export type VehicleKind = 'moto' | 'car';

export interface VehicleState {
  id: string;
  modelId: string;
  fuel: number;
  condition: number;
  district: DistrictId;
  fleetRiderId: string | null;
  boughtDay: number;
  trips: number;
}

export interface NeedsState {
  energy: number;
  hunger: number;
  hygiene: number;
  health: number;
  mood: number;
  social: number;
}

export type HairStyle = 'fade' | 'braids' | 'natural' | 'bald' | 'locks' | 'wig' | 'twists';
export type HeadwearStyle = 'none' | 'headwrap';
export type BottomStyle = 'pants' | 'skirt';
export type BagStyle = 'none' | 'crossbody' | 'sling' | 'tote';
export type ClothPattern = 'none' | 'weave' | 'geo' | 'stripe';

export interface Appearance {
  skinTone: number;
  hair: HairStyle;
  bodyType: 'slim' | 'medium' | 'tall';
  faceShape?: 'oval' | 'round' | 'square';
  facialHair?: 'none' | 'stubble' | 'goatee' | 'beard';
  pattern?: ClothPattern;
  shirtColor: string;
  pantsColor: string;
  shoeColor?: string;
  overShirtColor?: string;
  headwear?: HeadwearStyle;
  headwearColor?: string;
  bottomStyle?: BottomStyle;
  bag?: BagStyle;
  bagColor?: string;
}

export interface WalletState {
  cash: number;
  momo: number;
  bank: number;
  debt: number;
  debtTo: string | null;
}

export interface LedgerEntry {
  id: string;
  day: number;
  minute: number;
  kind: 'income' | 'expense' | 'transfer' | 'fee';
  category: string;
  amount: number;
  counterparty: string;
  note: string;
  wallet: 'cash' | 'momo' | 'bank' | 'debt';
  balanceAfter: number;
}

export interface InventoryItem {
  itemId: string;
  qty: number;
  quality: 'low' | 'ok' | 'good';
}

export interface MemoryEntry {
  day: number;
  kind: 'promise_kept' | 'promise_broken' | 'helped' | 'hired' | 'fired' | 'gift' | 'attended' | 'refused' | 'met' | 'paid_debt';
  note: string;
}

export type RelationshipStage =
  | 'stranger'
  | 'acquaintance'
  | 'friend'
  | 'close_friend'
  | 'colleague'
  | 'business_contact'
  | 'rival'
  | 'dating'
  | 'partner';

export interface RelationshipState {
  npcId: string;
  stage: RelationshipStage;
  trust: number;
  affection: number;
  respect: number;
  compatibility: number;
  metDay: number;
  lastTalkDay: number;
  memory: MemoryEntry[];
}

export interface ScheduleSlot {
  from: number;
  to: number;
  place: string;
  activity: string;
}

export interface NPCState {
  id: string;
  name: string;
  role: string;
  homeDistrict: DistrictId;
  district: DistrictId;
  traits: string[];
  schedule: ScheduleSlot[];
  vendorKind?: string;
  jobId?: string;
  morale?: number;
  skill?: number;
  reliability?: number;
}

export interface ActiveJob {
  jobId: string;
  hiredDay: number;
  performance: number;
  reliability: number;
  shiftsWorked: number;
  shiftsMissed: number;
  shiftsThisWeek: number;
  lastShiftDay: number;
}

export interface BusinessState {
  id: string;
  kind: string;
  name: string;
  district: DistrictId;
  rentPerDay: number;
  priceLevel: number;
  stock: Record<string, number>;
  stockQuality: 'low' | 'ok' | 'good';
  quality: number;
  reputation: number;
  customerSatisfaction: number;
  hasGenerator: boolean;
  revenueToday: number;
  costsToday: number;
  arrears: number;
  openToday: boolean;
  staffIds: string[];
  staffInfo: Record<string, { morale: number; skill: number }>;
  marketing: { type: string; startDay: number; untilDay: number; boost: number } | null;
  pendingDeliveries: { itemId: string; qty: number; quality: 'low' | 'ok' | 'good'; arrivesDay: number }[];
  premises: number;
  dayOpened: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  createdAtDay: number;
  done: boolean;
}

export interface ContentReport {
  id: string;
  kind: 'event' | 'glossary' | 'item' | 'place' | 'npc' | 'other';
  refId: string;
  note: string;
  day: number;
  minute: number;
}

export interface NjangiMembership {
  groupId: string;
  contribution: number;
  cadenceDays: number;
  turnOrder: number;
  nextSittingDay: number;
  cyclesPaid: number;
  cyclesReceived: number;
  missed: number;
  status: 'active' | 'completed' | 'left';
}

export interface NjangiGroup {
  id: string;
  name: string;
  organizerId: string;
  members: string[];
  contribution: number;
  reliabilityOf: Record<string, number>;
  potHistory: { cycle: number; recipient: string; day: number; amount: number }[];
  sketchy: boolean;
  joinFee: number;
  maxMembers: number;
  status?: 'active' | 'fraud' | 'completed';
}

export interface Message {
  id: string;
  npcId: string;
  day: number;
  minute: number;
  from: 'npc' | 'player';
  text: string;
  read: boolean;
  kind: 'chat' | 'job' | 'invite' | 'order' | 'news' | 'system';
  replies?: { id: string; label: string; effects?: string }[];
}

export interface EventChoice {
  id: string;
  label: string;
  labelFr?: string;
}

export interface PendingEvent {
  templateId: string;
  title: string;
  titleFr?: string;
  body: string;
  bodyFr?: string;
  choices: EventChoice[];
  npcId?: string;
  kind: string;
}

export interface GoalState {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  progress: number;
  target: number;
  completedDay?: number;
}

export interface ReputationState {
  perDistrict: Partial<Record<DistrictId, number>>;
  circles: Record<string, number>;
}

export interface GameSettings {
  language: Language;
  quality: QualityTier;
  qualityAuto: boolean;
  relaxedNeeds: boolean;
  camfranglais: Camfranglais;
  sound: boolean;
  notifications: boolean;
  dataSaver: boolean;
  reduceMotion: boolean;
  textSize: 'normal' | 'large';
}

export interface PhoneState {
  dataCreditMb: number;
  airtimeFcfa: number;
  notifications: { id: string; title: string; body: string; day: number; app: string; read: boolean }[];
}

export interface WorldStateData {
  day: number;
  minute: number;
  dayOfWeek: number;
  weather: 'sun' | 'cloud' | 'rain';
  fuelPrice: number;
  outages: Partial<Record<DistrictId, { start: number; end: number }>>;
  strike: boolean;
  matchDay: boolean;
  marketDay: boolean;
  headlines: string[];
}

export interface PlayerState {
  id: string;
  name: string;
  gender: 'm' | 'f' | 'x';
  background: BackgroundId;
  appearance: Appearance;
  needs: NeedsState;
  skills: Record<SkillKey, number>;
  traits: string[];
  district: DistrictId;
  job: ActiveJob | null;
  jobHistory: string[];
  education: { level: string; enrolled: string | null; examReady: boolean };
  hobbies: Record<string, number>;
  properties: string[];
  hygieneDays?: number;
}

export interface GameState {
  version: number;
  characterId: string;
  createdAt: number;
  updatedAt: number;
  world: WorldStateData;
  player: PlayerState;
  wallet: WalletState;
  ledger: LedgerEntry[];
  inventory: InventoryItem[];
  npcs: Record<string, NPCState>;
  relationships: Record<string, RelationshipState>;
  businesses: BusinessState[];
  vehicles: VehicleState[];
  njangi: { groups: NjangiGroup[]; membership: NjangiMembership | null };
  messages: Message[];
  pendingEvents: PendingEvent[];
  eventCooldowns: Record<string, number>;
  activeGoals: GoalState[];
  achievements: string[];
  reputation: ReputationState;
  milestones: string[];
  stats: { gigsDone: number; tradesDone: number; totalEarned: number; totalSpent: number; daysPlayed: number; photosTaken: number; eventsAttended: number; socialPosts: number; njangiCyclesWon: number; firstPayReceived: boolean; workStreak: number; bestWorkStreak: number };
  learnedRoutes: DistrictId[];
  settings: GameSettings;
  phone: PhoneState;
  travelLog: { day: number; mode: TravelMode; from: DistrictId; to: DistrictId; cost: number }[];
  storyFlags: Record<string, boolean | number | string>;
  log: { day: number; minute: number; text: string }[];
  budget: { planned: Record<string, number>; goals: SavingsGoal[] };
  reports: ContentReport[];
}

export interface ActivityDef {
  id: string;
  name: string;
  nameFr?: string;
  icon: string;
  category: 'food' | 'health' | 'social' | 'work' | 'study' | 'home' | 'fun' | 'transport' | 'career' | 'business';
  minutes: number;
  cost?: number;
  currency?: 'cash' | 'momo';
  income?: number;
  requires?: {
    energy?: number;
    hunger?: number;
    district?: DistrictId[];
    itemId?: string;
    skill?: { key: SkillKey; level: number };
    job?: boolean;
    bike?: boolean;
  };
  effects?: Partial<NeedsState> & { money?: number };
  skill?: { key: SkillKey; gain: number };
  outcomes?: { chance: number; text: string; textFr?: string; needs?: Partial<NeedsState>; money?: number; reputation?: number }[];
  story?: string;
  repeatable: boolean;
  cooldownDays?: number;
  locationKind: 'interior' | 'street' | 'stall' | 'phone' | 'any';
}

export interface JobDef {
  id: string;
  title: string;
  titleFr?: string;
  employer: string;
  district: DistrictId;
  pay: number;
  payCadence: 'shift' | 'day' | 'week' | 'month';
  shiftStart: number;
  shiftEnd: number;
  days: number[];
  requirements: { skill?: { key: SkillKey; level: number }; education?: string; trait?: string };
  skillGain?: { key: SkillKey; gain: number };
  description: string;
  descriptionFr?: string;
  mapTo?: 'shift_work' | 'moto_runs' | 'trade_stall';
  category: string;
}

export interface ItemDef {
  id: string;
  name: string;
  nameFr?: string;
  category: 'food' | 'drink' | 'goods' | 'clothing' | 'household' | 'phone' | 'ingredient';
  basePrice: number;
  wholesalePrice: number;
  effects?: Partial<NeedsState>;
  perishableDays?: number;
  tradeable: boolean;
  description: string;
  descriptionFr?: string;
}

export interface EventTemplate {
  id: string;
  kind: 'opportunity' | 'expense' | 'social' | 'market' | 'weather' | 'work' | 'city' | 'health' | 'story';
  title: string;
  titleFr?: string;
  body: string;
  bodyFr?: string;
  weight: number;
  conditions?: {
    district?: DistrictId[];
    minDay?: number;
    weather?: 'sun' | 'cloud' | 'rain';
    minCash?: number;
    maxCash?: number;
    hasJob?: boolean;
    timeFrom?: number;
    timeTo?: number;
    flag?: string;
    once?: boolean;
  };
  choices: EventChoice[];
  outcomes: Record<string, {
    text: string;
    textFr?: string;
    needs?: Partial<NeedsState>;
    money?: number;
    reputation?: number;
    skill?: { key: SkillKey; gain: number };
    followup?: string;
    npcTrust?: number;
    storyFlag?: string;
  }>;
  wetWeatherAlternative?: string;
  contentLabel: 'design_interpretation' | 'requires_local_validation' | 'verified';
  realEvent?: { name: string; source: string; recheck: string };
}

export interface GoalDef {
  id: string;
  tier: 'personal' | 'career' | 'life';
  name: string;
  nameFr?: string;
  description: string;
  descriptionFr?: string;
  target: number;
  check: (s: GameState) => number;
}

export interface NamedNPCSeed {
  id: string;
  name: string;
  role: string;
  roleFr?: string;
  homeDistrict: DistrictId;
  traits: string[];
  schedule: ScheduleSlot[];
  vendorKind?: string;
  jobId?: string;
  dialogue: { greeting: string[]; friendly: string[]; busy: string[] };
  dialogueFr?: { greeting: string[]; friendly: string[]; busy: string[] };
}
