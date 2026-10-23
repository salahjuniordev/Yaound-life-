import type { VehicleKind } from '../sim/types';

export interface VehicleDef {
  id: string;
  name: string;
  nameFr: string;
  kind: VehicleKind;
  price: number;
  tankLitres: number;
  fuelPerDistance: number;
  speed: number;
  baseRisk: number;
  wearPerTrip: number;
  fleetWearPerDay: number;
  dailyUpkeep: number;
  fleetDailyGross: number;
  fleetDailyFuelLitres: number;
  drivingRequirement: number;
  resaleRate: number;
  description: string;
  descriptionFr: string;
}

export const VEHICLES: VehicleDef[] = [
  {
    id: 'moto_jiancheng',
    name: 'Jiancheng moto (used)',
    nameFr: 'Moto Jiancheng (occasion)',
    kind: 'moto',
    price: 480000,
    tankLitres: 12,
    fuelPerDistance: 0.0025,
    speed: 52,
    baseRisk: 0.035,
    wearPerTrip: 0.45,
    fleetWearPerDay: 0.5,
    dailyUpkeep: 500,
    fleetDailyGross: 14000,
    fleetDailyFuelLitres: 3.2,
    drivingRequirement: 1,
    resaleRate: 0.55,
    description: 'A reliable bend-skin workhorse. Cheap to run, honest to repair, risky in the rain.',
    descriptionFr: 'Un bend-skin fiable. Pas cher à entretenir, honnête à réparer, risqué sous la pluie.',
  },
  {
    id: 'moto_haojiang',
    name: 'Haojue moto (new)',
    nameFr: 'Moto Haojue (neuve)',
    kind: 'moto',
    price: 980000,
    tankLitres: 14,
    fuelPerDistance: 0.0022,
    speed: 58,
    baseRisk: 0.025,
    wearPerTrip: 0.35,
    fleetWearPerDay: 0.35,
    dailyUpkeep: 750,
    fleetDailyGross: 18000,
    fleetDailyFuelLitres: 3,
    drivingRequirement: 2,
    resaleRate: 0.6,
    description: 'Newer engine, better brakes, fewer roadside surprises. Still a moto in Yaounde traffic.',
    descriptionFr: 'Moteur plus récent, meilleurs freins, moins de surprises. Reste une moto dans le trafic de Yaoundé.',
  },
  {
    id: 'car_corolla',
    name: 'Toyota Corolla (1998)',
    nameFr: 'Toyota Corolla (1998)',
    kind: 'car',
    price: 2800000,
    tankLitres: 45,
    fuelPerDistance: 0.0075,
    speed: 72,
    baseRisk: 0.012,
    wearPerTrip: 0.3,
    fleetWearPerDay: 0.3,
    dailyUpkeep: 2500,
    fleetDailyGross: 0,
    fleetDailyFuelLitres: 0,
    drivingRequirement: 3,
    resaleRate: 0.6,
    description: 'The classic survivor. Rain protection, boot space, and a mechanic who knows it by name.',
    descriptionFr: 'La survivante classique. À l’abri de la pluie, du coffre, et un mécanicien qui la connaît par cœur.',
  },
  {
    id: 'car_hilux',
    name: 'Toyota Hilux pickup',
    nameFr: 'Toyota Hilux pickup',
    kind: 'car',
    price: 7200000,
    tankLitres: 65,
    fuelPerDistance: 0.011,
    speed: 76,
    baseRisk: 0.009,
    wearPerTrip: 0.22,
    fleetWearPerDay: 0.25,
    dailyUpkeep: 4800,
    fleetDailyGross: 0,
    fleetDailyFuelLitres: 0,
    drivingRequirement: 5,
    resaleRate: 0.65,
    description: 'Rough-road status symbol. Expensive to feed, impossible to ignore at a checkpoint.',
    descriptionFr: 'Le symbole du statut sur les routes abîmées. Chère à nourrir, impossible à ignorer à un contrôle.',
  },
];

export const VEHICLE_MAP: Record<string, VehicleDef> = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

export interface FleetRiderDef {
  id: string;
  name: string;
  nameFr: string;
  reliability: number;
  cutRate: number;
  description: string;
  descriptionFr: string;
}

export const FLEET_RIDERS: FleetRiderDef[] = [
  {
    id: 'brandon',
    name: 'Brandon',
    nameFr: 'Brandon',
    reliability: 0.86,
    cutRate: 0.3,
    description: 'Knows every shortcut but takes chances. Honest with the books.',
    descriptionFr: 'Connaît tous les raccourcis mais prend des risques. Honnête avec les comptes.',
  },
  {
    id: 'michel',
    name: 'Michel',
    nameFr: 'Michel',
    reliability: 0.93,
    cutRate: 0.33,
    description: 'Steady, punctual, keeps the bike clean. Charges a serious cut.',
    descriptionFr: 'Régulier, ponctuel, garde la moto propre. Prend une part sérieuse.',
  },
  {
    id: 'david_hustler',
    name: 'David',
    nameFr: 'David',
    reliability: 0.72,
    cutRate: 0.22,
    description: 'Cheap cut, fast money, unpredictable days. Count the cash yourself.',
    descriptionFr: 'Part réduite, argent rapide, journées imprévisibles. Compte la caisse toi-même.',
  },
];

export const FLEET_RIDER_MAP: Record<string, FleetRiderDef> = Object.fromEntries(FLEET_RIDERS.map((r) => [r.id, r]));

export function vehicleRepairCost(def: VehicleDef, condition: number): number {
  const missing = Math.max(0, 100 - condition);
  return Math.max(1000, Math.round(def.price * 0.0006 * missing));
}

export function vehicleResaleValue(def: VehicleDef, condition: number): number {
  return Math.round(def.price * def.resaleRate * (0.35 + 0.65 * (condition / 100)));
}

export function fleetEstimate(def: VehicleDef, rider: FleetRiderDef, condition: number, fuelPrice: number): { gross: number; riderCut: number; fuel: number; upkeep: number; net: number } {
  const conditionFactor = 0.55 + 0.45 * (Math.max(0, Math.min(100, condition)) / 100);
  const gross = Math.round(def.fleetDailyGross * rider.reliability * conditionFactor);
  const riderCut = Math.round(gross * rider.cutRate);
  const fuel = Math.round(def.fleetDailyFuelLitres * fuelPrice);
  const upkeep = def.dailyUpkeep;
  return { gross, riderCut, fuel, upkeep, net: Math.max(0, gross - riderCut - fuel - upkeep) };
}
