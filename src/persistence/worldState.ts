import { DISTRICT_MAP } from '../data/districts';
import type { DistrictId, SharedWorldState } from '../sim/types';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asHeadlines(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const headlines = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
  return headlines.length > 0 ? headlines : undefined;
}

function parseOutages(value: unknown): SharedWorldState['outages'] | undefined {
  const raw = asRecord(value);
  if (!raw) return undefined;
  const outages: NonNullable<SharedWorldState['outages']> = {};
  for (const [district, entry] of Object.entries(raw)) {
    if (!DISTRICT_MAP[district as DistrictId]) continue;
    const outage = asRecord(entry);
    const start = asNumber(outage?.start);
    const end = asNumber(outage?.end);
    if (start === undefined || end === undefined) continue;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start < 0 || start >= 1440 || end <= start || end > 2880) continue;
    outages[district as DistrictId] = { start, end };
  }
  return outages;
}

function parseStrike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  const strike = asRecord(value);
  return typeof strike?.active === 'boolean' ? strike.active : undefined;
}

export function parseSharedWorldState(value: unknown): SharedWorldState | null {
  const row = asRecord(value);
  if (!row) return null;
  const gameDay = asNumber(row.game_day);
  if (gameDay === undefined || !Number.isInteger(gameDay) || gameDay < 1) return null;

  const weather =
    row.weather === 'sun' || row.weather === 'cloud' || row.weather === 'rain' ? row.weather : undefined;
  const rawFuel = asNumber(row.fuel_price);
  const fuelPrice = rawFuel === undefined ? undefined : Math.round(rawFuel);
  const strike = parseStrike(row.strike);
  const outages = parseOutages(row.delestage);
  const events = asRecord(row.events);
  const headlines = asHeadlines(events?.headlines);
  const headlinesFr = asHeadlines(events?.headlinesFr);

  const state: SharedWorldState = { gameDay };
  if (weather) state.weather = weather;
  if (fuelPrice !== undefined) state.fuelPrice = fuelPrice;
  if (strike !== undefined) state.strike = strike;
  if (outages !== undefined) state.outages = outages;
  if (headlines) state.headlines = headlines;
  if (headlinesFr) state.headlinesFr = headlinesFr;
  return state;
}
