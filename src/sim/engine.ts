import type {
  CityPolicyId,
  DistrictId,
  GameSettings,
  GameState,
  PendingEvent,
  SkillKey,
  TravelMode,
  VehicleKind,
  VehicleState,
} from './types';
import { RNG, seedFromString } from './rng';
import { ACTIVITY_MAP } from '../data/activities';
import { ITEM_MAP, ITEMS } from '../data/items';
import { EVENT_TEMPLATES, EVENT_MAP } from '../data/events';
import { JOB_MAP, JOBS } from '../data/jobs';
import { BUSINESS_MAP, MARKETING_CAMPAIGNS, STAFF_DAILY_WAGE, STAFF_TRAINING_COST, SUPPLIER_MAP } from '../data/businesses';
import { EXAM_MAP, educationAtLeast } from '../data/education';
import { holidayForDay } from '../data/calendar';
import { PREMISES_LEVELS, PROPERTY_MAP, RENTAL_PROPERTIES, premisesLevelDef } from '../data/properties';
import { HOBBY_DEFS, HOBBY_MAP, hobbyLevelFor, hobbyXpForActivity } from '../data/hobbies';
import { STORY_CHAINS } from '../data/storyChains';
import { FLEET_RIDER_MAP, VEHICLE_MAP, fleetEstimate, vehicleRepairCost, vehicleResaleValue, type VehicleDef } from '../data/vehicles';
import { GOAL_MAP, ACHIEVEMENTS } from '../data/goals';
import { DISTRICT_MAP, ZONES } from '../data/districts';
import { applyNeedEffects, clamp, decayNeeds, qualityModifier } from './needs';
import { addIncome, districtPrice, momoFee, spendMoney, totalMoney } from './economy';
import { applyRelationDelta, dailyRelationshipDrift, npcRelationshipScore } from './relationships';
import { BUDGET_CATEGORIES, budgetCategoryLabel, weeklyBudgetView, type BudgetCategoryId } from './budget';
import { generateCityNews } from './npcsim';
import { FURNITURE_MAP } from '../data/furniture';
import { FEED_TEMPLATES } from '../data/socialFeed';
import { CITY_CAMPAIGN_UNIT, CITY_PLAYER_VOTE_WEIGHT, CITY_POLICY_MAP, CITY_RUN_FEE } from '../data/cityHall';
import {
  castPlayerVote,
  cityFunMoodBonus,
  cityPolicyMultiplier,
  declareCandidacy,
  ensureCityHall,
  isVotingOpen,
  processCityHallDay,
  runCityCampaign,
  syncCityFlags,
} from './city';

export interface ActionResult {
  ok: boolean;
  message?: string;
  messageFr?: string;
  toast?: 'info' | 'success' | 'error' | 'money';
}

export interface Toast {
  id: number;
  text: string;
  textFr?: string;
  kind: 'info' | 'success' | 'error' | 'money';
}

export interface TravelQuote {
  mode: TravelMode;
  minutes: number;
  cost: number;
  risk: number;
  available: boolean;
  unavailableReason?: string;
  vehicleId?: string;
  vehicleLabel?: string;
  vehicleKind?: VehicleKind;
  fuelLitres?: number;
  fuelCost?: number;
}

export interface TravelPlan {
  from: DistrictId;
  to: DistrictId;
  toName: string;
  toNameFr: string;
  distance: number;
  options: TravelQuote[];
}

export interface VendorStockItem {
  itemId: string;
  price: number;
  wholesale: boolean;
}

export interface QualificationReport {
  qualifies: boolean;
  reasons: string[];
  reasonsFr: string[];
  missing: string[];
  missingFr: string[];
  payLabel: string;
}

export type GameAction =
  | { type: 'activity'; activityId: string; npcId?: string; businessId?: string }
  | { type: 'travel'; to: DistrictId; mode: TravelMode; vehicleId?: string }
  | { type: 'walk_enter'; to: DistrictId }
  | { type: 'talk'; npcId: string; kind: 'greet' | 'chat' | 'gift' | 'help' | 'invite' | 'apologize' }
  | { type: 'buy'; itemId: string; qty: number; vendor: string }
  | { type: 'sell'; itemId: string; qty: number; vendor?: string }
  | { type: 'withdraw_momo'; amount: number }
  | { type: 'deposit_momo'; amount: number }
  | { type: 'transfer_momo'; npcId: string; amount: number }
  | { type: 'bank_deposit'; amount: number }
  | { type: 'bank_withdraw'; amount: number }
  | { type: 'loan_take'; amount: number }
  | { type: 'loan_repay'; amount: number }
  | { type: 'buy_airtime'; amount: number }
  | { type: 'buy_data'; amount: number }
  | { type: 'apply_job'; jobId: string }
  | { type: 'work_shift'; jobId: string; minutes?: number }
  | { type: 'resign_job' }
  | { type: 'moto_run'; trips: number }
  | { type: 'delivery_trip'; drops: number }
  | { type: 'business_open'; kind: string; name: string }
  | { type: 'business_buy_stock'; businessId: string; itemId: string; qty: number; supplier?: string }
  | { type: 'business_set_price'; businessId: string; priceLevel: number }
  | { type: 'business_hire'; businessId: string; npcId: string }
  | { type: 'business_fire'; businessId: string; npcId: string }
  | { type: 'business_toggle'; businessId: string; open: boolean }
  | { type: 'business_generator'; businessId: string }
  | { type: 'business_staff_bonus'; businessId: string; npcId: string; amount: number }
  | { type: 'business_train_staff'; businessId: string; npcId: string }
  | { type: 'business_marketing'; businessId: string; campaign: string }
  | { type: 'report_content'; kind: 'event' | 'glossary' | 'item' | 'place' | 'npc' | 'other'; refId: string; note: string }
  | { type: 'budget_set_plan'; category: string; amount: number }
  | { type: 'savings_goal_add'; name: string; target: number }
  | { type: 'savings_goal_deposit'; goalId: string; amount: number }
  | { type: 'savings_goal_withdraw'; goalId: string; amount: number }
  | { type: 'savings_goal_delete'; goalId: string }
  | { type: 'exam_register'; trackId: string }
  | { type: 'exam_take' }
  | { type: 'hobby_buy_gear'; hobbyId: string }
  | { type: 'hobby_compete'; hobbyId: string }
  | { type: 'property_buy'; propertyId: string }
  | { type: 'vehicle_buy'; modelId: string }
  | { type: 'vehicle_sell'; vehicleId: string }
  | { type: 'vehicle_refuel'; vehicleId: string }
  | { type: 'vehicle_repair'; vehicleId: string }
  | { type: 'vehicle_assign_rider'; vehicleId: string; riderId: string | null }
  | { type: 'business_premises_upgrade'; businessId: string }
  | { type: 'njangi_join'; groupId: string; turn: 'early' | 'middle' | 'late' }
  | { type: 'njangi_contribute' }
  | { type: 'njangi_miss'; resolve: 'cover' | 'default' }
  | { type: 'njangi_leave' }
  | { type: 'event_choice'; eventIndex: number; choiceId: string }
  | { type: 'dismiss_event'; eventIndex: number }
  | { type: 'message_send'; npcId: string; text: string; replyId?: string }
  | { type: 'message_read'; messageId: string }
  | { type: 'social_post'; text: string }
  | { type: 'photo_taken'; landmarkId?: string }
  | { type: 'goal_activate'; goalId: string }
  | { type: 'goal_abandon'; goalId: string }
  | { type: 'housing_upgrade'; stage: number }
  | { type: 'pay_arrears' }
  | { type: 'set_setting'; key: keyof GameSettings; value: GameSettings[keyof GameSettings] }
  | { type: 'tutorial'; tag: string }
  | { type: 'notification_read'; id: string }
  | { type: 'city_vote'; candidateId: string }
  | { type: 'city_run'; policy: CityPolicyId }
  | { type: 'city_campaign'; amount: number }
  | { type: 'home_buy'; itemId: string }
  | { type: 'home_sell'; itemId: string }
  | { type: 'social_like'; postId: string };

let toastId = 0;

export const WALK_SPEED = 13;
export const TAXI_SPEED = 32;
export const MOTO_SPEED = 48;

export function zoneDistance(a: DistrictId, b: DistrictId): number {
  const za = DISTRICT_MAP[a];
  const zb = DISTRICT_MAP[b];
  if (!za || !zb) return 200;
  const dx = za.center[0] - zb.center[0];
  const dz = za.center[1] - zb.center[1];
  return Math.sqrt(dx * dx + dz * dz);
}

export function getTravelPlan(state: GameState, from: DistrictId, to: DistrictId): TravelPlan {
  const zone = DISTRICT_MAP[to];
  const distance = zoneDistance(from, to);
  if (from === to) {
    return { from, to, toName: zone?.name ?? to, toNameFr: zone?.nameFr ?? to, distance, options: [] };
  }
  const rainFactor = state.world.weather === 'rain' ? 1.3 : 1;
  const isNight = state.world.minute >= 19 * 60 || state.world.minute < 5 * 60;
  const strike = state.world.strike;

  const walkMin = Math.max(8, Math.round((distance / WALK_SPEED) * rainFactor));
  const taxiMin = Math.max(5, Math.round((distance / TAXI_SPEED) * rainFactor) + 4);
  const motoMin = Math.max(4, Math.round((distance / MOTO_SPEED) * rainFactor) + 2);

  const transportFactor = cityPolicyMultiplier(state, 'transport_subsidy');
  const taxiCost = Math.round(((isNight ? 350 : 300) + distance * 0.4) * transportFactor);
  const motoCost = Math.round((300 + distance * 1.1 + (isNight ? 150 : 0)) * transportFactor);

  const options: TravelQuote[] = [
    { mode: 'walk', minutes: walkMin, cost: 0, risk: 0, available: true },
    {
      mode: 'taxi',
      minutes: taxiMin,
      cost: taxiCost,
      risk: 0.002,
      available: !strike,
      unavailableReason: strike ? 'Taxi strike today — taxis are parked.' : undefined,
    },
    {
      mode: 'moto',
      minutes: motoMin,
      cost: motoCost,
      risk: 0.045,
      available: true,
    },
  ];

  if (state.vehicles.length > 0) {
    const owned = state.vehicles.map((vehicle) => ({ vehicle, def: VEHICLE_MAP[vehicle.modelId] })).filter((entry) => entry.def);
    const ready = owned.filter(({ vehicle, def }) => {
      const litres = Math.round(distance * def.fuelPerDistance * 10) / 10;
      return !vehicle.fleetRiderId && vehicle.condition >= 15 && vehicle.fuel >= litres;
    });
    ready.sort((a, b) => b.def.speed - a.def.speed);
    const chosen = ready[0];
    if (chosen) {
      const { vehicle, def } = chosen;
      const litres = Math.round(distance * def.fuelPerDistance * 10) / 10;
      const conditionFactor = 1 + (100 - vehicle.condition) / 150;
      options.push({
        mode: 'vehicle',
        minutes: Math.max(3, Math.round((distance / def.speed) * rainFactor) + 2),
        cost: 0,
        risk: def.baseRisk * conditionFactor * (state.world.weather === 'rain' ? 1.2 : 1),
        available: true,
        vehicleId: vehicle.id,
        vehicleLabel: def.name,
        vehicleKind: def.kind,
        fuelLitres: litres,
        fuelCost: Math.round(litres * state.world.fuelPrice),
      });
    } else {
      const assigned = owned.find((entry) => entry.vehicle.fleetRiderId);
      const lowCondition = owned.find((entry) => entry.vehicle.condition < 15);
      const dry = owned.find((entry) => entry.vehicle.fuel < Math.round(distance * entry.def.fuelPerDistance * 10) / 10);
      options.push({
        mode: 'vehicle',
        minutes: 0,
        cost: 0,
        risk: 0,
        available: false,
        unavailableReason: assigned && owned.every((entry) => entry.vehicle.fleetRiderId)
          ? 'All your vehicles are with fleet riders today.'
          : lowCondition
            ? 'Your vehicle needs repairs before a long trip.'
            : dry
              ? 'Not enough fuel in the tank. Fill up in the Garage app.'
              : 'No vehicle is ready for this trip.',
      });
    }
  }

  if (state.learnedRoutes.includes(to)) {
    options.push({ mode: 'fast', minutes: 5, cost: 0, risk: 0, available: true });
  }
  return { from, to, toName: zone?.name ?? to, toNameFr: zone?.nameFr ?? to, distance, options };
}

function doTravelOptionFor(options: TravelQuote[], mode: TravelMode, vehicleId?: string): TravelQuote | undefined {
  if (mode !== 'vehicle') return options.find((o) => o.mode === mode);
  return options.find((o) => o.mode === 'vehicle' && (!vehicleId || o.vehicleId === vehicleId));
}

const VENDOR_STOCK: Record<string, { itemId: string; wholesale?: boolean }[]> = {
  street_food: [{ itemId: 'beignets_haricots' }, { itemId: 'water_sachet' }],
  soya: [{ itemId: 'soya' }, { itemId: 'water_sachet' }, { itemId: 'palm_wine' }],
  koki: [{ itemId: 'koki' }, { itemId: 'jus_local' }],
  poisson: [{ itemId: 'poisson_braise' }, { itemId: 'plantain_grille' }],
  restaurant: [{ itemId: 'ndole' }, { itemId: 'jus_local' }, { itemId: 'beer33' }],
  canteen: [{ itemId: 'beignets_haricots' }, { itemId: 'koki' }, { itemId: 'jus_local' }],
  market_food: [{ itemId: 'tomatoes_kg' }, { itemId: 'plantain_bunch' }, { itemId: 'spices_pack' }, { itemId: 'beans_kg' }, { itemId: 'fish_kg' }],
  wholesale: [
    { itemId: 'rice_kg', wholesale: true },
    { itemId: 'beans_kg', wholesale: true },
    { itemId: 'palm_oil_l', wholesale: true },
    { itemId: 'fish_kg', wholesale: true },
    { itemId: 'plantain_bunch', wholesale: true },
    { itemId: 'tomatoes_kg', wholesale: true },
    { itemId: 'umbrella', wholesale: true },
    { itemId: 'plastic_stool', wholesale: true },
    { itemId: 'generator_fuel', wholesale: true },
  ],
  goods: [{ itemId: 'umbrella' }, { itemId: 'plastic_stool' }, { itemId: 'tshirt' }, { itemId: 'pagne' }, { itemId: 'sneakers' }, { itemId: 'ice_block' }, { itemId: 'candle' }, { itemId: 'mattress' }, { itemId: 'powerbank' }, { itemId: 'phone_charger' }, { itemId: 'refurb_phone' }],
  general_shop: [{ itemId: 'rice_kg' }, { itemId: 'beans_kg' }, { itemId: 'candle' }, { itemId: 'ice_block' }, { itemId: 'phone_charger' }, { itemId: 'soda' }, { itemId: 'water_sachet' }, { itemId: 'umbrella' }],
  bar: [{ itemId: 'beer33' }, { itemId: 'palm_wine' }, { itemId: 'soda' }, { itemId: 'soya' }],
  clinic: [{ itemId: 'water_sachet' }],
  pharmacy: [{ itemId: 'water_sachet' }, { itemId: 'spices_pack' }],
  momo: [],
  moto: [],
  cyber: [],
  bank: [],
  njangi: [],
};

export function getVendorStock(state: GameState, vendorKind: string, district: DistrictId): VendorStockItem[] {
  const stock = VENDOR_STOCK[vendorKind] ?? [];
  const negot = state.player.skills.negotiation;
  return stock.map((entry) => {
    const def = ITEM_MAP[entry.itemId];
    const base = entry.wholesale ? def.wholesalePrice : def.basePrice;
    const districtBase = districtPrice(state, district, base);
    const discount = 1 - Math.min(0.1, negot * 0.012);
    const foodFactor = def.category === 'food' || def.category === 'drink' ? cityPolicyMultiplier(state, 'food_discount') : 1;
    return { itemId: entry.itemId, price: Math.round(districtBase * discount * foodFactor), wholesale: Boolean(entry.wholesale) };
  });
}

export function sellPriceFor(state: GameState, itemId: string, district: DistrictId): number {
  const def = ITEM_MAP[itemId];
  if (!def) return 0;
  const skillFactor = 0.7 + Math.min(0.4, state.player.skills.sales * 0.03 + state.player.skills.negotiation * 0.02);
  return Math.round(districtPrice(state, district, def.basePrice) * skillFactor);
}

export function qualificationReport(state: GameState, jobId: string): QualificationReport {
  const job = JOB_MAP[jobId];
  const reasons: string[] = [];
  const reasonsFr: string[] = [];
  const missing: string[] = [];
  const missingFr: string[] = [];
  if (!job) return { qualifies: false, reasons, reasonsFr, missing: ['Job not found'], missingFr: ['Emploi introuvable'], payLabel: '' };
  if (job.requirements.skill) {
    const { key, level } = job.requirements.skill;
    const have = Math.floor(state.player.skills[key] ?? 0);
    if (have >= level) {
      reasons.push(`Your ${key} skill is ${have} (needs ${level}).`);
      reasonsFr.push(`Ta compétence ${key} est ${have} (requis ${level}).`);
    } else {
      missing.push(`${key} skill ${have}/${level} — practice ${key} activities to improve.`);
      missingFr.push(`Compétence ${key} ${have}/${level} — pratique pour progresser.`);
    }
  } else {
    reasons.push('No specific skill required.');
    reasonsFr.push('Aucune compétence particulière requise.');
  }
  if (job.requirements.education) {
    const req = job.requirements.education;
    if (educationAtLeast(state.player.education.level, req)) {
      reasons.push(`Education: ${state.player.education.level} (needs ${req}).`);
      reasonsFr.push(`Éducation : ${state.player.education.level} (requis ${req}).`);
    } else {
      missing.push(`Education ${req} required — your level: ${state.player.education.level}. Register for the exam first.`);
      missingFr.push(`Niveau ${req} requis — ton niveau : ${state.player.education.level}. Inscris-toi à l'examen d'abord.`);
    }
  }
  const charisma = Math.floor(state.player.skills.charisma ?? 0);
  if (charisma >= 3) {
    reasons.push(`Charisma ${charisma} helps at the interview.`);
    reasonsFr.push(`Charisme ${charisma} aide à l'entretien.`);
  }
  if (state.storyFlags[`referral_${jobId}`]) {
    reasons.push('You have a referral from a contact.');
    reasonsFr.push('Tu as une recommandation d\'un contact.');
  }
  const payLabel = `${job.pay.toLocaleString()} FCFA / ${job.payCadence}`;
  return { qualifies: missing.length === 0, reasons, reasonsFr, missing, missingFr, payLabel };
}

export class GameEngine {
  state: GameState;
  paused = false;
  suppressRandomEvents = false;
  private listeners = new Set<() => void>();
  private toasts: Toast[] = [];
  private rng: RNG;
  private minutesSinceEventRoll = 0;

  constructor(state: GameState) {
    this.state = state;
    this.rng = new RNG(seedFromString(state.characterId + '_engine'));
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  notify() {
    for (const fn of this.listeners) fn();
  }

  toast(text: string, kind: Toast['kind'] = 'info', textFr?: string) {
    this.toasts.push({ id: ++toastId, text, kind, textFr });
    if (this.toasts.length > 4) this.toasts.shift();
    this.notify();
  }

  drainToasts(): Toast[] {
    const t = this.toasts;
    this.toasts = [];
    return t;
  }

  tick(realDtSec: number) {
    if (this.paused) return;
    const dt = Math.min(realDtSec, 1.5);
    const gameMinutes = dt * 2;
    this.advanceMinutes(gameMinutes, { decay: true, rollEvents: true });
  }

  advanceMinutes(mins: number, opts: { decay?: boolean; rollEvents?: boolean } = {}) {
    let remaining = mins;
    let guard = 0;
    while (remaining > 0.01 && guard < 80) {
      guard++;
      const step = Math.min(remaining, 1440 - this.state.world.minute);
      this.state.world.minute += step;
      remaining -= step;
      if (opts.decay !== false) decayNeeds(this.state, step);
      this.consumePhoneCredit(step);
      if (this.state.world.minute >= 1440) {
        this.state.world.minute = this.state.world.minute - 1440;
        this.state.world.day += 1;
        this.state.world.dayOfWeek = this.state.world.day % 7;
        this.statsDaysPlayedGuard();
        this.onNewDay();
      }
    }
    if (opts.rollEvents) {
      this.minutesSinceEventRoll += mins;
      if (this.minutesSinceEventRoll >= 55) {
        this.minutesSinceEventRoll = 0;
        this.maybeRollRandomEvent();
      }
    }
    this.state.updatedAt = Date.now();
    this.notify();
  }

  private statsDaysPlayedGuard() {}

  private consumePhoneCredit(minutes: number) {
    const p = this.state.phone;
    if (p.dataCreditMb > 0 && this.rng.chance(0.25)) {
      p.dataCreditMb = Math.max(0, p.dataCreditMb - Math.round(minutes * 0.1));
      if (p.dataCreditMb === 0) {
        this.notifyApp('settings', 'Data finished', 'No data credit left. Buy a bundle in the Wallet app.');
      }
    }
  }

  pushLog(text: string) {
    this.state.log.unshift({ day: this.state.world.day, minute: Math.floor(this.state.world.minute), text });
    if (this.state.log.length > 60) this.state.log.length = 60;
  }

  notifyApp(app: string, title: string, body: string) {
    if (!this.state.settings.notifications) return;
    this.state.phone.notifications.unshift({
      id: `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 9999)}`,
      title, body, day: this.state.world.day, app, read: false,
    });
    if (this.state.phone.notifications.length > 40) this.state.phone.notifications.length = 40;
  }

  addMessage(npcId: string, text: string, kind: 'chat' | 'job' | 'invite' | 'order' | 'news' | 'system' = 'chat', replies?: { id: string; label: string; effects?: string }[]) {
    this.state.messages.unshift({
      id: `m_${Date.now().toString(36)}_${Math.floor(Math.random() * 9999)}`,
      npcId, day: this.state.world.day, minute: Math.floor(this.state.world.minute),
      from: 'npc', text, read: false, kind, replies,
    });
    if (this.state.messages.length > 120) this.state.messages.length = 120;
    this.notifyApp('messages', this.state.npcs[npcId]?.name ?? 'Message', text.slice(0, 90));
  }

  spend(wallet: 'cash' | 'momo' | 'bank', amount: number, category: string, counterparty: string, note: string): boolean {
    const res = spendMoney(this.state, wallet, amount, category, counterparty, note);
    if (res.ok) this.refreshGoals();
    return res.ok;
  }

  giveIncome(wallet: 'cash' | 'momo' | 'bank', amount: number, category: string, counterparty: string, note: string) {
    addIncome(this.state, wallet, amount, category, counterparty, note);
    this.advanceTutorial('earned');
    this.refreshGoals();
    if (!this.state.stats.firstPayReceived && category === 'wage') {
      this.state.stats.firstPayReceived = true;
      this.unlockAchievement('first_pay');
      this.milestone('First salary received!');
    }
    if (!this.state.storyFlags['ever_earned'] && amount > 0) {
      this.state.storyFlags['ever_earned'] = true;
      this.unlockAchievement('first_franc');
    }
  }

  milestone(text: string) {
    this.state.milestones.unshift(text);
    if (this.state.milestones.length > 20) this.state.milestones.length = 20;
    this.toast(`Milestone: ${text}`, 'success');
  }

  unlockAchievement(id: string) {
    if (this.state.achievements.includes(id)) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    this.state.achievements.push(id);
    this.toast(`Achievement: ${def.name}`, 'success');
  }

  advanceTutorial(tag: string) {
    const step = Number(this.state.storyFlags['tutorialStep'] ?? 0);
    const expected: (string | null)[] = [null, 'phone_opened', 'ate', 'traveled', 'earned', 'talked', null];
    const stepTag = expected[step];
    if (stepTag && tag === stepTag) {
      this.state.storyFlags['tutorialStep'] = step + 1;
      if (step + 1 >= expected.length - 1) {
        this.milestone('First Days in Yaounde: complete');
        this.notifyApp('notes', 'First Days complete', 'You have found your feet in the city. New goals await on the board.');
      } else {
        this.toast('New objective in your goals', 'info');
      }
      this.refreshGoals();
    }
  }

  refreshGoals() {
    for (const goal of this.state.activeGoals) {
      if (goal.status !== 'active') continue;
      const def = GOAL_MAP[goal.id];
      if (!def) continue;
      goal.progress = def.check(this.state);
      if (goal.progress >= goal.target) {
        goal.status = 'completed';
        goal.completedDay = this.state.world.day;
        this.toast(`Goal complete: ${def.name}`, 'success');
      }
    }
    this.checkAchievements();
    this.checkJobUnlocks();
  }

  private checkJobUnlocks() {
    const s = this.state;
    for (const job of JOBS) {
      const req = job.requirements;
      const gated = (req.skill && req.skill.level >= 2) || Boolean(req.education);
      if (!gated) continue;
      const key = `jobunlock_${job.id}`;
      if (s.storyFlags[key]) continue;
      if (s.player.job?.jobId === job.id || s.player.jobHistory.includes(job.id)) {
        s.storyFlags[key] = 1;
        continue;
      }
      const report = qualificationReport(s, job.id);
      if (!report.qualifies) continue;
      s.storyFlags[key] = 1;
      this.notifyApp('jobs', `New job unlocked: ${job.title}`, `${job.employer} (${job.district}) now hires at your level. ${job.pay.toLocaleString()} FCFA/${job.payCadence}.`);
      this.toast(`Job unlocked: ${job.title}`, 'success');
    }
  }

  checkAchievements() {
    const s = this.state;
    if (s.stats.tradesDone >= 10) this.unlockAchievement('market_king');
    if (totalMoney(s.wallet) >= 100000) this.unlockAchievement('first_100k');
    if (s.world.weather === 'rain' && s.storyFlags['worked_in_rain']) this.unlockAchievement('rain_dancer');
    if (Number(s.storyFlags['generous_given'] ?? 0) >= 20000) this.unlockAchievement('generous_heart');
    if (s.stats.photosTaken >= 3) this.unlockAchievement('photo_hunter');
    if (s.njangi.membership && s.njangi.membership.cyclesPaid >= 4 && s.njangi.membership.missed === 0) this.unlockAchievement('njangi_reliable');
    if (Number(s.storyFlags['shortcuts_today'] ?? 0) >= 3) this.unlockAchievement('cutting_corner');
    const h = s.world.minute / 60;
    if (h >= 2 && h <= 4 && s.player.needs.energy > 30 && s.stats.daysPlayed > 1) this.unlockAchievement('night_owl');
    const streak = s.stats.workStreak ?? 0;
    if (streak >= 7) this.unlockAchievement('sleepless_hustler');
    if (streak >= 30) this.unlockAchievement('marathon_hustler');
    if ((s.player.properties?.length ?? 0) >= 1) this.unlockAchievement('landlord');
    if (s.vehicles.length >= 1) this.unlockAchievement('first_wheels');
    if (s.vehicles.filter((v) => v.fleetRiderId).length >= 3) this.unlockAchievement('fleet_owner');
    if (s.businesses.length >= 3) this.unlockAchievement('tycoon');
    if (s.player.education.level === 'Concours réussi') this.unlockAchievement('scholar');
    const hobbyLevels = HOBBY_DEFS.filter((hb) => hobbyLevelFor(hb.id, Number(s.player.hobbies[hb.id] ?? 0)) >= 2).length;
    if (hobbyLevels >= 3) this.unlockAchievement('renaissance');
    if (Number(s.storyFlags['holidays_seen'] ?? 0) >= 5) this.unlockAchievement('festive');
    if (s.stats.gigsDone >= 25) this.unlockAchievement('gig_legend');
    if (Number(s.storyFlags['generous_given'] ?? 0) >= 100000) this.unlockAchievement('philanthropist');
  }

  onNewDay() {
    const s = this.state;
    s.stats.daysPlayed += 1;
    const dom = (Number(s.storyFlags['dayOfMonth'] ?? 1) % 30) + 1;
    s.storyFlags['dayOfMonth'] = dom;
    s.storyFlags['shortcuts_today'] = 0;

    this.rollWeather();
    this.rollOutages();
    this.rollCityLife();
    const cityResult = processCityHallDay(s, this.rng);
    if (cityResult) {
      const fr = s.settings.language === 'fr';
      const winner = fr ? cityResult.winnerNameFr : cityResult.winnerName;
      const policyDef = CITY_POLICY_MAP[cityResult.policy];
      const policyName = fr ? policyDef.nameFr : policyDef.name;
      const body = fr
        ? `${winner} remporte la mairie. Nouvelle politique : ${policyName}.`
        : `${winner} wins City Hall. New policy: ${policyName}.`;
      this.notifyApp('city', fr ? 'Résultat de l’élection' : 'Election result', body);
      this.addMessage('uncle_baba', body, 'news');
      this.toast(body, cityResult.playerWon ? 'success' : 'info');
      if (cityResult.playerWon) {
        this.giveIncome('cash', 25000, 'civic', 'City Hall', 'Mayor salary');
        this.milestone(fr ? 'Tu es maire de Yaoundé !' : 'You are the mayor of Yaounde!');
      }
      this.pushLog(body);
    }
    if (s.world.outages[s.player.district]) {
      s.storyFlags['outage_days_seen'] = Number(s.storyFlags['outage_days_seen'] ?? 0) + 1;
    }
    this.processDailyFinance(dom);
    this.processNjangiSitting();
    this.processHoliday();
    this.processBusinessDay();
    this.processFleetDay();
    this.processPayroll(dom);
    this.processExams();
    this.processRentalIncome();
    dailyRelationshipDrift(s, this.rng);
    const comfort = s.home?.comfort ?? 0;
    if (comfort > 0) {
      applyNeedEffects(s.player.needs, {
        mood: Math.min(8, Math.round(comfort / 5)),
        energy: Math.min(6, Math.round(comfort / 8)),
        hygiene: comfort >= 30 ? 1 : 0,
      });
    }
    this.processSocialFeedDay();
    this.sendWeeklyBudgetSummary();
    this.sendMorningMessages(dom);
    this.refreshGoals();
    this.processStoryChains();
    const weatherLabel = s.world.weather === 'rain' ? 'Rain expected today.' : s.world.weather === 'cloud' ? 'Cloudy sky.' : 'Clear morning.';
    this.pushLog(`Day ${s.world.day} begins. ${weatherLabel}`);
  }

  private sendWeeklyBudgetSummary() {
    const s = this.state;
    if (s.world.dayOfWeek !== 0) return;
    const view = weeklyBudgetView(s);
    if (view.income === 0 && view.expense === 0) return;
    const fr = s.settings.language === 'fr';
    const biggest = view.biggestExpense ? budgetCategoryLabel(view.biggestExpense, fr) : null;
    const body = fr
      ? `Semaine : entrées ${view.income.toLocaleString()} F · sorties ${view.expense.toLocaleString()} F.${biggest ? ` Plus grosse dépense : ${biggest}.` : ''}`
      : `Week: income ${view.income.toLocaleString()} F · spending ${view.expense.toLocaleString()} F.${biggest ? ` Biggest expense: ${biggest}.` : ''}`;
    this.notifyApp('wallet', fr ? 'Résumé hebdomadaire' : 'Weekly budget summary', body);
    const overBudget = BUDGET_CATEGORIES.filter((c) => {
      const planned = view.byCategory[c.id].planned;
      return planned > 0 && view.byCategory[c.id].expense > planned;
    });
    if (overBudget.length > 0) {
      const names = overBudget.map((c) => budgetCategoryLabel(c.id, fr)).join(', ');
      this.notifyApp('wallet', fr ? 'Budget dépassé' : 'Over your plan', fr ? `Plans dépassés : ${names}.` : `Over plan: ${names}. Adjust next week's plan or slow down.`);
    }
  }

  private rollWeather() {
    const s = this.state;
    const dayInYear = s.world.day % 360;
    const rainySeason = dayInYear > 60 && dayInYear < 330;
    const r = this.rng.next();
    if (rainySeason) {
      s.world.weather = r < 0.38 ? 'rain' : r < 0.7 ? 'cloud' : 'sun';
    } else {
      s.world.weather = r < 0.15 ? 'rain' : r < 0.4 ? 'cloud' : 'sun';
    }
  }

  private rollOutages() {
    const s = this.state;
    s.world.outages = {};
    for (const zone of ZONES) {
      if (this.rng.chance(0.45 * (1.2 - zone.powerReliability) * cityPolicyMultiplier(s, 'power_deal'))) {
        const start = this.rng.pick([7 * 60, 9 * 60, 13 * 60, 17 * 60, 19 * 60]);
        const dur = this.rng.int(120, 300);
        s.world.outages[zone.id] = { start, end: start + dur };
      }
    }
    const myDistrict = s.player.district;
    const outage = s.world.outages[myDistrict];
    if (outage) {
      this.notifyApp('maps', 'Outage today', `Delestage in your quartier from ${Math.floor(outage.start / 60)}h to ${Math.floor((outage.end % 1440) / 60)}h.`);
    }
  }

  private rollCityLife() {
    const s = this.state;
    s.world.strike = this.rng.chance(0.05);
    s.world.matchDay = s.world.dayOfWeek === 0 || this.rng.chance(0.15);
    s.world.marketDay = s.world.dayOfWeek !== 0;
    s.world.fuelPrice = Math.max(700, Math.min(1000, s.world.fuelPrice + this.rng.int(-8, 12)));
    if (s.world.strike) {
      this.notifyApp('maps', 'Traffic alert', 'Taxi strike today. Motos are the only vehicles moving.');
    }
    s.world.headlines = generateCityNews(s).map((n) => (s.settings.language === 'fr' ? n.textFr : n.text));
  }

  private processDailyFinance(dom: number) {
    const s = this.state;
    const rent = Number(s.storyFlags['rent'] ?? 15000);
    const rentDueDay = Number(s.storyFlags['rentDueDay'] ?? 30);

    if (rent > 0 && dom === rentDueDay - 3) {
      this.notifyApp('notes', 'Rent reminder', `Rent of ${rent.toLocaleString()} FCFA is due in 3 days. Plan for it.`);
    }
    if (rent > 0 && (dom === rentDueDay || s.storyFlags['rent_late'])) {
      const paid = this.spend('cash', rent, 'rent', 'Landlord', `Rent day ${dom}`);
      if (paid) {
        if (s.storyFlags['rent_late']) {
          this.toast('Rent paid. Your landlord removes the late note.', 'success');
          s.storyFlags['rent_late'] = false;
        } else {
          this.toast(`Rent paid: ${rent.toLocaleString()} FCFA`, 'money');
        }
        this.pushLog(`Paid rent (${rent.toLocaleString()} FCFA).`);
      } else if (!s.storyFlags['rent_late']) {
        s.storyFlags['rent_late'] = true;
        this.notifyApp('notes', 'Rent unpaid', `You could not pay rent. Talk to your landlord — pay it within 5 days with a small late note. No one is throwing you out.`);
        this.pushLog('Rent is late. Your landlord is waiting for a conversation.');
      }
    }
    if (s.storyFlags['rent_late'] && Number(s.storyFlags['rent_late_days'] ?? 0) > 6) {
      s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) - 1;
      s.storyFlags['rent_late_days'] = 0;
      this.notifyApp('notes', 'Neighbour talk', 'People in the compound noticed the unpaid rent. Your landlord still prefers a payment plan to a confrontation.');
    }
    s.storyFlags['rent_late_days'] = s.storyFlags['rent_late'] ? Number(s.storyFlags['rent_late_days'] ?? 0) + 1 : 0;

    if (s.world.day % 7 === 0) {
      const util = 2500;
      if (this.spend('cash', util, 'utilities', 'ENEO & Camwater', 'Water and electricity')) {
        this.pushLog('Paid water and electricity (2,500 FCFA).');
      } else {
        this.notifyApp('notes', 'Utilities unpaid', 'Water and electricity were not paid. Pay when you can — services slow down but life goes on.');
      }
    }
  }

  private processNjangiSitting() {
    const s = this.state;
    const m = s.njangi.membership;
    if (!m || m.status !== 'active') return;
    const group = s.njangi.groups.find((g) => g.id === m.groupId);
    if (!group) return;
    if (s.world.day < m.nextSittingDay) return;

    if (group.sketchy && this.rng.chance(0.15) && m.cyclesReceived === 0) {
      group.status = 'fraud';
      m.status = 'left';
      this.notifyApp('messages', 'Tontine trouble', 'The "Fast Pot" organizer stopped answering calls. This is how fraudulent tontines collapse: no books, no verified identity, pressure to pay fast. Lesson recorded.');
      this.pushLog('The "Fast Pot" digital tontine collapsed. Your contributions are gone.');
      this.addMessage('david_hustler', 'Bro... I am also a victim here. The organizer disappeared with everything. I am sorry.', 'chat');
      applyRelationDelta(s, 'david_hustler', { trust: -15, memory: { kind: 'promise_broken', note: 'His tontine collapsed with your money' } });
      return;
    }

    const totalMembers = group.members.length + 1;
    const pot = group.contribution * totalMembers;
    const duePos = m.turnOrder;

    const balance = totalMoney(s.wallet);
    let contributionPaid = false;
    if (balance >= m.contribution) {
      const w = s.wallet.cash >= m.contribution ? 'cash' : s.wallet.momo >= m.contribution ? 'momo' : 'bank';
      if (this.spend(w, m.contribution, 'njangi', group.name, 'Weekly contribution')) {
        contributionPaid = true;
      }
    }
    if (!contributionPaid) {
      m.missed += 1;
      this.notifyApp('notes', 'Njangi contribution missed', `You missed the ${m.contribution.toLocaleString()} FCFA contribution. Open the Njangi screen: cover it late (with a small penalty) or talk to the group honestly.`);
      this.pushLog('Missed a njangi contribution. The group is watching.');
      m.nextSittingDay = s.world.day + m.cadenceDays;
      return;
    }

    m.cyclesPaid += 1;
    const cycle = m.cyclesPaid;
    if (cycle === duePos) {
      const lateFee = 0;
      this.giveIncome('cash', pot - lateFee, 'njangi', group.name, `Njangi pot received (cycle ${cycle})`);
      m.cyclesReceived += 1;
      s.stats.njangiCyclesWon += 1;
      for (const memberId of group.members) {
        applyRelationDelta(s, memberId, { trust: 4, memory: { kind: 'promise_kept', note: 'You received the njangi pot and stayed reliable' } });
      }
      this.milestone(`Njangi pot received: ${pot.toLocaleString()} FCFA`);
      this.notifyApp('notes', 'Njangi pot', `You received the pot: ${pot.toLocaleString()} FCFA. Members trust you more.`);
      if (cycle >= totalMembers) {
        m.status = 'completed';
        group.status = 'completed';
        s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) + 3;
        this.notifyApp('notes', 'Njangi completed', 'Your njangi cycle is complete with a clean record. Word of your reliability is spreading.');
      }
    } else {
      const recipientIndex = cycle - 1;
      const recipientId = recipientIndex < group.members.length ? group.members[recipientIndex] : 'player';
      group.potHistory.push({ cycle, recipient: recipientId, day: s.world.day, amount: pot });
      if (recipientId !== 'player') {
        this.notifyApp('notes', 'Njangi sitting', `${s.npcs[recipientId]?.name ?? 'A member'} received this week's pot (${pot.toLocaleString()} FCFA).`);
      }
    }
    m.nextSittingDay = s.world.day + m.cadenceDays;
    this.pushLog(`Njangi sitting done. Contribution ${m.contribution.toLocaleString()} FCFA.`);
  }

  private processBusinessDay() {
    const s = this.state;
    const outage = s.world.outages[s.player.district];
    for (const biz of s.businesses) {
      const def = BUSINESS_MAP[biz.kind];
      if (!def) continue;
      biz.revenueToday = 0;
      biz.costsToday = 0;

      for (const delivery of biz.pendingDeliveries.filter((d) => d.arrivesDay <= s.world.day)) {
        biz.stock[delivery.itemId] = (biz.stock[delivery.itemId] ?? 0) + delivery.qty;
        biz.stockQuality = delivery.quality;
      }
      biz.pendingDeliveries = biz.pendingDeliveries.filter((d) => d.arrivesDay > s.world.day);

      let spoiled = 0;
      for (const [itemId, qty] of Object.entries(biz.stock)) {
        const perishableDays = ITEM_MAP[itemId]?.perishableDays;
        if (!perishableDays || qty <= 2) continue;
        const rate = perishableDays <= 1 ? 0.3 : 0.15;
        const loss = Math.min(qty, Math.floor(qty * rate));
        if (loss <= 0) continue;
        biz.stock[itemId] = qty - loss;
        spoiled += 1;
        biz.costsToday += Math.round(loss * ITEM_MAP[itemId].wholesalePrice);
      }
      if (spoiled > 0) {
        this.notifyApp('business', `${biz.name}: stock spoiled`, `${spoiled} perishable item(s) went bad overnight. Sell food items faster or stock smaller amounts.`);
      }

      for (const staffId of [...biz.staffIds]) {
        const info = biz.staffInfo[staffId] ?? { morale: 70, skill: 2 };
        biz.staffInfo[staffId] = info;
        const npcName = s.npcs[staffId]?.name ?? 'Employee';
        if (this.spend('cash', STAFF_DAILY_WAGE, 'staff_wages', npcName, `Wage at ${biz.name}`)) {
          info.morale = clamp(info.morale + 2);
          biz.costsToday += STAFF_DAILY_WAGE;
        } else {
          info.morale = clamp(info.morale - 20);
          this.notifyApp('business', 'Wages unpaid', `${npcName} was not paid at ${biz.name}. Morale is falling fast — pay soon or they will leave.`);
          if (info.morale < 20) {
            biz.staffIds = biz.staffIds.filter((id) => id !== staffId);
            delete biz.staffInfo[staffId];
            const npc = s.npcs[staffId];
            if (npc) npc.jobId = undefined;
            applyRelationDelta(s, staffId, { trust: -15, affection: -10, memory: { kind: 'fired', note: 'Wages went unpaid' } });
            this.notifyApp('business', 'Employee quit', `${npcName} quit ${biz.name} after unpaid wages. Keep cash for wages.`);
            continue;
          }
        }
        if (biz.reputation >= 40 && info.morale > 80) biz.reputation = Math.min(100, biz.reputation + 0.15);
      }

      if (!biz.openToday) continue;

      const zone = DISTRICT_MAP[biz.district];
      const footTraffic = zone?.footTraffic ?? 0.6;

      const rentPaid = this.spend('cash', biz.rentPerDay, 'business_costs', 'Landlord (business)', `Rent ${biz.name}`);
      biz.costsToday += biz.rentPerDay;
      if (!rentPaid) {
        biz.arrears += biz.rentPerDay;
        biz.reputation = Math.max(0, biz.reputation - 1);
        this.notifyApp('business', 'Business rent late', `${biz.name} could not pay today's rent. Arrears: ${biz.arrears.toLocaleString()} FCFA. No forced closure — pay when you can.`);
      }
      if (biz.hasGenerator && outage) {
        const fuel = 1500;
        if (this.spend('cash', fuel, 'business_costs', 'Fuel station', 'Generator fuel')) {
          biz.costsToday += fuel;
        }
      }

      const priceScore = 1 + (1.0 - biz.priceLevel) * 1.1;
      const qualityScore = 0.6 + biz.quality * 0.06;
      const stockQualityFactor = biz.stockQuality === 'good' ? 1.12 : biz.stockQuality === 'low' ? 0.9 : 1.0;
      const repScore = 0.7 + biz.reputation * 0.03;
      const seasonFactor = s.world.weather === 'rain' ? (biz.kind === 'poisson_stand' ? 0.85 : 1.05) : s.world.weather === 'sun' && biz.kind === 'drinks_kiosk' ? 1.2 : 1.0;
      const matchBoost = s.world.matchDay && (biz.kind === 'drinks_kiosk' || biz.kind === 'poisson_stand') ? 1.35 : 1.0;
      const ownWork = s.storyFlags[`stall_worked_${s.world.day}`] === biz.id ? 1.35 : 1.0;
      const outagePenalty = outage && !biz.hasGenerator ? outageImpact(s.world.minute, outage) : 1;
      let marketingBoost = 1.0;
      if (biz.marketing && s.world.day <= biz.marketing.untilDay) {
        const span = biz.marketing.untilDay - biz.marketing.startDay + 1;
        const remaining = biz.marketing.untilDay - s.world.day + 1;
        marketingBoost = 1 + (biz.marketing.boost - 1) * (remaining / span);
      } else if (biz.marketing) {
        biz.marketing = null;
      }
      const staffMorales = biz.staffIds.map((id) => biz.staffInfo[id]?.morale ?? 70);
      const avgMorale = staffMorales.length ? staffMorales.reduce((a, b) => a + b, 0) / staffMorales.length : 70;
      const moraleFactor = 0.9 + (avgMorale / 100) * 0.2;

      let demand = def.baseDemand * footTraffic * priceScore * qualityScore * stockQualityFactor * repScore * seasonFactor * matchBoost * ownWork * outagePenalty * marketingBoost * moraleFactor;
      const premisesDef = premisesLevelDef(biz.premises ?? 0);
      if (premisesDef) demand *= premisesDef.demandFactor;
      demand *= this.rng.range(0.8, 1.2);
      const hasService = def.serviceIncome > 0;
      const customers = Math.max(0, Math.round(demand));

      let revenue = 0;
      let unitsSold = 0;
      if (hasService) {
        const staffCapacity = 1 + biz.staffIds.reduce((sum, id) => {
          const info = biz.staffInfo[id] ?? { morale: 70, skill: 2 };
          return sum + (0.4 + info.skill * 0.15) * clamp(info.morale / 70, 0.6, 1.2);
        }, 0);
        const served = Math.min(customers, Math.round(def.baseDemand * footTraffic * 0.6 * staffCapacity * repScore * moraleFactor));
        revenue = Math.round(served * def.serviceIncome * biz.priceLevel);
      }
      if (def.stockItems.length > 0) {
        for (const itemId of def.stockItems) {
          const available = biz.stock[itemId] ?? 0;
          if (available <= 0) continue;
          const sellQty = Math.min(available, Math.round(customers * (0.7 / def.stockItems.length) + this.rng.range(0, 2)));
          if (sellQty <= 0) continue;
          biz.stock[itemId] = available - sellQty;
          unitsSold += sellQty;
          const saleUnit = districtPrice(s, biz.district, ITEM_MAP[itemId].basePrice) * biz.priceLevel;
          const wholesaleUnit = districtPrice(s, biz.district, ITEM_MAP[itemId].wholesalePrice);
          revenue += Math.round(sellQty * saleUnit);
          biz.costsToday += Math.round(sellQty * wholesaleUnit * 0);
          void saleUnit;
        }
      }
      if (unitsSold === 0 && def.stockItems.length > 0 && !hasService) {
        this.notifyApp('business', `${biz.name}: no stock`, 'You sold nothing today — stock is empty. Buy stock at the wholesale market.');
      } else if (revenue > 0) {
        this.giveIncome('cash', revenue, 'business_revenue', biz.name, `${customers} customers`);
      }
      biz.revenueToday = revenue;
      if (biz.priceLevel > 1.2) biz.customerSatisfaction = clamp(biz.customerSatisfaction - 4);
      else if (biz.priceLevel < 0.9) biz.customerSatisfaction = clamp(biz.customerSatisfaction + 3);
      const profit = revenue - biz.costsToday;
      if (profit > 0) {
        biz.reputation = Math.min(100, biz.reputation + 0.4);
      } else if (profit < -biz.rentPerDay) {
        biz.reputation = Math.max(0, biz.reputation - 0.4);
      }
      if (revenue > biz.rentPerDay * 3) {
        this.notifyApp('business', `${biz.name} strong day`, `Revenue ${revenue.toLocaleString()} FCFA yesterday. Consider expanding stock.`);
      }
    }
  }

  private processPayroll(dom: number) {
    const s = this.state;
    const job = s.player.job;
    if (!job) return;
    const def = JOB_MAP[job.jobId];
    if (!def) return;
    const raise = Number(s.storyFlags[`raise_${job.jobId}`] ?? 1);
    if (def.payCadence === 'week' && s.world.dayOfWeek === 0) {
      const expected = 5;
      const factor = Math.min(1, job.shiftsThisWeek / expected);
      const pay = Math.round(def.pay * factor * raise);
      if (pay > 0) {
        this.giveIncome('bank', pay, 'wage', def.employer, `Weekly pay (${job.shiftsThisWeek} shifts)`);
        this.toast(`Weekly salary: ${pay.toLocaleString()} FCFA`, 'money');
      } else {
        this.notifyApp('jobs', 'No shifts this week', `${def.employer} recorded no shifts from you this week. No punishment — just no pay.`);
        job.reliability = Math.max(0, job.reliability - 5);
      }
      job.shiftsThisWeek = 0;
    }
    if (def.payCadence === 'month' && dom === 1) {
      const expected = 20;
      const factor = Math.min(1, job.shiftsThisWeek / expected);
      const pay = Math.round(def.pay * factor * raise);
      if (pay > 0) {
        this.giveIncome('bank', pay, 'wage', def.employer, 'Monthly pay');
        this.toast(`Monthly salary: ${pay.toLocaleString()} FCFA`, 'money');
      }
      job.shiftsThisWeek = 0;
    }
    if (job.performance >= 75 && job.shiftsWorked >= 10 && !s.storyFlags[`raise_${job.jobId}`]) {
      s.storyFlags[`raise_${job.jobId}`] = 1.15;
      this.notifyApp('jobs', 'A raise', `${def.employer} raised your pay by 15% after a strong record.`);
    }
  }

  private sendMorningMessages(dom: number) {
    const s = this.state;
    if (this.rng.chance(0.3)) {
      const metIds = Object.values(s.relationships).filter((r) => r.stage !== 'stranger').map((r) => r.npcId);
      if (metIds.length > 0) {
        const npcId = this.rng.pick(metIds);
        const npc = s.npcs[npcId];
        const lines = [
          `Good morning from ${npc?.name ?? 'a friend'}. Any plans today?`,
          'You are quiet these days. Come and greet people.',
          'Did you see the news? The city never stops.',
          'If you pass by, greet the family for me.',
        ];
        this.addMessage(npcId, this.rng.pick(lines), 'chat');
      }
    }
    if (dom === Number(s.storyFlags['rentDueDay'] ?? 30) - 1) {
      this.notifyApp('notes', 'Rent tomorrow', 'Rent is due tomorrow. Make sure your cash is ready.');
    }
    if (s.njangi.membership && s.njangi.membership.status === 'active' && s.world.day === s.njangi.membership.nextSittingDay - 1) {
      this.notifyApp('notes', 'Njangi tomorrow', `Contribution of ${s.njangi.membership.contribution.toLocaleString()} FCFA is due tomorrow.`);
    }
  }

  maybeRollRandomEvent() {
    const s = this.state;
    if (this.suppressRandomEvents) return;
    if (s.pendingEvents.length > 0) return;
    if (!this.rng.chance(0.24)) return;
    const eligible = EVENT_TEMPLATES.filter((tpl) => this.eventConditionsMet(tpl) && !this.eventOnCooldown(tpl));
    if (eligible.length === 0) return;
    const picked = this.rng.weighted(eligible.map((e) => ({ item: e, weight: e.weight })));
    if (!picked) return;
    this.queueEvent(picked.id);
  }

  private eventConditionsMet(tpl: (typeof EVENT_TEMPLATES)[number]): boolean {
    const s = this.state;
    const c = tpl.conditions;
    if (!c) return true;
    if (c.district && !c.district.includes(s.player.district)) return false;
    if (c.minDay && s.world.day < c.minDay) return false;
    if (c.weather && s.world.weather !== c.weather) return false;
    if (c.minCash !== undefined && totalMoney(s.wallet) < c.minCash) return false;
    if (c.maxCash !== undefined && totalMoney(s.wallet) > c.maxCash) return false;
    if (c.hasJob !== undefined && Boolean(s.player.job) !== c.hasJob) return false;
    if (c.timeFrom !== undefined && s.world.minute < c.timeFrom) return false;
    if (c.timeTo !== undefined && s.world.minute > c.timeTo) return false;
    if (c.flag && !s.storyFlags[c.flag]) return false;
    if (c.once && s.eventCooldowns[tpl.id] !== undefined) return false;
    return true;
  }

  private eventOnCooldown(tpl: (typeof EVENT_TEMPLATES)[number]): boolean {
    const cd = this.state.eventCooldowns[tpl.id];
    if (cd === undefined) return false;
    return this.state.world.day - cd < 4;
  }

  queueEvent(templateId: string, npcId?: string) {
    const tpl = EVENT_MAP[templateId];
    if (!tpl) return;
    const s = this.state;
    s.eventCooldowns[templateId] = s.world.day;
    const event: PendingEvent = {
      templateId,
      title: tpl.title,
      titleFr: tpl.titleFr,
      body: tpl.body,
      bodyFr: tpl.bodyFr,
      choices: tpl.choices.map((c) => ({ id: c.id, label: c.label, labelFr: c.labelFr })),
      kind: tpl.kind,
      npcId: npcId ?? this.defaultNpcForEvent(tpl.kind),
    };
    s.pendingEvents.push(event);
    this.toast(`Event: ${tpl.title}`, 'info');
    this.notifyApp('notes', tpl.title, tpl.body.slice(0, 90));
    this.pausedIfModalWanted();
  }

  private pausedIfModalWanted() {}

  private defaultNpcForEvent(kind: string): string | undefined {
    const map: Record<string, string> = {
      social: 'sandra',
      market: 'papa_ngassa',
      work: 'manager_njoya',
      city: 'brandon',
      health: 'sister_grace',
      opportunity: 'david_hustler',
    };
    return map[kind];
  }

  dispatch(action: GameAction): ActionResult {
    let result: ActionResult;
    switch (action.type) {
      case 'activity':
        result = this.doActivity(action.activityId, action.businessId);
        break;
      case 'travel':
        result = this.doTravel(action.to, action.mode, action.vehicleId);
        break;
      case 'walk_enter':
        result = this.doWalkEnter(action.to);
        break;
      case 'talk':
        result = this.doTalk(action.npcId, action.kind);
        break;
      case 'buy':
        result = this.doBuy(action.itemId, action.qty, action.vendor);
        break;
      case 'sell':
        result = this.doSell(action.itemId, action.qty);
        break;
      case 'withdraw_momo':
        result = this.doMomo('withdraw', action.amount);
        break;
      case 'deposit_momo':
        result = this.doMomo('deposit', action.amount);
        break;
      case 'transfer_momo':
        result = this.doTransferMomo(action.npcId, action.amount);
        break;
      case 'bank_deposit':
        result = this.doBank('deposit', action.amount);
        break;
      case 'bank_withdraw':
        result = this.doBank('withdraw', action.amount);
        break;
      case 'loan_take':
        result = this.doLoanTake(action.amount);
        break;
      case 'loan_repay':
        result = this.doLoanRepay(action.amount);
        break;
      case 'buy_airtime':
        result = this.doBuyCredit(action.amount, false);
        break;
      case 'buy_data':
        result = this.doBuyCredit(action.amount, true);
        break;
      case 'apply_job':
        result = this.doApplyJob(action.jobId);
        break;
      case 'work_shift':
        result = this.doWorkShift(action.jobId, action.minutes);
        break;
      case 'resign_job':
        result = this.doResign();
        break;
      case 'moto_run':
        result = this.doMotoRuns(action.trips);
        break;
      case 'delivery_trip':
        result = this.doDeliveries(action.drops);
        break;
      case 'business_open':
        result = this.doBusinessOpen(action.kind, action.name);
        break;
      case 'business_buy_stock':
        result = this.doBusinessStock(action.businessId, action.itemId, action.qty, action.supplier);
        break;
      case 'business_set_price':
        result = this.doBusinessPrice(action.businessId, action.priceLevel);
        break;
      case 'business_hire':
        result = this.doBusinessHire(action.businessId, action.npcId);
        break;
      case 'business_fire':
        result = this.doBusinessFire(action.businessId, action.npcId);
        break;
      case 'business_toggle':
        result = this.doBusinessToggle(action.businessId, action.open);
        break;
      case 'business_generator':
        result = this.doBusinessGenerator(action.businessId);
        break;
      case 'business_staff_bonus':
        result = this.doBusinessStaffBonus(action.businessId, action.npcId, action.amount);
        break;
      case 'business_train_staff':
        result = this.doBusinessTrainStaff(action.businessId, action.npcId);
        break;
      case 'business_marketing':
        result = this.doBusinessMarketing(action.businessId, action.campaign);
        break;
      case 'report_content':
        result = this.doReportContent(action.kind, action.refId, action.note);
        break;
      case 'budget_set_plan':
        result = this.doBudgetSetPlan(action.category, action.amount);
        break;
      case 'savings_goal_add':
        result = this.doAddSavingsGoal(action.name, action.target);
        break;
      case 'savings_goal_deposit':
        result = this.doSavingsGoalMove(action.goalId, action.amount, 'deposit');
        break;
      case 'savings_goal_withdraw':
        result = this.doSavingsGoalMove(action.goalId, action.amount, 'withdraw');
        break;
      case 'savings_goal_delete':
        result = this.doDeleteSavingsGoal(action.goalId);
        break;
      case 'exam_register':
        result = this.doExamRegister(action.trackId);
        break;
      case 'exam_take':
        result = this.doExamTake();
        break;
      case 'hobby_buy_gear':
        result = this.doHobbyBuyGear(action.hobbyId);
        break;
      case 'hobby_compete':
        result = this.doHobbyCompete(action.hobbyId);
        break;
      case 'property_buy':
        result = this.doPropertyBuy(action.propertyId);
        break;
      case 'vehicle_buy':
        result = this.doVehicleBuy(action.modelId);
        break;
      case 'vehicle_sell':
        result = this.doVehicleSell(action.vehicleId);
        break;
      case 'vehicle_refuel':
        result = this.doVehicleRefuel(action.vehicleId);
        break;
      case 'vehicle_repair':
        result = this.doVehicleRepair(action.vehicleId);
        break;
      case 'vehicle_assign_rider':
        result = this.doVehicleAssignRider(action.vehicleId, action.riderId);
        break;
      case 'business_premises_upgrade':
        result = this.doBusinessPremisesUpgrade(action.businessId);
        break;
      case 'njangi_join':
        result = this.doNjangiJoin(action.groupId, action.turn);
        break;
      case 'njangi_contribute':
        result = this.doNjangiContribute();
        break;
      case 'njangi_miss':
        result = this.doNjangiMiss(action.resolve);
        break;
      case 'njangi_leave':
        result = this.doNjangiLeave();
        break;
      case 'event_choice':
        result = this.doEventChoice(action.eventIndex, action.choiceId);
        break;
      case 'dismiss_event': {
        const ev = this.state.pendingEvents[action.eventIndex];
        if (ev) {
          this.state.pendingEvents.splice(action.eventIndex, 1);
          result = { ok: true };
        } else {
          result = { ok: false };
        }
        break;
      }
      case 'message_send':
        result = this.doMessageSend(action.npcId, action.text, action.replyId);
        break;
      case 'message_read': {
        const msg = this.state.messages.find((m) => m.id === action.messageId);
        if (msg) msg.read = true;
        result = { ok: true };
        break;
      }
      case 'social_post':
        result = this.doSocialPost(action.text);
        break;
      case 'photo_taken':
        result = this.doPhoto(action.landmarkId);
        break;
      case 'goal_activate': {
        const def = GOAL_MAP[action.goalId];
        if (!def) {
          result = { ok: false, message: 'Unknown goal' };
        } else if (this.state.activeGoals.some((g) => g.id === action.goalId)) {
          result = { ok: false, message: 'Goal already active' };
        } else {
          this.state.activeGoals.push({ id: action.goalId, status: 'active', progress: def.check(this.state), target: def.target });
          result = { ok: true, message: `Goal added: ${def.name}` };
        }
        break;
      }
      case 'goal_abandon': {
        const g = this.state.activeGoals.find((x) => x.id === action.goalId);
        if (g) g.status = 'abandoned';
        result = { ok: true };
        break;
      }
      case 'housing_upgrade':
        result = this.doHousingUpgrade(action.stage);
        break;
      case 'pay_arrears':
        result = this.doPayArrears();
        break;
      case 'set_setting': {
        (this.state.settings as unknown as Record<string, unknown>)[action.key] = action.value;
        result = { ok: true };
        break;
      }
      case 'tutorial':
        this.advanceTutorial(action.tag);
        result = { ok: true };
        break;
      case 'city_vote':
        result = this.doCityVote(action.candidateId);
        break;
      case 'city_run':
        result = this.doCityRun(action.policy);
        break;
      case 'city_campaign':
        result = this.doCityCampaign(action.amount);
        break;
      case 'home_buy':
        result = this.doHomeBuy(action.itemId);
        break;
      case 'home_sell':
        result = this.doHomeSell(action.itemId);
        break;
      case 'social_like':
        result = this.doSocialLike(action.postId);
        break;
      case 'notification_read': {
        const n = this.state.phone.notifications.find((x) => x.id === action.id);
        if (n) n.read = true;
        result = { ok: true };
        break;
      }
      default:
        result = { ok: false };
    }
    this.state.updatedAt = Date.now();
    this.refreshGoals();
    this.processStoryChains();
    this.notify();
    return result;
  }

  private doActivity(activityId: string, businessId?: string): ActionResult {
    const s = this.state;
    const def = ACTIVITY_MAP[activityId];
    if (!def) return { ok: false, message: 'Unknown activity' };
    const cdKey = `actcd_${activityId}`;
    if (def.cooldownDays && Number(s.storyFlags[cdKey] ?? 0) > 0 && s.world.day - Number(s.storyFlags[cdKey]) < def.cooldownDays) {
      return { ok: false, message: `You can do this again in ${def.cooldownDays - (s.world.day - Number(s.storyFlags[cdKey]))} day(s).` };
    }
    if (def.requires?.skill) {
      const have = Math.floor(s.player.skills[def.requires.skill.key] ?? 0);
      if (have < def.requires.skill.level) {
        return {
          ok: false,
          message: `Requires ${def.requires.skill.key} level ${def.requires.skill.level} (you have ${have}). Practice or take a course to improve.`,
        };
      }
    }
    if (def.requires?.itemId) {
      const inv = s.inventory.find((i) => i.itemId === def.requires!.itemId);
      if (!inv || inv.qty <= 0) {
        return { ok: false, message: `You need ${ITEM_MAP[def.requires.itemId]?.name ?? def.requires.itemId}. Buy it first.` };
      }
      inv.qty -= 1;
      if (inv.qty <= 0) s.inventory = s.inventory.filter((i) => i.qty > 0);
    }
    const physical = ['health', 'work', 'business'].includes(def.category) || activityId === 'football_pitch';
    if (physical && s.player.needs.energy < 8) {
      return { ok: false, message: 'You are too exhausted for this. Rest, nap, or call it a day.' };
    }
    const activityCost = Math.round((def.cost ?? 0) * (def.category === 'food' ? cityPolicyMultiplier(s, 'food_discount') : 1));
    if (activityCost > 0) {
      const wallet = s.wallet.cash >= activityCost ? 'cash' : 'momo';
      if (!this.spend(wallet, activityCost, 'activity', def.name, def.name)) {
        return { ok: false, message: `You need ${activityCost.toLocaleString()} FCFA for this.` };
      }
    }

    if (activityId === 'sell_on_street') {
      const sellables = s.inventory.filter((i) => ITEM_MAP[i.itemId]?.tradeable);
      if (sellables.length === 0) {
        return { ok: false, message: 'You have nothing to sell. Buy stock at the market first (market stalls or wholesale).' };
      }
    }

    applyNeedEffects(s.player.needs, def.effects);
    if (def.category === 'fun') {
      applyNeedEffects(s.player.needs, { mood: cityFunMoodBonus(s) });
    }
    if (def.skill) {
      const cur = s.player.skills[def.skill.key];
      const gain = def.skill.gain * Math.max(0.25, 1 - cur * 0.06);
      s.player.skills[def.skill.key] = Math.round((cur + gain) * 10) / 10;
    }
    this.grantHobbyXp(def.id, (def.minutes / 30));
    let moneyChanged = 0;
    if (def.income && def.income > 0) {
      const bonus = 1 + s.player.skills[def.skill?.key ?? 'charisma'] * 0.02;
      const income = Math.round(def.income * Math.min(1.4, bonus));
      this.giveIncome('cash', income, 'gig', def.name, def.name);
      moneyChanged += income;
      s.stats.gigsDone += 1;
    }

    if (activityId === 'sell_on_street') {
      let total = 0;
      for (const inv of [...s.inventory]) {
        const itemDef = ITEM_MAP[inv.itemId];
        if (!itemDef?.tradeable) continue;
        const unit = sellPriceFor(s, inv.itemId, s.player.district);
        total += unit * inv.qty;
        s.inventory = s.inventory.filter((i) => i.itemId !== inv.itemId);
      }
      if (total > 0) {
        this.giveIncome('cash', total, 'sales', 'Street customers', 'Sold goods');
        s.stats.tradesDone += 1;
        moneyChanged += total;
        this.toast(`You sold your stock for ${total.toLocaleString()} FCFA`, 'money');
      }
      if (businessId) {
        s.storyFlags[`stall_worked_${s.world.day}`] = businessId;
      }
    }

    if (activityId === 'public_transport_learn') {
      const unlearned = ZONES.map((z) => z.id).filter((id) => !s.learnedRoutes.includes(id));
      if (unlearned.length > 0) {
        const target = unlearned.sort((a, b) => zoneDistance(s.player.district, a) - zoneDistance(s.player.district, b))[0];
        s.learnedRoutes.push(target);
        this.toast(`Route learned: ${DISTRICT_MAP[target].name}. You can fast-travel there from the Maps app.`, 'success');
      }
    }

    if (['eat_beignets', 'eat_soya', 'eat_poisson', 'eat_ndole', 'eat_koki', 'cook_meal', 'cook_ndole', 'eat_leftovers'].includes(activityId)) {
      this.advanceTutorial('ate');
    }
    if (def.category === 'social' || def.category === 'fun') {
      this.advanceTutorial('talked');
    }
    if (s.world.weather === 'rain' && (def.category === 'work' || def.category === 'business')) {
      s.storyFlags['worked_in_rain'] = true;
    }
    if (activityId === 'record_track' || activityId === 'karaoke_night') {
      s.storyFlags['performed_publicly'] = true;
    }
    if (def.outcomes && def.outcomes.length > 0) {
      const totalW = def.outcomes.reduce((a, o) => a + o.chance, 0);
      let r = this.rng.next() * Math.min(1, totalW);
      for (const o of def.outcomes) {
        r -= o.chance;
        if (r <= 0) {
          applyNeedEffects(s.player.needs, o.needs);
          if (o.money) {
            if (o.money > 0) this.giveIncome('cash', o.money, 'event', def.name, 'Activity outcome');
            else this.spend(s.wallet.cash >= -o.money ? 'cash' : 'momo', -o.money, 'event', def.name, 'Activity outcome');
            moneyChanged += o.money;
          }
          if (o.reputation) {
            s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) + o.reputation;
          }
          this.pushLog(o.text);
          this.toast(o.text, moneyChanged > 0 ? 'money' : 'info', o.textFr);
          break;
        }
      }
    }
    if (def.cooldownDays) s.storyFlags[cdKey] = s.world.day;

    this.advanceMinutes(def.minutes, { decay: true, rollEvents: true });
    this.pushLog(`Done: ${def.name} (${def.minutes} min)`);
    if (!def.outcomes) {
      this.toast(`${def.name} — done`, moneyChanged > 0 ? 'money' : 'info', def.nameFr);
    } else if (moneyChanged <= 0) {
      this.toast(`${def.name} — done`, 'info', def.nameFr);
    }
    return { ok: true, message: def.name };
  }

  private doTravel(to: DistrictId, mode: TravelMode, vehicleId?: string): ActionResult {
    const s = this.state;
    if (to === s.player.district) return { ok: false, message: 'You are already there.' };
    const plan = getTravelPlan(s, s.player.district, to);
    const option = doTravelOptionFor(plan.options, mode, vehicleId);
    if (!option) return { ok: false, message: 'That option is not available.' };
    if (!option.available) return { ok: false, message: option.unavailableReason ?? 'Unavailable.' };
    if (mode !== 'walk' && mode !== 'vehicle' && option.cost > 0) {
      const wallet = s.wallet.cash >= option.cost ? 'cash' : 'momo';
      if (!this.spend(wallet, option.cost, 'transport', mode === 'taxi' ? 'Taxi' : mode === 'moto' ? 'Moto-taxi' : 'Transport', `To ${plan.toName}`)) {
        return { ok: false, message: `You need ${option.cost.toLocaleString()} FCFA. Walk for free or earn some money first.` };
      }
    }
    let vehicle: VehicleState | null = null;
    let vehicleDef: VehicleDef | undefined;
    if (mode === 'vehicle') {
      vehicle = s.vehicles.find((v) => v.id === (vehicleId ?? option.vehicleId)) ?? null;
      vehicleDef = vehicle ? VEHICLE_MAP[vehicle.modelId] : undefined;
      if (!vehicle || !vehicleDef) return { ok: false, message: 'That vehicle is not in your garage.' };
      if (vehicle.fleetRiderId) return { ok: false, message: 'That vehicle is with a fleet rider today. Reassign it in the Garage app first.' };
      const litres = Math.round(plan.distance * vehicleDef.fuelPerDistance * 10) / 10;
      if (vehicle.condition < 15) return { ok: false, message: 'Your vehicle needs repairs before this trip.' };
      if (vehicle.fuel < litres) return { ok: false, message: `Not enough fuel. This trip needs about ${litres.toFixed(1)} L.` };
      vehicle.fuel = Math.round((vehicle.fuel - litres) * 100) / 100;
      vehicle.condition = Math.max(0, Math.round((vehicle.condition - vehicleDef.wearPerTrip) * 10) / 10);
      vehicle.trips += 1;
      vehicle.district = to;
      if (vehicle.condition < 20) {
        this.notifyApp('garage', 'Vehicle needs repairs', `${vehicleDef.name} is at ${Math.round(vehicle.condition)}% condition. Repairs get more expensive the longer you wait.`);
      }
    }
    this.advanceMinutes(option.minutes, { decay: true, rollEvents: true });
    s.player.district = to;
    if (!s.learnedRoutes.includes(to)) {
      s.learnedRoutes.push(to);
      this.toast(`Route learned: ${plan.toName}`, 'success');
    }
    s.travelLog.unshift({ day: s.world.day, mode, from: plan.from, to, cost: option.cost });
    if (s.travelLog.length > 100) s.travelLog.length = 100;
    this.advanceTutorial('traveled');
    this.pushLog(`Travelled to ${plan.toName} (${mode === 'vehicle' ? vehicleDef?.name ?? 'own vehicle' : mode}, ${option.minutes} min).`);
    if (mode === 'vehicle' && vehicle && vehicleDef && this.rng.chance(option.risk)) {
      if (vehicleDef.kind === 'moto') {
        this.queueEvent('moto_accident');
      } else {
        vehicle.condition = Math.max(0, vehicle.condition - 8);
        this.queueEvent('vehicle_breakdown');
      }
    } else if (mode === 'moto' && this.rng.chance(option.risk)) {
      this.queueEvent('moto_accident');
    } else if (mode === 'taxi' && this.rng.chance(0.02)) {
      this.queueEvent('delayed_taxi');
    }
    return { ok: true, message: `Arrived in ${plan.toName}.`, toast: 'info' };
  }

  private doWalkEnter(to: DistrictId): ActionResult {
    const s = this.state;
    if (to === s.player.district) return { ok: true };
    const zone = DISTRICT_MAP[to];
    if (!zone) return { ok: false, message: 'Unknown area.' };
    this.advanceMinutes(3, { decay: true, rollEvents: false });
    s.player.district = to;
    this.advanceTutorial('traveled');
    this.pushLog(`Walked into ${zone.name}.`);
    return { ok: true, toast: 'info' };
  }

  private doTalk(npcId: string, kind: 'greet' | 'chat' | 'gift' | 'help' | 'invite' | 'apologize'): ActionResult {
    const s = this.state;
    const npc = s.npcs[npcId];
    if (!npc) return { ok: false, message: 'That person is not around.' };
    const stage = s.relationships[npcId]?.stage ?? 'stranger';
    let stageChange = '';
    switch (kind) {
      case 'greet': {
        stageChange = applyRelationDelta(s, npcId, { trust: 2, affection: 1, memory: { kind: 'met', note: 'You greeted them' } });
        const relNow = s.relationships[npcId];
        if (relNow && relNow.stage === 'stranger') {
          relNow.stage = 'acquaintance';
        }
        this.advanceMinutes(5, { decay: true, rollEvents: false });
        this.advanceTutorial('talked');
        return { ok: true, message: `You greet ${npc.name}.` };
      }
      case 'chat': {
        applyRelationDelta(s, npcId, { trust: 1, affection: 3, compatibility: 1 });
        applyNeedEffects(s.player.needs, { social: 6, mood: 3 });
        this.advanceMinutes(15, { decay: true, rollEvents: false });
        this.advanceTutorial('talked');
        return { ok: true, message: `Good conversation with ${npc.name}.` };
      }
      case 'gift': {
        if (stage === 'stranger') {
          return { ok: false, message: 'You barely know this person. A gift would be strange right now.' };
        }
        const giftKey = `gifted_${npcId}_${s.world.day}`;
        if (s.storyFlags[giftKey]) {
          return { ok: false, message: 'One meaningful gift per day is enough. Relationships are not vending machines.' };
        }
        if (!this.spend('cash', 1000, 'gift', npc.name, 'Gift')) {
          return { ok: false, message: 'A small gift costs 1,000 FCFA.' };
        }
        applyRelationDelta(s, npcId, { affection: 7, trust: 2, memory: { kind: 'gift', note: 'You gave them a gift' } });
        s.storyFlags[giftKey] = true;
        s.storyFlags['generous_given'] = Number(s.storyFlags['generous_given'] ?? 0) + 1000;
        this.advanceMinutes(20, { decay: true, rollEvents: false });
        return { ok: true, message: `${npc.name} appreciated the gift. Small steps build real bonds.` };
      }
      case 'help': {
        applyRelationDelta(s, npcId, { trust: 8, respect: 5, memory: { kind: 'helped', note: 'You helped them with a practical task' } });
        applyNeedEffects(s.player.needs, { energy: -10, social: 8, mood: 5 });
        this.advanceMinutes(60, { decay: true, rollEvents: true });
        this.advanceTutorial('talked');
        return { ok: true, message: `You helped ${npc.name}. They will remember this.` };
      }
      case 'invite': {
        if (stage === 'stranger') {
          return { ok: false, message: 'You do not know them well enough to invite them out yet.' };
        }
        const accept = this.rng.next() < 0.5 + npcRelationshipScore(s, npcId) / 200;
        if (accept) {
          applyRelationDelta(s, npcId, { affection: 5, trust: 2 });
          applyNeedEffects(s.player.needs, { social: 12, mood: 10, energy: -6 });
          this.advanceMinutes(90, { decay: true, rollEvents: true });
          this.addMessage(npcId, 'That was a good time. We should do it again.', 'chat');
          return { ok: true, message: `You spent time with ${npc.name}.` };
        }
        applyRelationDelta(s, npcId, { affection: 1 });
        return { ok: true, message: `${npc.name} politely declined this time. A refusal is a valid answer — no pressure.` };
      }
      case 'apologize': {
        const broken = s.relationships[npcId]?.memory.some((m) => m.kind === 'promise_broken');
        if (!broken) return { ok: false, message: 'There is nothing between you that needs an apology right now.' };
        applyRelationDelta(s, npcId, { trust: 6, memory: { kind: 'promise_kept', note: 'You apologized sincerely' } });
        this.advanceMinutes(15, { decay: true, rollEvents: false });
        return { ok: true, message: `${npc.name} accepted your apology. Words matter.` };
      }
    }
    if (stageChange) this.toast(`${npc.name} now sees you as: ${stageChange.replace('_', ' ')}`, 'success');
    return { ok: true };
  }

  private doBuy(itemId: string, qty: number, vendor: string): ActionResult {
    const s = this.state;
    const itemDef = ITEM_MAP[itemId];
    if (!itemDef || qty <= 0) return { ok: false, message: 'Invalid purchase.' };
    const stock = getVendorStock(s, vendor, s.player.district);
    const entry = stock.find((x) => x.itemId === itemId);
    if (!entry) return { ok: false, message: 'This vendor does not sell that.' };
    const cost = entry.price * qty;
    const wallet = s.wallet.cash >= cost ? 'cash' : 'momo';
    if (!this.spend(wallet, cost, 'food', vendor, `${itemDef.name} x${qty}`)) {
      return { ok: false, message: `You need ${cost.toLocaleString()} FCFA for ${qty}x ${itemDef.name}.` };
    }
    const inv = s.inventory.find((i) => i.itemId === itemId);
    if (inv) inv.qty += qty;
    else s.inventory.push({ itemId, qty, quality: 'ok' });
    if (vendor === 'wholesale' || vendor === 'market_food') s.stats.tradesDone += 1;
    return { ok: true, message: `Bought ${qty}x ${itemDef.name} for ${cost.toLocaleString()} FCFA.`, toast: 'money' };
  }

  private doSell(itemId: string, qty: number): ActionResult {
    const s = this.state;
    const inv = s.inventory.find((i) => i.itemId === itemId);
    if (!inv || inv.qty < qty) return { ok: false, message: 'You do not have that many.' };
    const unit = sellPriceFor(s, itemId, s.player.district);
    const total = unit * qty;
    inv.qty -= qty;
    if (inv.qty <= 0) s.inventory = s.inventory.filter((i) => i.qty > 0);
    this.giveIncome('cash', total, 'sales', 'Customer', `Sold ${ITEM_MAP[itemId]?.name ?? itemId} x${qty}`);
    s.stats.tradesDone += 1;
    return { ok: true, message: `Sold for ${total.toLocaleString()} FCFA.`, toast: 'money' };
  }

  private doMomo(dir: 'deposit' | 'withdraw', amount: number): ActionResult {
    const s = this.state;
    if (amount <= 0) return { ok: false, message: 'Invalid amount.' };
    const fee = momoFee(amount);
    if (dir === 'deposit') {
      if (s.wallet.cash < amount) return { ok: false, message: 'Not enough cash.' };
      s.wallet.cash -= amount;
      s.wallet.momo += amount - fee;
      this.pushLog(`MoMo deposit: ${amount.toLocaleString()} FCFA (fee ${fee}).`);
      return { ok: true, message: `Deposited ${amount.toLocaleString()} FCFA to MoMo (fee ${fee} FCFA).` };
    }
    if (s.wallet.momo < amount + fee) return { ok: false, message: `Not enough MoMo balance (amount + fee ${fee}).` };
    s.wallet.momo -= amount + fee;
    s.wallet.cash += amount;
    this.pushLog(`MoMo withdrawal: ${amount.toLocaleString()} FCFA (fee ${fee}).`);
    return { ok: true, message: `Withdrew ${amount.toLocaleString()} FCFA (fee ${fee} FCFA).` };
  }

  private doTransferMomo(npcId: string, amount: number): ActionResult {
    const s = this.state;
    if (amount <= 0) return { ok: false, message: 'Invalid amount.' };
    const fee = momoFee(amount);
    if (s.wallet.momo < amount + fee) return { ok: false, message: `Not enough MoMo balance (amount + fee ${fee}).` };
    s.wallet.momo -= amount + fee;
    const npc = s.npcs[npcId];
    applyRelationDelta(s, npcId, { affection: 3, trust: 2 });
    s.storyFlags['generous_given'] = Number(s.storyFlags['generous_given'] ?? 0) + amount;
    this.pushLog(`Sent ${amount.toLocaleString()} FCFA to ${npc?.name ?? npcId}.`);
    return { ok: true, message: `Sent ${amount.toLocaleString()} FCFA to ${npc?.name ?? 'contact'} (fee ${fee}).` };
  }

  private doBank(dir: 'deposit' | 'withdraw', amount: number): ActionResult {
    const s = this.state;
    if (amount <= 0) return { ok: false, message: 'Invalid amount.' };
    if (dir === 'deposit') {
      if (s.wallet.cash < amount) return { ok: false, message: 'Not enough cash.' };
      s.wallet.cash -= amount;
      s.wallet.bank += amount;
      this.pushLog(`Bank deposit: ${amount.toLocaleString()} FCFA.`);
      return { ok: true, message: `Deposited ${amount.toLocaleString()} FCFA to the bank.` };
    }
    if (s.wallet.bank < amount) return { ok: false, message: 'Not enough bank balance.' };
    s.wallet.bank -= amount;
    s.wallet.cash += amount;
    this.pushLog(`Bank withdrawal: ${amount.toLocaleString()} FCFA.`);
    return { ok: true, message: `Withdrew ${amount.toLocaleString()} FCFA.` };
  }

  private doLoanTake(amount: number): ActionResult {
    const s = this.state;
    if (s.wallet.debt > 0) return { ok: false, message: 'Repay your current loan first. One debt at a time keeps life simple.' };
    if (amount <= 0 || amount > 150000) return { ok: false, message: 'Loans range from 5,000 to 150,000 FCFA.' };
    const interest = Math.round(amount * 0.12);
    s.wallet.debt = amount + interest;
    s.wallet.debtTo = 'Microfinance (12% flat)';
    s.wallet.bank += amount;
    this.pushLog(`Loan taken: ${amount.toLocaleString()} FCFA, repay ${(amount + interest).toLocaleString()} FCFA.`);
    return { ok: true, message: `Loan received. You owe ${(amount + interest).toLocaleString()} FCFA total. Terms shown upfront — no surprises.` };
  }

  private doLoanRepay(amount: number): ActionResult {
    const s = this.state;
    if (s.wallet.debt <= 0) return { ok: false, message: 'You have no debt. Well done.' };
    const pay = Math.min(amount, s.wallet.debt);
    if (!this.spend(s.wallet.bank >= pay ? 'bank' : s.wallet.cash >= pay ? 'cash' : 'momo', pay, 'debt', s.wallet.debtTo ?? 'Lender', 'Loan repayment')) {
      return { ok: false, message: 'Not enough money for that repayment.' };
    }
    s.wallet.debt -= pay;
    if (s.wallet.debt <= 0) {
      s.wallet.debt = 0;
      s.wallet.debtTo = null;
      this.toast('Debt cleared. A weight off your shoulders.', 'success');
    }
    return { ok: true, message: `Repaid ${pay.toLocaleString()} FCFA.` };
  }

  private doBuyCredit(amount: number, data: boolean): ActionResult {
    const s = this.state;
    if (amount <= 0) return { ok: false, message: 'Invalid amount.' };
    const wallet = s.wallet.cash >= amount ? 'cash' : 'momo';
    if (!this.spend(wallet, amount, 'phone_credit', data ? 'Data bundle' : 'Airtime', data ? 'Mobile data' : 'Airtime top-up')) {
      return { ok: false, message: 'Not enough money.' };
    }
    if (data) {
      s.phone.dataCreditMb += Math.round(amount / 5);
      return { ok: true, message: `Data bundle added: +${Math.round(amount / 5)} MB.` };
    }
    s.phone.airtimeFcfa += amount;
    return { ok: true, message: `Airtime added: +${amount.toLocaleString()} FCFA.` };
  }

  private doApplyJob(jobId: string): ActionResult {
    const s = this.state;
    const job = JOB_MAP[jobId];
    if (!job) return { ok: false, message: 'Unknown job.' };
    if (s.player.job) return { ok: false, message: 'You already have a job. Resign first if you want to switch — you can always change direction.' };
    const report = qualificationReport(s, jobId);
    if (!report.qualifies) {
      return { ok: false, message: `You do not qualify yet: ${report.missing.join(' ')}` };
    }
    const cdKey = `apply_${jobId}`;
    if (Number(s.storyFlags[cdKey] ?? 0) > 0 && s.world.day - Number(s.storyFlags[cdKey]) < 3) {
      return { ok: false, message: 'You applied recently. Give them a few days.' };
    }
    s.storyFlags[cdKey] = s.world.day;
    s.pendingEvents.push({
      templateId: `interview:${jobId}`,
      title: `Interview: ${job.title}`,
      titleFr: `Entretien : ${job.titleFr ?? job.title}`,
      body: `${job.employer} invites you for a short interview. You qualify: ${report.reasons.join(' ')}`,
      bodyFr: `${job.employer} t'invite à un court entretien.`,
      choices: [
        { id: 'prepared', label: 'Prepare seriously (outfit, research, arrive early)' },
        { id: 'casual', label: 'Go as you are and trust your mouth' },
        { id: 'honest', label: 'Be honest about your experience level' },
      ],
      kind: 'interview',
    });
    this.advanceMinutes(15, { decay: true, rollEvents: false });
    return { ok: true, message: 'Interview scheduled. Choose your approach.' };
  }

  private doWorkShift(jobId: string, minutes?: number): ActionResult {
    const s = this.state;
    const job = s.player.job;
    if (!job || job.jobId !== jobId) return { ok: false, message: 'You do not work there.' };
    const def = JOB_MAP[jobId];
    if (!def) return { ok: false, message: 'Unknown job.' };
    const overnight = def.shiftEnd > 1440;
    const start = def.shiftStart;
    const end = def.shiftEnd % 1440;
    const now = s.world.minute;
    const shiftLength = def.shiftEnd - def.shiftStart;
    let inWindow = false;
    if (overnight) {
      inWindow = now >= start - 45 || now <= end - 30;
    } else {
      inWindow = now >= start - 45 && now <= def.shiftEnd - 60;
    }
    if (!inWindow) {
      const sh = `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}`;
      return { ok: false, message: `Shift hours are ${sh}–${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}. Come back in time.` };
    }
    if (job.lastShiftDay === s.world.day) return { ok: false, message: 'You already worked a shift today. Rest — overtime is a choice, not a trap.' };

    const worked = Math.max(60, Math.min(minutes ?? shiftLength, shiftLength));
    const onTime = this.minutesUntil(now, start) <= 20;
    const qm = qualityModifier(s.player.needs);
    job.performance = clamp(job.performance + (onTime ? 3 : -2) + (qm.value >= 0 ? 2 : -4), 0, 100);
    job.reliability = clamp(job.reliability + (onTime ? 2 : -3), 0, 100);
    job.shiftsWorked += 1;
    job.shiftsThisWeek += 1;
    const consecutive = job.lastShiftDay === s.world.day - 1;
    s.stats.workStreak = consecutive ? s.stats.workStreak + 1 : 1;
    s.stats.bestWorkStreak = Math.max(s.stats.bestWorkStreak, s.stats.workStreak);
    job.lastShiftDay = s.world.day;
    const gainKey = def.skillGain?.key ?? def.requirements.skill?.key;
    let skillGain = 0;
    if (gainKey) {
      const cur = s.player.skills[gainKey];
      const base = def.skillGain?.gain ?? 0.5;
      skillGain = base * (worked / shiftLength) * Math.max(0.25, 1 - cur * 0.06);
      if (skillGain > 0.01) {
        s.player.skills[gainKey] = Math.round((cur + skillGain) * 10) / 10;
        this.pushLog(`Shift practice: ${gainKey} +${skillGain.toFixed(1)}.`);
      }
    }
    applyNeedEffects(s.player.needs, { energy: -(worked / 60) * 6.5, hygiene: -6, social: 4 });
    this.advanceMinutes(worked, { decay: true, rollEvents: true });

    let pay = 0;
    const festive = holidayForDay(s.world.day)?.wageMultiplier ?? 1;
    if (def.payCadence === 'shift' || def.payCadence === 'day') {
      const raise = Number(s.storyFlags[`raise_${jobId}`] ?? 1);
      const wageFactor = cityPolicyMultiplier(s, 'minimum_wage');
      pay = Math.round(def.pay * (worked / shiftLength) * raise * festive * wageFactor);
      if (worked >= shiftLength * 0.8) pay = Math.round(def.pay * raise * festive * wageFactor);
      this.giveIncome('cash', pay, 'wage', def.employer, `Shift (${Math.round(worked / 60)}h)${festive > 1 ? ' · holiday' : ''}`);
    }
    if (s.world.weather === 'rain') s.storyFlags['worked_in_rain'] = true;
    this.pushLog(`Worked ${Math.round(worked / 60)}h at ${def.employer}${pay > 0 ? ` (+${pay.toLocaleString()} FCFA)` : ''}.`);
    return {
      ok: true,
      message: pay > 0 ? `Shift done. You earned ${pay.toLocaleString()} FCFA.` : 'Shift done. Pay comes on the schedule.',
      toast: pay > 0 ? 'money' : 'info',
    };
  }

  private minutesUntil(now: number, target: number): number {
    const diff = target - now;
    return diff >= 0 ? diff : diff + 1440;
  }

  private doHomeBuy(itemId: string): ActionResult {
    const s = this.state;
    const def = FURNITURE_MAP[itemId];
    if (!def) return { ok: false, message: 'Unknown furniture.' };
    if (s.home.items.includes(itemId)) return { ok: false, message: 'You already own that piece.' };
    const wallet = s.wallet.cash >= def.price ? 'cash' : 'momo';
    if (!this.spend(wallet, def.price, 'home', 'Furniture seller', def.name)) {
      return { ok: false, message: `You need ${def.price.toLocaleString()} FCFA for the ${def.name}.` };
    }
    s.home.items.push(itemId);
    s.home.comfort += def.comfort;
    this.pushLog(`Bought ${def.name} for the room (+${def.comfort} comfort).`);
    return { ok: true, message: `${def.name} delivered. Comfort +${def.comfort}.`, toast: 'success' };
  }

  private doHomeSell(itemId: string): ActionResult {
    const s = this.state;
    const def = FURNITURE_MAP[itemId];
    if (!def || !s.home.items.includes(itemId)) return { ok: false, message: 'You do not own that.' };
    const resale = Math.round(def.price * 0.5);
    s.home.items = s.home.items.filter((id) => id !== itemId);
    s.home.comfort = Math.max(0, s.home.comfort - def.comfort);
    this.giveIncome('cash', resale, 'home', 'Second-hand buyer', `Sold ${def.name}`);
    this.pushLog(`Sold ${def.name} for ${resale.toLocaleString()} FCFA.`);
    return { ok: true, message: `Sold ${def.name} for ${resale.toLocaleString()} FCFA.`, toast: 'money' };
  }

  private doCityVote(candidateId: string): ActionResult {
    const s = this.state;
    ensureCityHall(s);
    const res = castPlayerVote(s, candidateId, CITY_PLAYER_VOTE_WEIGHT);
    if (!res.ok) return { ok: false, message: res.message };
    const candidate = s.city.candidates.find((c) => c.id === candidateId);
    this.pushLog(`Voted for ${candidate?.name ?? candidateId} at City Hall.`);
    return { ok: true, message: res.message, toast: 'success' };
  }

  private doCityRun(policy: CityPolicyId): ActionResult {
    const s = this.state;
    if (!isVotingOpen(s)) return { ok: false, message: 'You can only declare candidacy while voting is open.' };
    const res = declareCandidacy(s, policy, CITY_RUN_FEE);
    if (!res.ok) return { ok: false, message: res.message };
    this.pushLog(`Declared candidacy for City Hall (${policy}).`);
    return { ok: true, message: res.message, toast: 'success' };
  }

  private doCityCampaign(amount: number): ActionResult {
    const s = this.state;
    const spend = Math.round(amount / CITY_CAMPAIGN_UNIT) * CITY_CAMPAIGN_UNIT;
    if (spend < CITY_CAMPAIGN_UNIT || spend > CITY_CAMPAIGN_UNIT * 10) {
      return { ok: false, message: `Campaign spend must be between ${CITY_CAMPAIGN_UNIT.toLocaleString()} and ${(CITY_CAMPAIGN_UNIT * 10).toLocaleString()} FCFA.` };
    }
    const res = runCityCampaign(s, spend);
    if (!res.ok) return { ok: false, message: res.message };
    this.pushLog(`Campaign rally: ${spend.toLocaleString()} FCFA.`);
    return { ok: true, message: res.message, toast: 'money' };
  }

  private doResign(): ActionResult {
    const s = this.state;
    if (!s.player.job) return { ok: false, message: 'You have no job to resign from.' };
    const def = JOB_MAP[s.player.job.jobId];
    s.player.jobHistory.push(s.player.job.jobId);
    s.player.job = null;
    this.pushLog(`Resigned from ${def?.employer ?? 'the job'}.`);
    return { ok: true, message: `You left ${def?.employer ?? 'the job'} on good terms. New directions are allowed.` };
  }

  private doMotoRuns(trips: number): ActionResult {
    const s = this.state;
    if (s.player.skills.driving < 2) {
      return { ok: false, message: 'Driving skill 2 required. Take driving lessons first (look for the workshop in Mvan).' };
    }
    const rentalDay = Number(s.storyFlags['rental_paid_day'] ?? 0);
    const ownMoto = s.vehicles.find((v) => {
      const def = VEHICLE_MAP[v.modelId];
      return def?.kind === 'moto' && !v.fleetRiderId && v.condition >= 15 && v.fuel >= 2.2;
    });
    if (ownMoto) {
      const def = VEHICLE_MAP[ownMoto.modelId];
      ownMoto.fuel = Math.round((ownMoto.fuel - 2.2) * 100) / 100;
      ownMoto.condition = Math.max(0, Math.round((ownMoto.condition - 1.2) * 10) / 10);
      ownMoto.trips += trips;
      this.pushLog(`Used your own ${def.name} for ${trips} trips.`);
    } else if (rentalDay !== s.world.day) {
      if (!this.spend('cash', 5000, 'business_costs', 'Bike owner', 'Daily bike rental')) {
        return { ok: false, message: 'The bike rental is 5,000 FCFA for the day. Come back with the money.' };
      }
      s.storyFlags['rental_paid_day'] = s.world.day;
      this.pushLog('Paid bike rental (5,000 FCFA).');
    }
    let total = 0;
    let events = 0;
    for (let i = 0; i < trips; i++) {
      this.advanceMinutes(25, { decay: true, rollEvents: false });
      let fare = Math.round(420 + s.player.skills.driving * 55 + this.rng.range(-80, 190));
      if (s.world.weather === 'rain') fare = Math.round(fare * 1.15);
      if (s.world.strike) fare = Math.round(fare * 1.25);
      applyNeedEffects(s.player.needs, { energy: -3.5, hygiene: -2 });
      if (this.rng.chance(0.035)) {
        events++;
        if (this.rng.chance(0.4)) {
          const fine = 500;
          if (this.spend('cash', fine, 'fines', 'Checkpoint', 'Paperwork fee')) {
            this.pushLog('A checkpoint cost you time and a small paperwork fee.');
            fare -= fine;
          }
        } else {
          this.pushLog('A passenger changed destination mid-ride. Extra fare.');
          fare += 250;
        }
      }
      if (this.rng.chance(0.02)) {
        applyNeedEffects(s.player.needs, { health: -10, mood: -6 });
        const repair = 1500;
        this.spend(s.wallet.cash >= repair ? 'cash' : 'momo', repair, 'repairs', 'Mechanic', 'Moto repair after a fall');
        this.notifyApp('messages', 'Safety first', 'You fell at low speed — nothing serious, but the bike needed repairs. Helmets and caution are not optional.');
        fare -= repair;
      }
      total += Math.max(0, fare);
    }
    s.stats.gigsDone += trips;
    this.giveIncome('cash', total, 'transport', 'Passengers', `${trips} moto trips`);
    if (s.world.weather === 'rain') s.storyFlags['worked_in_rain'] = true;
    this.pushLog(`Ran ${trips} moto trips (+${total.toLocaleString()} FCFA).`);
    return { ok: true, message: `${trips} trips done. Earned ${total.toLocaleString()} FCFA${events > 0 ? ' (with some road events)' : ''}.`, toast: 'money' };
  }

  private doDeliveries(drops: number): ActionResult {
    const s = this.state;
    let total = 0;
    for (let i = 0; i < drops; i++) {
      this.advanceMinutes(22, { decay: true, rollEvents: false });
      const pay = Math.round(320 + s.player.skills.fitness * 15 + this.rng.range(-30, 90));
      total += pay;
      applyNeedEffects(s.player.needs, { energy: -4, hygiene: -2.5 });
      if (this.rng.chance(0.05)) {
        this.pushLog('A client was not at the address. The package went back — no pay for that one.');
        total -= pay;
      }
    }
    s.stats.gigsDone += drops;
    this.giveIncome('cash', total, 'gig', 'CityExpress', `${drops} deliveries`);
    return { ok: true, message: `${drops} deliveries done. Earned ${total.toLocaleString()} FCFA.`, toast: 'money' };
  }

  private doBusinessOpen(kind: string, name: string): ActionResult {
    const s = this.state;
    const def = BUSINESS_MAP[kind];
    if (!def) return { ok: false, message: 'Unknown business type.' };
    if (s.businesses.length >= 3) return { ok: false, message: 'Three businesses is the current focus limit. Manage these well first.' };
    if (!this.spend('cash', def.setupCost, 'business_setup', 'Suppliers', `Setup: ${name}`)) {
      return { ok: false, message: `Setup costs ${def.setupCost.toLocaleString()} FCFA. You need the capital first.` };
    }
    s.businesses.push({
      id: `biz_${Date.now().toString(36)}`,
      kind,
      name: name || def.name,
      district: s.player.district,
      rentPerDay: def.rentPerDay,
      priceLevel: 1.0,
      stock: {},
      stockQuality: 'ok',
      quality: 3,
      reputation: 40,
      customerSatisfaction: 60,
      hasGenerator: false,
      revenueToday: 0,
      costsToday: 0,
      arrears: 0,
      openToday: true,
      staffIds: [],
      staffInfo: {},
      marketing: null,
      pendingDeliveries: [],
      premises: 0,
      dayOpened: s.world.day,
    });
    this.milestone(`Business opened: ${name || def.name}`);
    this.notifyApp('business', 'Business open', `${name || def.name} is open in ${DISTRICT_MAP[s.player.district].name}. Buy stock, set prices, and watch demand.`);
    return { ok: true, message: 'Business opened. Source stock at the wholesale market, set your prices, and serve.' };
  }

  private doBusinessStock(businessId: string, itemId: string, qty: number, supplierId?: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    const def = BUSINESS_MAP[biz.kind];
    if (!def.stockItems.includes(itemId)) return { ok: false, message: 'Your business does not sell that.' };
    const supplier = SUPPLIER_MAP[supplierId ?? 'neighbourhood'] ?? SUPPLIER_MAP['neighbourhood'];
    if (qty < supplier.minQty) {
      return { ok: false, message: `${supplier.name} has a minimum order of ${supplier.minQty} units.` };
    }
    const unit = Math.round(districtPrice(s, biz.district, ITEM_MAP[itemId].wholesalePrice) * supplier.priceFactor);
    const cost = unit * qty;
    const wallet = s.wallet.cash >= cost ? 'cash' : 'momo';
    const shortDelivery = this.rng.next() > supplier.reliability;
    const deliveredQty = shortDelivery ? Math.max(1, Math.floor(qty * 0.75)) : qty;
    if (!this.spend(wallet, cost, 'stock', supplier.name, `${ITEM_MAP[itemId].name} x${deliveredQty}`)) {
      return { ok: false, message: `Stock costs ${cost.toLocaleString()} FCFA.` };
    }
    if (supplier.deliveryDays > 0) {
      biz.pendingDeliveries.push({ itemId, qty: deliveredQty, quality: supplier.quality, arrivesDay: s.world.day + supplier.deliveryDays });
      return {
        ok: true,
        message: `${supplier.name}: ${deliveredQty}x ${ITEM_MAP[itemId].name} ordered (${cost.toLocaleString()} FCFA), arriving day ${s.world.day + supplier.deliveryDays}.`,
        toast: 'money',
      };
    }
    biz.stock[itemId] = (biz.stock[itemId] ?? 0) + deliveredQty;
    biz.stockQuality = supplier.quality;
    if (shortDelivery) {
      return {
        ok: true,
        message: `${supplier.name} came up short: only ${deliveredQty}x ${ITEM_MAP[itemId].name} delivered for ${cost.toLocaleString()} FCFA.`,
        toast: 'info',
      };
    }
    return { ok: true, message: `Added ${deliveredQty}x ${ITEM_MAP[itemId].name} to stock (${cost.toLocaleString()} FCFA).`, toast: 'money' };
  }

  private doBusinessPrice(businessId: string, priceLevel: number): ActionResult {
    const biz = this.state.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    biz.priceLevel = Math.max(0.7, Math.min(1.4, priceLevel));
    return { ok: true, message: `Prices set to ${Math.round(biz.priceLevel * 100)}% of market rate.` };
  }

  private doBusinessHire(businessId: string, npcId: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    if (biz.staffIds.length >= 3) return { ok: false, message: 'Three employees is enough for now.' };
    if (biz.staffIds.includes(npcId)) return { ok: false, message: 'They already work for you.' };
    const npc = s.npcs[npcId];
    if (!npc) return { ok: false, message: 'That person is not available.' };
    if (npcRelationshipScore(s, npcId) < 25) {
      return { ok: false, message: 'You need a stronger relationship (respect and trust) before hiring someone. Build it first.' };
    }
    const signOn = 3000;
    if (!this.spend('cash', signOn, 'staff_wages', npc.name, 'Sign-on')) {
      return { ok: false, message: `Sign-on costs ${signOn.toLocaleString()} FCFA.` };
    }
    biz.staffIds.push(npcId);
    npc.jobId = businessId;
    applyRelationDelta(s, npcId, { trust: 5, memory: { kind: 'hired', note: 'You hired them' } });
    this.unlockAchievement('first_employee');
    this.notifyApp('business', 'Employee hired', `${npc.name} now works at ${biz.name}. Pay wages weekly (from business revenue) and they will stay motivated.`);
    return { ok: true, message: `${npc.name} joined your business. Treat them well — morale shows in the numbers.` };
  }

  private doBusinessFire(businessId: string, npcId: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    biz.staffIds = biz.staffIds.filter((id) => id !== npcId);
    delete biz.staffInfo[npcId];
    const npc = s.npcs[npcId];
    if (npc) {
      npc.jobId = undefined;
      applyRelationDelta(s, npcId, { trust: -20, affection: -10, memory: { kind: 'fired', note: 'You let them go' } });
    }
    s.reputation.perDistrict[biz.district] = (s.reputation.perDistrict[biz.district] ?? 0) - 2;
    return { ok: true, message: `${npc?.name ?? 'The employee'} was let go. They took it hard; the neighbourhood will hear about it.` };
  }

  private doBusinessToggle(businessId: string, open: boolean): ActionResult {
    const biz = this.state.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    biz.openToday = open;
    return { ok: true, message: open ? `${biz.name} will open today.` : `${biz.name} stays closed. Costs pause but customers drift away.` };
  }

  private doBusinessGenerator(businessId: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    if (biz.hasGenerator) return { ok: false, message: 'You already have a generator.' };
    const cost = 35000;
    if (!this.spend('cash', cost, 'business_setup', 'Generator dealer', 'Generator')) {
      return { ok: false, message: `A small generator costs ${cost.toLocaleString()} FCFA.` };
    }
    biz.hasGenerator = true;
    return { ok: true, message: 'Generator installed. Delestage will not kill your sales — fuel costs apply on outage days.' };
  }

  private doBusinessStaffBonus(businessId: string, npcId: string, amount: number): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    if (!biz.staffIds.includes(npcId)) return { ok: false, message: 'They do not work here.' };
    if (amount < 500) return { ok: false, message: 'A bonus under 500 FCFA is not meaningful.' };
    if (!this.spend('cash', amount, 'staff_wages', s.npcs[npcId]?.name ?? npcId, 'Staff bonus')) {
      return { ok: false, message: `A ${amount.toLocaleString()} FCFA bonus needs cash.` };
    }
    const info = biz.staffInfo[npcId] ?? { morale: 70, skill: 2 };
    info.morale = clamp(info.morale + Math.min(30, amount / 200));
    biz.staffInfo[npcId] = info;
    applyRelationDelta(s, npcId, { trust: 3, affection: 2, memory: { kind: 'gift', note: 'You gave them a work bonus' } });
    const npcName = s.npcs[npcId]?.name ?? 'Employee';
    this.notifyApp('business', 'Bonus paid', `${npcName} appreciated the ${amount.toLocaleString()} FCFA bonus. Morale is up.`);
    return { ok: true, message: `${npcName} appreciates it. Morale up (${Math.round(info.morale)}).`, toast: 'success' };
  }

  private doBusinessTrainStaff(businessId: string, npcId: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    if (!biz.staffIds.includes(npcId)) return { ok: false, message: 'They do not work here.' };
    const info = biz.staffInfo[npcId] ?? { morale: 70, skill: 2 };
    if (info.skill >= 5) return { ok: false, message: 'They are already fully trained for this work.' };
    if (!this.spend('cash', STAFF_TRAINING_COST, 'staff_wages', s.npcs[npcId]?.name ?? npcId, 'Training')) {
      return { ok: false, message: `Training costs ${STAFF_TRAINING_COST.toLocaleString()} FCFA.` };
    }
    info.skill = Math.min(5, info.skill + 1);
    info.morale = clamp(info.morale + 8);
    biz.staffInfo[npcId] = info;
    const npcName = s.npcs[npcId]?.name ?? 'Employee';
    return { ok: true, message: `${npcName} trained: skill ${info.skill}/5. They serve more customers now.`, toast: 'success' };
  }

  private doBusinessMarketing(businessId: string, campaignId: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    const campaign = MARKETING_CAMPAIGNS.find((c) => c.id === campaignId);
    if (!campaign) return { ok: false, message: 'Unknown campaign.' };
    if (campaign.id === 'social' && s.stats.socialPosts < campaign.minPosts) {
      return { ok: false, message: `Post at least ${campaign.minPosts} times on the social feed before running a social campaign.` };
    }
    if (campaign.cost > 0 && !this.spend('cash', campaign.cost, 'business_costs', campaign.name, `Marketing: ${biz.name}`)) {
      return { ok: false, message: `${campaign.name} costs ${campaign.cost.toLocaleString()} FCFA.` };
    }
    biz.marketing = { type: campaign.id, startDay: s.world.day, untilDay: s.world.day + campaign.days, boost: campaign.boost };
    if (campaign.id === 'social') {
      s.stats.socialPosts += 1;
      this.state.log.push({ day: s.world.day, minute: s.world.minute, text: `You posted about ${biz.name} on the social feed.` });
    }
    this.notifyApp('business', 'Campaign running', `${campaign.name} for ${biz.name}: demand boost for ${campaign.days} days.`);
    return { ok: true, message: `${campaign.name} booked. Demand boost for ${campaign.days} days.`, toast: 'success' };
  }

  private doReportContent(kind: 'event' | 'glossary' | 'item' | 'place' | 'npc' | 'other', refId: string, note: string): ActionResult {
    const s = this.state;
    const clean = note.trim().slice(0, 400);
    if (!clean) return { ok: false, message: 'Add a short note describing the issue.' };
    s.reports.push({
      id: `rep_${Date.now().toString(36)}_${Math.floor(this.rng.next() * 1e6).toString(36)}`,
      kind,
      refId,
      note: clean,
      day: s.world.day,
      minute: s.world.minute,
    });
    if (s.reports.length > 100) s.reports.shift();
    this.toast('Report saved. Thank you for helping keep local content accurate.', 'success');
    return { ok: true, message: 'Report saved for review.' };
  }

  private doBudgetSetPlan(category: string, amount: number): ActionResult {
    const s = this.state;
    if (!BUDGET_CATEGORIES.some((c) => c.id === category)) return { ok: false, message: 'Unknown budget category.' };
    const value = Math.max(0, Math.round(amount));
    if (value === 0) delete s.budget.planned[category];
    else s.budget.planned[category] = value;
    return { ok: true, message: `Weekly plan set: ${budgetCategoryLabel(category as BudgetCategoryId, s.settings.language === 'fr')} ${value.toLocaleString()} FCFA.` };
  }

  private doAddSavingsGoal(name: string, target: number): ActionResult {
    const s = this.state;
    const clean = name.trim().slice(0, 40);
    if (!clean) return { ok: false, message: 'Give the savings goal a name.' };
    const goalTarget = Math.round(target);
    if (goalTarget < 1000) return { ok: false, message: 'Set a target of at least 1,000 FCFA.' };
    if (s.budget.goals.length >= 5) return { ok: false, message: 'Five savings goals is the current limit.' };
    s.budget.goals.push({
      id: `goal_${Date.now().toString(36)}`,
      name: clean,
      target: goalTarget,
      saved: 0,
      createdAtDay: s.world.day,
      done: false,
    });
    return { ok: true, message: `Savings goal "${clean}" created.` };
  }

  private doSavingsGoalMove(goalId: string, amount: number, dir: 'deposit' | 'withdraw'): ActionResult {
    const s = this.state;
    const goal = s.budget.goals.find((g) => g.id === goalId);
    if (!goal) return { ok: false, message: 'Savings goal not found.' };
    const value = Math.round(amount);
    if (value <= 0) return { ok: false, message: 'Invalid amount.' };
    if (dir === 'deposit') {
      if (!this.spend('cash', value, 'savings', goal.name, `Saved toward ${goal.name}`)) {
        return { ok: false, message: 'Not enough cash for that deposit.' };
      }
      goal.saved += value;
      if (!goal.done && goal.saved >= goal.target) {
        goal.done = true;
        this.toast(`Savings goal reached: ${goal.name} (${goal.target.toLocaleString()} FCFA)!`, 'success');
        this.notifyApp('wallet', 'Savings goal reached', `You saved ${goal.target.toLocaleString()} FCFA for ${goal.name}. Time to use it on your plan.`);
        this.milestone(`Savings goal reached: ${goal.name}`);
      }
      return { ok: true, message: `Saved ${value.toLocaleString()} FCFA toward ${goal.name} (${goal.saved.toLocaleString()}/${goal.target.toLocaleString()}).`, toast: 'money' };
    }
    if (goal.saved < value) return { ok: false, message: 'The goal does not hold that much.' };
    goal.saved -= value;
    if (goal.saved < goal.target) goal.done = false;
    addIncome(s, 'cash', value, 'savings_withdraw', goal.name, `Withdrawn from ${goal.name}`);
    return { ok: true, message: `Withdrew ${value.toLocaleString()} FCFA from ${goal.name}.`, toast: 'money' };
  }

  private doDeleteSavingsGoal(goalId: string): ActionResult {
    const s = this.state;
    const goal = s.budget.goals.find((g) => g.id === goalId);
    if (!goal) return { ok: false, message: 'Savings goal not found.' };
    if (goal.saved > 0) {
      addIncome(s, 'cash', goal.saved, 'savings_withdraw', goal.name, `Closed goal: ${goal.name}`);
    }
    s.budget.goals = s.budget.goals.filter((g) => g.id !== goalId);
    return { ok: true, message: goal.saved > 0 ? `Goal closed and ${goal.saved.toLocaleString()} FCFA returned to cash.` : 'Goal removed.' };
  }

  private doExamRegister(trackId: string): ActionResult {
    const s = this.state;
    const track = EXAM_MAP[trackId];
    if (!track) return { ok: false, message: 'Unknown exam.' };
    if (s.storyFlags['exam_track']) return { ok: false, message: 'You are already registered for an exam. Sit it or wait for the result.' };
    if (!track.fromLevels.includes(s.player.education.level)) {
      return { ok: false, message: `${track.name} comes after ${track.fromLevels.join(' or ')}. Your level: ${s.player.education.level}.` };
    }
    const academics = Math.floor(s.player.skills.academics);
    if (academics < track.minAcademics) {
      return { ok: false, message: `Study more before registering: academics ${academics}/${track.minAcademics}. Try the library or a study group.` };
    }
    if (!this.spend('cash', track.fee, 'education', 'Exam board', `Fees: ${track.name}`)) {
      return { ok: false, message: `Registration costs ${track.fee.toLocaleString()} FCFA.` };
    }
    const examDay = s.world.day + track.prepDays;
    s.storyFlags['exam_track'] = track.id;
    s.storyFlags['exam_day'] = examDay;
    delete s.storyFlags['exam_result'];
    s.player.education.examReady = true;
    this.notifyApp('notes', `${track.name} registered`, `Exam on day ${examDay} at ${track.place}. Study, then travel there on the day. Missing it loses the fees.`);
    this.pushLog(`Registered for the ${track.name}. Exam day ${examDay} at ${track.place}.`);
    return { ok: true, message: `${track.name} registered. Exam day ${examDay} at ${track.place}.`, toast: 'info' };
  }

  private doExamTake(): ActionResult {
    const s = this.state;
    const trackId = String(s.storyFlags['exam_track'] ?? '');
    const track = EXAM_MAP[trackId];
    if (!track) return { ok: false, message: 'You are not registered for any exam.' };
    const examDay = Number(s.storyFlags['exam_day'] ?? 0);
    if (s.world.day !== examDay) {
      return { ok: false, message: s.world.day < examDay ? `The exam is on day ${examDay}. Prepare in the meantime.` : `The exam day passed. Register again for the next sitting.` };
    }
    if (s.player.district !== track.examDistrict) {
      return { ok: false, message: `The exam is at ${track.place}. Travel there first.` };
    }
    const academics = Math.floor(s.player.skills.academics);
    const score = academics + this.rng.int(0, 3);
    const passed = score >= track.passThreshold;
    s.player.education.examReady = false;
    delete s.storyFlags['exam_track'];
    delete s.storyFlags['exam_day'];
    s.storyFlags['exam_result'] = passed ? 'pass' : 'fail';
    s.storyFlags['exam_result_day'] = s.world.day;
    s.storyFlags['exam_result_track'] = track.id;
    this.advanceMinutes(240);
    if (passed) {
      s.player.education.level = track.toLevel;
      s.player.skills.academics = Math.min(10, s.player.skills.academics + 1);
      s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) + 2;
      this.milestone(`Exam passed: ${track.name}`);
      this.notifyApp('notes', `${track.name} passed!`, `New level: ${track.toLevel}. Check the Jobs app — new doors are open.`);
      this.pushLog(`Passed the ${track.name}. Level is now ${track.toLevel}.`);
      return { ok: true, message: `${track.name} passed! You are now ${track.toLevel}.`, toast: 'success' };
    }
    this.notifyApp('notes', `${track.name}: not this time`, `You scored ${score}/${track.passThreshold}. No shame — study more (library, study group) and register for the next sitting.`);
    this.pushLog(`Sat the ${track.name} and missed it (${score}/${track.passThreshold}).`);
    return { ok: true, message: `${track.name}: ${score}/${track.passThreshold}. Study more and retake it — nothing is lost forever.`, toast: 'info' };
  }

  private processHoliday() {
    const s = this.state;
    const holiday = holidayForDay(s.world.day);
    if (!holiday) {
      delete s.storyFlags['holiday_today'];
      return;
    }
    delete s.storyFlags['holiday_today'];
    s.storyFlags['holiday_today'] = holiday.id;
    s.storyFlags['holidays_seen'] = Number(s.storyFlags['holidays_seen'] ?? 0) + 1;
    this.notifyApp('notes', `${holiday.name}`, `${holiday.flavor} Holiday shifts pay x${holiday.wageMultiplier}.`);
    this.pushLog(`${holiday.name}. ${holiday.flavor}`);
    if (holiday.kind === 'national') {
      this.queueEvent('holiday_parade');
    } else {
      this.queueEvent('holiday_family_feast');
    }
  }

  private processExams() {
    const s = this.state;
    const trackId = String(s.storyFlags['exam_track'] ?? '');
    if (!trackId) return;
    const track = EXAM_MAP[trackId];
    const examDay = Number(s.storyFlags['exam_day'] ?? 0);
    if (!track || !examDay) return;
    if (s.world.day > examDay) {
      delete s.storyFlags['exam_track'];
      delete s.storyFlags['exam_day'];
      s.storyFlags['exam_result'] = 'missed';
      s.storyFlags['exam_result_day'] = s.world.day;
      s.storyFlags['exam_result_track'] = track.id;
      s.player.education.examReady = false;
      this.notifyApp('notes', `${track.name} missed`, `You did not sit the exam on day ${examDay}. The fee is lost — register again when you are ready.`);
      this.pushLog(`Missed the ${track.name} (exam day ${examDay}).`);
    } else if (examDay - s.world.day === 1) {
      this.notifyApp('notes', `${track.name} tomorrow`, `Exam tomorrow at ${track.place}. Sleep well and travel there early.`);
    } else if (examDay === s.world.day) {
      this.notifyApp('notes', `${track.name} today`, `Exam today at ${track.place}. Go there and take it from the Journal.`);
    }
  }

  private processStoryChains() {
    const s = this.state;
    const fr = s.settings.language === 'fr';
    for (const chain of STORY_CHAINS) {
      const key = `chain_${chain.id}_step`;
      let step = Number(s.storyFlags[key] ?? 0);
      while (step < chain.steps.length && chain.steps[step].check(s)) {
        step += 1;
        s.storyFlags[key] = step;
        if (step < chain.steps.length) {
          this.notifyApp('notes', fr ? `Histoire ${chain.id}` : `Story ${chain.id}`, `${fr ? chain.nameFr : chain.name}: ${fr ? chain.steps[step].textFr : chain.steps[step].text}`);
        }
      }
      if (step >= chain.steps.length && !s.storyFlags[`chain_${chain.id}_done`]) {
        s.storyFlags[`chain_${chain.id}_done`] = 1;
        this.milestone(`Story complete: ${fr ? chain.nameFr : chain.name}`);
        this.toast(`${fr ? 'Histoire terminée' : 'Story complete'}: ${fr ? chain.nameFr : chain.name}`, 'success');
      }
    }
  }

  private grantHobbyXp(activityId: string, baseXp: number) {
    const s = this.state;
    const hobby = hobbyXpForActivity(activityId);
    if (!hobby) return;
    const xpKey = hobby.id;
    const before = hobbyLevelFor(xpKey, Number(s.player.hobbies[xpKey] ?? 0));
    const gear = Boolean(s.storyFlags[`hobbygear_${xpKey}`]);
    const gained = baseXp * (gear ? 1.5 : 1);
    const nextXp = Math.round((Number(s.player.hobbies[xpKey] ?? 0) + gained) * 10) / 10;
    s.player.hobbies[xpKey] = nextXp;
    const after = hobbyLevelFor(xpKey, nextXp);
    if (after > before) {
      this.notifyApp(
        'notes',
        `${hobby.name} level ${after}`,
        after >= 2 ? `Your ${hobby.name.toLowerCase()} practice reached level ${after}. Competitions are open in the Journal.` : `Your ${hobby.name.toLowerCase()} practice reached level ${after}. Keep going.`,
      );
      this.toast(`${hobby.name}: level ${after}`, 'success');
    }
  }

  private doHobbyBuyGear(hobbyId: string): ActionResult {
    const s = this.state;
    const hobby = HOBBY_MAP[hobbyId];
    if (!hobby) return { ok: false, message: 'Unknown hobby.' };
    if (s.storyFlags[`hobbygear_${hobbyId}`]) return { ok: false, message: `You already own your ${hobby.gear.name.toLowerCase()}.` };
    if (!this.spend('cash', hobby.gear.cost, 'fun', hobby.gear.name, hobby.gear.name)) {
      return { ok: false, message: `${hobby.gear.name} costs ${hobby.gear.cost.toLocaleString()} FCFA.` };
    }
    s.storyFlags[`hobbygear_${hobbyId}`] = 1;
    this.pushLog(`Bought ${hobby.gear.name} for ${hobby.name} (+50% practice gain).`);
    return { ok: true, message: `${hobby.gear.name} bought. Practice gains are 50% faster.`, toast: 'success' };
  }

  private doHobbyCompete(hobbyId: string): ActionResult {
    const s = this.state;
    const hobby = HOBBY_MAP[hobbyId];
    if (!hobby) return { ok: false, message: 'Unknown hobby.' };
    const xp = Number(s.player.hobbies[hobbyId] ?? 0);
    const level = hobbyLevelFor(hobbyId, xp);
    if (level < 2) return { ok: false, message: `Competitions need ${hobby.name} level 2. Practice more first.` };
    const cdKey = `hobbycomp_${hobbyId}`;
    const last = Number(s.storyFlags[cdKey] ?? 0);
    if (last > 0 && s.world.day - last < hobby.competition.cooldownDays) {
      return { ok: false, message: 'You competed recently. Let the dust settle and train.' };
    }
    if (!this.spend('cash', hobby.competition.entryCost, 'fun', hobby.competition.name, 'Entry fee')) {
      return { ok: false, message: `Entry fee is ${hobby.competition.entryCost.toLocaleString()} FCFA.` };
    }
    s.storyFlags[cdKey] = s.world.day;
    this.advanceMinutes(hobby.competition.minutes, { decay: true, rollEvents: false });
    const score = level * 2 + this.rng.int(0, 3);
    const won = score >= 9;
    if (won) {
      const prize = hobby.competition.basePrize + level * 2000 + this.rng.int(0, 3000);
      this.giveIncome('cash', prize, 'gig', hobby.competition.name, `${hobby.name} prize`);
      s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) + 2;
      this.grantHobbyXp(hobby.activities[0], 6);
      this.pushLog(`Won ${hobby.competition.name} (${hobby.name}): ${prize.toLocaleString()} FCFA prize.`);
      s.storyFlags['hobbywin_count'] = Number(s.storyFlags['hobbywin_count'] ?? 0) + 1;
      if (Number(s.storyFlags['hobbywin_count']) === 1) this.milestone(`First competition win: ${hobby.competition.name}`);
      return { ok: true, message: `You won ${hobby.competition.name}! Prize: ${prize.toLocaleString()} FCFA (+2 district reputation).`, toast: 'success' };
    }
    applyNeedEffects(s.player.needs, { mood: -6, energy: -10 });
    this.grantHobbyXp(hobby.activities[0], 2);
    this.pushLog(`Competed in ${hobby.competition.name} (${hobby.name}) and did not place (${score}/9).`);
    return { ok: true, message: `Not this time (${score}/9). You still learned a lot — train and come back.`, toast: 'info' };
  }

  private doPropertyBuy(propertyId: string): ActionResult {
    const s = this.state;
    const def = PROPERTY_MAP[propertyId];
    if (!def) return { ok: false, message: 'Unknown property.' };
    if (s.player.properties.includes(propertyId)) return { ok: false, message: 'You already own this property.' };
    const balance = totalMoney(s.wallet);
    if (balance < def.price) {
      return { ok: false, message: `${def.name} costs ${def.price.toLocaleString()} FCFA. You have ${balance.toLocaleString()}. Keep saving — it pays rent every Sunday.` };
    }
    const w = s.wallet.cash >= def.price ? 'cash' : s.wallet.momo >= def.price ? 'momo' : 'bank';
    if (!this.spend(w, def.price, 'business_setup', 'Notary', `Purchase: ${def.name}`)) {
      return { ok: false, message: 'Payment failed.' };
    }
    s.player.properties.push(propertyId);
    this.milestone(`Property bought: ${def.name}`);
    this.notifyApp('notes', 'Property bought', `${def.name} is yours. Net rent of ${(def.weeklyRent - def.maintenance).toLocaleString()} FCFA arrives every Sunday.`);
    this.pushLog(`Bought ${def.name} for ${def.price.toLocaleString()} FCFA.`);
    return { ok: true, message: `${def.name} is yours. Net ${(def.weeklyRent - def.maintenance).toLocaleString()} FCFA/week, paid on Sundays.`, toast: 'success' };
  }

  private processRentalIncome() {
    const s = this.state;
    if (s.world.dayOfWeek !== 0) return;
    for (const id of s.player.properties) {
      const def = PROPERTY_MAP[id];
      if (!def) continue;
      const net = Math.max(0, def.weeklyRent - def.maintenance);
      if (net <= 0) continue;
      this.giveIncome('bank', net, 'property', def.name, 'Weekly rent');
    }
  }

  private doVehicleBuy(modelId: string): ActionResult {
    const s = this.state;
    const def = VEHICLE_MAP[modelId];
    if (!def) return { ok: false, message: 'Unknown vehicle model.' };
    if ((s.player.skills.driving ?? 0) < def.drivingRequirement) {
      return { ok: false, message: `Driving skill ${def.drivingRequirement} required for the ${def.name}. Take driving lessons first.` };
    }
    const balance = totalMoney(s.wallet);
    if (balance < def.price) {
      return { ok: false, message: `${def.name} costs ${def.price.toLocaleString()} FCFA. You have ${balance.toLocaleString()}. Keep saving.` };
    }
    const wallet = s.wallet.cash >= def.price ? 'cash' : s.wallet.momo >= def.price ? 'momo' : 'bank';
    if (!this.spend(wallet, def.price, 'transport', 'Vehicle dealer', `Purchase: ${def.name}`)) {
      return { ok: false, message: 'Payment failed.' };
    }
    const vehicle: VehicleState = {
      id: `veh_${modelId}_${Date.now().toString(36)}_${s.vehicles.length + 1}`,
      modelId,
      fuel: Math.round(def.tankLitres * 0.5 * 10) / 10,
      condition: 100,
      district: s.player.district,
      fleetRiderId: null,
      boughtDay: s.world.day,
      trips: 0,
    };
    s.vehicles.push(vehicle);
    this.refreshGoals();
    this.milestone(`Vehicle bought: ${def.name}`);
    this.notifyApp('garage', 'New vehicle', `${def.name} is in your garage with half a tank. Fill up before a long trip.`);
    this.pushLog(`Bought ${def.name} for ${def.price.toLocaleString()} FCFA.`);
    return { ok: true, message: `${def.name} is yours. Open the Garage app to refuel, repair or assign a rider.`, toast: 'success' };
  }

  private doVehicleSell(vehicleId: string): ActionResult {
    const s = this.state;
    const index = s.vehicles.findIndex((v) => v.id === vehicleId);
    if (index < 0) return { ok: false, message: 'Vehicle not found.' };
    const vehicle = s.vehicles[index];
    const def = VEHICLE_MAP[vehicle.modelId];
    if (!def) return { ok: false, message: 'Unknown vehicle.' };
    const value = vehicleResaleValue(def, vehicle.condition);
    s.vehicles.splice(index, 1);
    this.giveIncome('cash', value, 'transport', 'Vehicle buyer', `Sale: ${def.name}`);    const riderNote = vehicle.fleetRiderId ? ` ${FLEET_RIDER_MAP[vehicle.fleetRiderId]?.name ?? 'The rider'} returned the keys.` : '';
    this.pushLog(`Sold ${def.name} for ${value.toLocaleString()} FCFA.`);
    return { ok: true, message: `Sold ${def.name} for ${value.toLocaleString()} FCFA.${riderNote}`, toast: 'money' };
  }

  private doVehicleRefuel(vehicleId: string): ActionResult {
    const s = this.state;
    const vehicle = s.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return { ok: false, message: 'Vehicle not found.' };
    const def = VEHICLE_MAP[vehicle.modelId];
    if (!def) return { ok: false, message: 'Unknown vehicle.' };
    const missing = Math.round((def.tankLitres - vehicle.fuel) * 10) / 10;
    if (missing <= 0.05) return { ok: false, message: 'The tank is already full.' };
    const cost = Math.round(missing * s.world.fuelPrice);
    const wallet = s.wallet.cash >= cost ? 'cash' : s.wallet.momo >= cost ? 'momo' : 'bank';
    if (!this.spend(wallet, cost, 'transport', 'Fuel station', `${missing.toFixed(1)} L for ${def.name}`)) {
      return { ok: false, message: `Filling the tank costs ${cost.toLocaleString()} FCFA. You do not have it right now.` };
    }
    vehicle.fuel = def.tankLitres;
    this.pushLog(`Filled ${def.name} (${missing.toFixed(1)} L for ${cost.toLocaleString()} FCFA).`);
    return { ok: true, message: `Tank full: ${missing.toFixed(1)} L for ${cost.toLocaleString()} FCFA.`, toast: 'money' };
  }

  private doVehicleRepair(vehicleId: string): ActionResult {
    const s = this.state;
    const vehicle = s.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return { ok: false, message: 'Vehicle not found.' };
    const def = VEHICLE_MAP[vehicle.modelId];
    if (!def) return { ok: false, message: 'Unknown vehicle.' };
    if (vehicle.condition >= 99.5) return { ok: false, message: 'This vehicle is already in good condition.' };
    const cost = vehicleRepairCost(def, vehicle.condition);
    const wallet = s.wallet.cash >= cost ? 'cash' : s.wallet.momo >= cost ? 'momo' : 'bank';
    if (!this.spend(wallet, cost, 'repairs', 'Mechanic', `Repair: ${def.name}`)) {
      return { ok: false, message: `The mechanic wants ${cost.toLocaleString()} FCFA for the work.` };
    }
    vehicle.condition = 100;
    this.pushLog(`Repaired ${def.name} for ${cost.toLocaleString()} FCFA.`);
    return { ok: true, message: `${def.name} is back to 100% condition.`, toast: 'money' };
  }

  private doVehicleAssignRider(vehicleId: string, riderId: string | null): ActionResult {
    const s = this.state;
    const vehicle = s.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return { ok: false, message: 'Vehicle not found.' };
    const def = VEHICLE_MAP[vehicle.modelId];
    if (!def) return { ok: false, message: 'Unknown vehicle.' };
    if (riderId === null) {
      const previous = vehicle.fleetRiderId;
      vehicle.fleetRiderId = null;
      this.refreshGoals();
      return { ok: true, message: previous ? `${FLEET_RIDER_MAP[previous]?.name ?? 'The rider'} returned ${def.name}.` : 'No rider assigned.' };
    }
    if (def.kind !== 'moto') return { ok: false, message: 'Fleet riders only take motos. Cars are for personal use.' };
    const rider = FLEET_RIDER_MAP[riderId];
    if (!rider) return { ok: false, message: 'Unknown rider.' };
    const already = s.vehicles.find((v) => v.id !== vehicle.id && v.fleetRiderId === riderId);
    if (already) {
      const other = VEHICLE_MAP[already.modelId];
      return { ok: false, message: `${rider.name} already rides your ${other?.name ?? 'other moto'}. One rider, one bike.` };
    }
    if (vehicle.condition < 20) return { ok: false, message: `${def.name} is too run-down for a full day of passengers. Repair it first.` };
    vehicle.fleetRiderId = riderId;
    this.refreshGoals();
    const estimate = fleetEstimate(def, rider, vehicle.condition, s.world.fuelPrice);
    return {
      ok: true,
      message: `${rider.name} takes ${def.name}. Estimated net after cut, fuel and upkeep: ${estimate.net.toLocaleString()} FCFA/day.`,
      toast: 'success',
    };
  }

  private processFleetDay() {
    const s = this.state;
    for (const vehicle of s.vehicles) {
      if (!vehicle.fleetRiderId) continue;
      const def = VEHICLE_MAP[vehicle.modelId];
      const rider = FLEET_RIDER_MAP[vehicle.fleetRiderId];
      if (!def || !rider) {
        vehicle.fleetRiderId = null;
        continue;
      }
      if (vehicle.condition < 20) {
        this.notifyApp('garage', 'Fleet moto parked', `${def.name} is at ${Math.round(vehicle.condition)}% condition. ${rider.name} will not risk passengers on it. Repair it in the Garage app.`);
        continue;
      }
      if (this.rng.chance(1 - rider.reliability)) {
        vehicle.condition = Math.max(0, Math.round((vehicle.condition - 3) * 10) / 10);
        this.notifyApp('garage', 'Fleet rider trouble', `${rider.name} had a difficult day with ${def.name}: a breakdown, a checkpoint, or an empty cash box. No income today.`);
        this.pushLog(`Fleet: no income from ${def.name} today (${rider.name}).`);
        continue;
      }
      const estimate = fleetEstimate(def, rider, vehicle.condition, s.world.fuelPrice);
      vehicle.condition = Math.max(0, Math.round((vehicle.condition - def.fleetWearPerDay) * 10) / 10);
      if (estimate.net > 0) {
        this.giveIncome('cash', estimate.net, 'fleet', rider.name, `${def.name} daily route`);
      }
      this.pushLog(`Fleet: ${def.name} earned ${estimate.net.toLocaleString()} FCFA net with ${rider.name}.`);
    }
  }

  private doBusinessPremisesUpgrade(businessId: string): ActionResult {
    const s = this.state;
    const biz = s.businesses.find((b) => b.id === businessId);
    if (!biz) return { ok: false, message: 'Business not found.' };
    const next = premisesLevelDef(biz.premises + 1);
    if (!next) return { ok: false, message: 'Your premises are already top tier for this round.' };
    if (!this.spend('cash', next.cost, 'business_setup', 'Premises', `${next.name}: ${biz.name}`)) {
      return { ok: false, message: `${next.name} costs ${next.cost.toLocaleString()} FCFA.` };
    }
    biz.premises = next.level;
    biz.rentPerDay += next.rentPerDay;
    this.milestone(`${biz.name} upgraded to ${next.name}`);
    this.notifyApp('business', 'Premises upgraded', `${biz.name} now trades from a ${next.name}. More foot traffic (+${Math.round((next.demandFactor - 1) * 100)}% demand), rent up ${next.rentPerDay.toLocaleString()} FCFA/day.`);
    this.pushLog(`Upgraded ${biz.name} to ${next.name}.`);
    return { ok: true, message: `${next.name} secured. Demand +${Math.round((next.demandFactor - 1) * 100)}%, daily rent +${next.rentPerDay.toLocaleString()} FCFA.`, toast: 'success' };
  }

  private doNjangiJoin(groupId: string, turn: 'early' | 'middle' | 'late'): ActionResult {
    const s = this.state;
    if (s.njangi.membership && s.njangi.membership.status === 'active') {
      return { ok: false, message: 'You are already in a njangi group. One group at a time keeps the books clean.' };
    }
    const group = s.njangi.groups.find((g) => g.id === groupId);
    if (!group || group.status !== 'active') return { ok: false, message: 'That group is not open.' };
    const totalMembers = group.members.length + 1;
    if (totalMembers > group.maxMembers) return { ok: false, message: 'That group is full.' };
    const contribution = group.contribution;
    if (group.joinFee > 0 && !this.spend('cash', group.joinFee, 'njangi', group.name, 'Join fee')) {
      return { ok: false, message: `Join fee is ${group.joinFee.toLocaleString()} FCFA.` };
    }
    let turnOrder: number;
    if (turn === 'early') turnOrder = this.rng.int(1, 2);
    else if (turn === 'middle') turnOrder = this.rng.int(3, 4);
    else turnOrder = this.rng.int(5, Math.max(5, totalMembers));
    s.njangi.membership = {
      groupId,
      contribution,
      cadenceDays: 7,
      turnOrder,
      nextSittingDay: s.world.day + 7,
      cyclesPaid: 0,
      cyclesReceived: 0,
      missed: 0,
      status: 'active',
    };
    this.advanceTutorial('talked');
    this.pushLog(`Joined ${group.name}. Contribution ${contribution.toLocaleString()} FCFA weekly, position ${turnOrder}.`);
    return {
      ok: true,
      message: `You joined ${group.name}. Position ${turnOrder} of ${totalMembers}. First contribution due day ${s.world.day + 7}. ${turn === 'early' ? 'Early pot: cash sooner, less buffer if someone defaults.' : turn === 'late' ? 'Late pot: you see the group behave first — safer.' : 'Middle ground: balanced risk.'}`,
    };
  }

  private doNjangiContribute(): ActionResult {
    const s = this.state;
    const m = s.njangi.membership;
    if (!m || m.status !== 'active') return { ok: false, message: 'You are not in an active njangi.' };
    const group = s.njangi.groups.find((g) => g.id === m.groupId);
    if (!group) return { ok: false, message: 'Group not found.' };
    const balance = totalMoney(s.wallet);
    if (balance < m.contribution) {
      return { ok: false, message: `You need ${m.contribution.toLocaleString()} FCFA for the contribution. Recovery options: gigs, sell items, or talk to the group.` };
    }
    const w = s.wallet.cash >= m.contribution ? 'cash' : s.wallet.momo >= m.contribution ? 'momo' : 'bank';
    if (!this.spend(w, m.contribution, 'njangi', group.name, 'Contribution (prepaid)')) {
      return { ok: false, message: 'Payment failed.' };
    }
    this.pushLog('Prepaid njangi contribution.');
    return { ok: true, message: 'Contribution paid in advance. Reliable members get better opportunities.' };
  }

  private doNjangiMiss(resolve: 'cover' | 'default'): ActionResult {
    const s = this.state;
    const m = s.njangi.membership;
    if (!m || m.status !== 'active') return { ok: false, message: 'No active njangi.' };
    const group = s.njangi.groups.find((g) => g.id === m.groupId);
    if (!group) return { ok: false, message: 'Group not found.' };
    const penalty = Math.round(m.contribution * 0.1);
    if (resolve === 'cover') {
      const total = m.contribution + penalty;
      const balance = totalMoney(s.wallet);
      if (balance < total) {
        return { ok: false, message: `Covering late needs ${total.toLocaleString()} FCFA (contribution + 10% penalty).` };
      }
      const w = s.wallet.cash >= total ? 'cash' : s.wallet.momo >= total ? 'momo' : 'bank';
      this.spend(w, total, 'njangi', group.name, 'Late contribution penalty');
      m.missed = Math.max(0, m.missed - 1);
      for (const memberId of group.members) {
        applyRelationDelta(s, memberId, { trust: -2, memory: { kind: 'promise_kept', note: 'Covered a late contribution' } });
      }
      return { ok: true, message: `Late contribution covered with a ${penalty.toLocaleString()} FCFA penalty. Your record is partially restored.` };
    }
    m.status = 'left';
    for (const memberId of group.members) {
      applyRelationDelta(s, memberId, { trust: -12, affection: -5, memory: { kind: 'promise_broken', note: 'You left the njangi after missing a contribution' } });
    }
    s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) - 3;
    this.notifyApp('messages', 'Njangi word travels', 'Leaving a njangi after missing a contribution closes some doors. Reputation is rebuilt slowly — but it can be rebuilt.');
    return { ok: true, message: 'You left the njangi. Some doors close; the city is full of other opportunities.' };
  }

  private doNjangiLeave(): ActionResult {
    const s = this.state;
    const m = s.njangi.membership;
    if (!m) return { ok: false, message: 'No njangi membership.' };
    if (m.cyclesPaid > 0 && m.cyclesReceived === 0) {
      return { ok: false, message: 'You have contributed but not received yet. Leaving now would forfeit what you paid — and the group would remember. Talk to the organizer instead.' };
    }
    m.status = 'left';
    s.njangi.membership = null;
    return { ok: true, message: 'You left the njangi in good standing.' };
  }

  private doEventChoice(eventIndex: number, choiceId: string): ActionResult {
    const s = this.state;
    const event = s.pendingEvents[eventIndex];
    if (!event) return { ok: false, message: 'Event not found.' };
    s.pendingEvents.splice(eventIndex, 1);

    if (event.templateId.startsWith('interview:')) {
      return this.resolveInterview(event.templateId.slice('interview:'.length), choiceId);
    }

    const tpl = EVENT_MAP[event.templateId];
    if (!tpl) return { ok: true };
    const outcome = tpl.outcomes[choiceId];
    if (!outcome) return { ok: true };
    applyNeedEffects(s.player.needs, outcome.needs);
    if (outcome.money) {
      if (outcome.money > 0) {
        this.giveIncome('cash', outcome.money, 'event', tpl.title, 'Event outcome');
      } else {
        const amount = -outcome.money;
        const paid = this.spend(s.wallet.cash >= amount ? 'cash' : s.wallet.momo >= amount ? 'momo' : 'bank', amount, 'event', tpl.title, 'Event cost');
        if (!paid) {
          s.wallet.debt += amount;
          s.wallet.debtTo = s.wallet.debtTo ?? 'A friend (event loan)';
          this.pushLog(`You borrowed ${amount.toLocaleString()} FCFA to cover an event cost.`);
        }
      }
    }
    if (outcome.skill) {
      const cur = s.player.skills[outcome.skill.key];
      s.player.skills[outcome.skill.key] = Math.round((cur + outcome.skill.gain * Math.max(0.3, 1 - cur * 0.06)) * 10) / 10;
    }
    if (outcome.reputation) {
      s.reputation.perDistrict[s.player.district] = (s.reputation.perDistrict[s.player.district] ?? 0) + outcome.reputation;
    }
    if (outcome.npcTrust && event.npcId) {
      applyRelationDelta(s, event.npcId, { trust: outcome.npcTrust, memory: { kind: outcome.npcTrust >= 0 ? 'helped' : 'refused', note: tpl.title } });
    }
    if (outcome.storyFlag) {
      s.storyFlags[outcome.storyFlag] = true;
    }
    s.stats.eventsAttended += 1;
    this.pushLog(outcome.text);
    this.toast(outcome.text, outcome.money && outcome.money > 0 ? 'money' : 'info', outcome.textFr);
    return { ok: true, message: outcome.text };
  }

  private resolveInterview(jobId: string, answer: string): ActionResult {
    const s = this.state;
    const job = JOB_MAP[jobId];
    if (!job) return { ok: false, message: 'Job not found.' };
    const charisma = s.player.skills.charisma ?? 0;
    let chance = answer === 'prepared' ? 0.82 : answer === 'honest' ? 0.68 : 0.5;
    chance += Math.min(0.12, charisma * 0.03);
    if (s.storyFlags[`referral_${jobId}`]) chance += 0.15;
    if (answer === 'prepared') this.advanceMinutes(120, { decay: true, rollEvents: false });
    else if (answer === 'honest') this.advanceMinutes(60, { decay: true, rollEvents: false });
    const hired = this.rng.chance(Math.min(0.95, chance));
    if (hired) {
      s.player.job = {
        jobId,
        hiredDay: s.world.day,
        performance: 55,
        reliability: answer === 'prepared' ? 65 : 55,
        shiftsWorked: 0,
        shiftsMissed: 0,
        shiftsThisWeek: 0,
        lastShiftDay: 0,
      };
      s.player.jobHistory.push(jobId);
      this.milestone(`Hired: ${job.title}`);
      this.notifyApp('jobs', 'You got the job', `${job.employer} hired you as ${job.title}. Shift hours: ${Math.floor(job.shiftStart / 60)}h–${Math.floor((job.shiftEnd % 1440) / 60)}h.`);
      this.addMessage(jobId === 'shop_assistant_nlongkak' ? 'manager_njoya' : 'mama_ada', `Welcome. First shift starts ${Math.floor(job.shiftStart / 60)}:00. Do not make me chase you.`, 'job');
      return { ok: true, message: `You got the job at ${job.employer}! Pay: ${job.pay.toLocaleString()} FCFA/${job.payCadence}.`, toast: 'success' };
    }
    this.notifyApp('jobs', 'Interview result', `${job.employer} chose another candidate this time (${Math.round((1 - chance) * 100)}% odds were against you). Reapply in a few days or build the missing skill.`);
    return {
      ok: true,
      message: `Not this time — ${job.employer} picked someone else. The result was never hidden: prepare more, improve skills, or try another door.`,
    };
  }

  private doMessageSend(npcId: string, text: string, replyId?: string): ActionResult {
    const s = this.state;
    const npc = s.npcs[npcId];
    if (!npc) return { ok: false, message: 'Unknown contact.' };
    s.messages.unshift({
      id: `m_${Date.now().toString(36)}`,
      npcId, day: s.world.day, minute: Math.floor(s.world.minute),
      from: 'player', text, read: true, kind: 'chat',
    });
    const todayReplyKey = `msgrep_${npcId}_${s.world.day}`;
    const firstToday = !s.storyFlags[todayReplyKey];
    if (firstToday) {
      s.storyFlags[todayReplyKey] = true;
      applyRelationDelta(s, npcId, { affection: 1 });
    }
    const replies = [
      'Ok, I hear you. We talk later.',
      'That is good. Keep pushing.',
      'Noted. The city is moving today.',
      replyId === 'invite' ? 'Come by this evening, I will be around.' : 'I will check and get back to you.',
    ];
    this.advanceMinutes(3, { decay: true, rollEvents: false });
    this.addMessage(npcId, this.rng.pick(replies), 'chat');
    return { ok: true };
  }

  private doSocialPost(text: string): ActionResult {
    const s = this.state;
    if (s.phone.dataCreditMb < 10) {
      return { ok: false, message: 'No data left. Buy a data bundle in the Wallet app.' };
    }
    s.phone.dataCreditMb -= 10;
    const followers = Number(s.storyFlags['followers'] ?? 20);
    const gain = this.rng.int(2, 9) + Math.floor(followers / 25);
    s.storyFlags['followers'] = followers + gain;
    applyNeedEffects(s.player.needs, { mood: 4 });
    s.stats.socialPosts += 1;
    s.socialFeed.unshift({
      id: `post_${Date.now().toString(36)}_${this.rng.int(1000, 9999)}`,
      authorId: 'player',
      authorName: s.player.name,
      text: text.slice(0, 280),
      day: s.world.day,
      minute: Math.floor(s.world.minute),
      likes: this.rng.int(0, 3),
      likedByPlayer: false,
    });
    if (s.socialFeed.length > 40) s.socialFeed.length = 40;
    this.pushLog(`Posted to the feed. +${gain} followers.`);
    return { ok: true, message: `Posted. +${gain} followers.`, toast: 'success' };
  }

  private doSocialLike(postId: string): ActionResult {
    const s = this.state;
    const post = s.socialFeed.find((p) => p.id === postId);
    if (!post) return { ok: false, message: 'That post is gone.' };
    post.likedByPlayer = !post.likedByPlayer;
    post.likes = Math.max(0, post.likes + (post.likedByPlayer ? 1 : -1));
    applyNeedEffects(s.player.needs, { mood: post.likedByPlayer ? 1 : 0 });
    if (post.likedByPlayer && post.authorId !== 'player' && s.relationships[post.authorId]) {
      applyRelationDelta(s, post.authorId, { affection: 0.5 });
    }
    return { ok: true, message: post.likedByPlayer ? 'Liked.' : 'Like removed.' };
  }

  private processSocialFeedDay(): void {
    const s = this.state;
    if (this.rng.chance(0.55)) return;
    const used = new Set(s.socialFeed.filter((p) => p.day === s.world.day).map((p) => p.authorId));
    const options = FEED_TEMPLATES.filter((t) => !used.has(t.authorId));
    if (options.length === 0) return;
    const t = this.rng.pick(options);
    s.socialFeed.unshift({
      id: `post_${Date.now().toString(36)}_${this.rng.int(1000, 9999)}`,
      authorId: t.authorId,
      authorName: t.authorName,
      text: t.text,
      textFr: t.textFr,
      day: s.world.day,
      minute: this.rng.int(6 * 60, 21 * 60),
      likes: this.rng.int(0, 12),
      likedByPlayer: false,
    });
    if (s.socialFeed.length > 40) s.socialFeed.length = 40;
  }

  private doPhoto(landmarkId?: string): ActionResult {
    const s = this.state;
    s.stats.photosTaken += 1;
    applyNeedEffects(s.player.needs, { mood: 3 });
    if (landmarkId) {
      s.storyFlags[`photo_${landmarkId}`] = true;
    }
    this.grantHobbyXp('photo_walk', 2);
    return { ok: true, message: 'Photo saved to your gallery.' };
  }

  private doHousingUpgrade(stage: number): ActionResult {
    const s = this.state;
    const current = Number(s.storyFlags['housing_stage'] ?? 1);
    if (stage <= current) return { ok: false, message: 'You already have this or better.' };
    const costs: Record<number, { deposit: number; rent: number; name: string }> = {
      2: { deposit: 25000, rent: 25000, name: 'your own studio' },
      3: { deposit: 60000, rent: 45000, name: 'an independent apartment' },
      4: { deposit: 1500000, rent: 0, name: 'a home of your own' },
    };
    const target = costs[stage];
    if (!target) return { ok: false, message: 'That stage comes later in the roadmap.' };
    const balance = totalMoney(s.wallet);
    if (balance < target.deposit) {
      return { ok: false, message: `Deposit is ${target.deposit.toLocaleString()} FCFA. You have ${balance.toLocaleString()}. Keep saving — or take a microfinance loan and read the terms first.` };
    }
    const w = s.wallet.cash >= target.deposit ? 'cash' : s.wallet.momo >= target.deposit ? 'momo' : 'bank';
    if (!this.spend(w, target.deposit, 'rent', 'Landlord', `Deposit for ${target.name}`)) {
      return { ok: false, message: 'Payment failed.' };
    }
    s.storyFlags['housing_stage'] = stage;
    s.storyFlags['rent'] = target.rent;
    if (stage === 4) s.storyFlags['housing_owned'] = 1;
    this.milestone(`Moved into ${target.name}!`);
    if (stage === 4) {
      this.notifyApp('notes', 'Homeowner', 'You bought your own home. Rent is gone from your budget — the achievement is real.');
      return { ok: true, message: 'You own your home now. No more rent, ever.', toast: 'success' };
    }
    this.notifyApp('notes', 'New home', `You moved into ${target.name}. Rent is now ${target.rent.toLocaleString()} FCFA/month, due day ${s.storyFlags['rentDueDay']}.`);
    return { ok: true, message: `Welcome to ${target.name}. Rent: ${target.rent.toLocaleString()} FCFA/month.`, toast: 'success' };
  }

  private doPayArrears(): ActionResult {
    const s = this.state;
    let total = 0;
    for (const biz of s.businesses) total += biz.arrears;
    if (total <= 0) return { ok: false, message: 'No arrears to pay.' };
    const w = s.wallet.cash >= total ? 'cash' : s.wallet.momo >= total ? 'momo' : 'bank';
    if (totalMoney(s.wallet) < total) return { ok: false, message: `You need ${total.toLocaleString()} FCFA to clear business arrears.` };
    this.spend(w, total, 'business_costs', 'Landlord (business)', 'Arrears cleared');
    for (const biz of s.businesses) biz.arrears = 0;
    return { ok: true, message: 'Business arrears cleared. Reputation recovering.' };
  }
}

function outageImpact(_minute: number, _outage: { start: number; end: number }): number {
  return 0.55;
}
