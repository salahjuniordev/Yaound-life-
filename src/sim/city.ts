import { CITY_CANDIDATES, CITY_ELECTION_INTERVAL, CITY_POLICY_MAP, CITY_VOTING_WINDOW } from '../data/cityHall';
import type { CityCandidate, CityElectionResult, CityHallState, CityPolicyId, GameState } from './types';
import type { RNG } from './rng';

export function buildCandidates(cycle: number, player?: { name: string; policy: CityPolicyId }): CityCandidate[] {
  const drift = (cycle - 1) % 5;
  const list: CityCandidate[] = CITY_CANDIDATES.map((c, i) => ({
    ...c,
    popularity: Math.max(20, Math.min(80, c.popularity + ((i + drift) % 3) - 1)),
  }));
  if (player) {
    list.push({
      id: 'player',
      npcId: 'player',
      name: player.name,
      nameFr: player.name,
      role: 'Independent',
      roleFr: 'Indépendant',
      slogan: 'A neighbour, not a slogan.',
      sloganFr: 'Un voisin, pas un slogan.',
      policy: player.policy,
      popularity: 22,
      player: true,
    });
  }
  return list;
}

export function createCityHallState(day = 1): CityHallState {
  const cycle = Math.max(1, Math.ceil(day / CITY_ELECTION_INTERVAL));
  const electionDay = cycle * CITY_ELECTION_INTERVAL;
  return {
    cycle,
    electionDay,
    votingOpenDay: Math.max(day, electionDay - CITY_VOTING_WINDOW),
    candidates: buildCandidates(cycle),
    votes: {},
    playerVotes: 0,
    votedCandidateId: null,
    votedDay: null,
    playerRunning: false,
    playerPolicy: null,
    campaignSpend: 0,
    policy: null,
    policyUntilDay: 0,
    approval: 52,
    lastResult: null,
  };
}

export function ensureCityHall(state: GameState): CityHallState {
  if (!state.city) state.city = createCityHallState(state.world.day);
  return state.city;
}

export function activeCityPolicy(state: GameState): CityPolicyId | null {
  const city = state.city;
  if (!city?.policy) return null;
  if (city.policyUntilDay > 0 && state.world.day > city.policyUntilDay) return null;
  return city.policy;
}

export function cityPolicyMultiplier(state: GameState, policy: CityPolicyId): number {
  if (activeCityPolicy(state) !== policy) return 1;
  switch (policy) {
    case 'transport_subsidy':
      return 0.75;
    case 'minimum_wage':
      return 1.12;
    case 'food_discount':
      return 0.85;
    case 'power_deal':
      return 0.5;
    case 'fun_boost':
      return 1;
  }
}

export function cityFunMoodBonus(state: GameState): number {
  return activeCityPolicy(state) === 'fun_boost' ? 6 : 0;
}

export function isVotingOpen(state: GameState): boolean {
  const city = ensureCityHall(state);
  return state.world.day >= city.votingOpenDay && state.world.day < city.electionDay;
}

export function cityPolicyLabel(state: GameState, fr: boolean): string {
  const policy = activeCityPolicy(state);
  if (!policy) return '';
  const def = CITY_POLICY_MAP[policy];
  return fr ? def.nameFr : def.name;
}

export function syncCityFlags(state: GameState): void {
  const city = ensureCityHall(state);
  state.storyFlags['city_policy_label'] = cityPolicyLabel(state, state.settings.language === 'fr');
  state.storyFlags['city_election_day'] = city.electionDay;
  state.storyFlags['city_voted'] = city.votedCandidateId ? 1 : 0;
  state.storyFlags['is_mayor'] = city.lastResult?.winnerId === 'player' && city.policyUntilDay >= state.world.day ? 1 : 0;
}

export function castPlayerVote(state: GameState, candidateId: string, weight: number): { ok: boolean; message: string } {
  const city = ensureCityHall(state);
  if (!isVotingOpen(state)) return { ok: false, message: 'Voting is not open right now.' };
  if (city.votedCandidateId) return { ok: false, message: 'You already voted this cycle.' };
  const candidate = city.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, message: 'That candidate is not on the ballot.' };
  city.votes[candidateId] = (city.votes[candidateId] ?? 0) + weight;
  city.playerVotes = weight;
  city.votedCandidateId = candidateId;
  city.votedDay = state.world.day;
  syncCityFlags(state);
  return { ok: true, message: `You voted for ${candidate.name}.` };
}

export function addNpcVotes(state: GameState, rng: RNG): void {
  const city = ensureCityHall(state);
  for (const candidate of city.candidates) {
    if (candidate.id === 'player' && !city.playerRunning) continue;
    const base = Math.max(1, candidate.popularity / 12);
    const votes = Math.max(1, Math.round(base * rng.range(0.45, 1.6)));
    city.votes[candidate.id] = (city.votes[candidate.id] ?? 0) + votes;
  }
}

export function resolveCityElection(state: GameState, rng: RNG): CityElectionResult {
  const city = ensureCityHall(state);
  if (Object.keys(city.votes).length === 0) {
    for (const c of city.candidates) city.votes[c.id] = Math.max(1, Math.round(c.popularity / 8 + rng.range(0, 3)));
  }
  const ranked = [...city.candidates].sort((a, b) => {
    const diff = (city.votes[b.id] ?? 0) - (city.votes[a.id] ?? 0);
    if (diff !== 0) return diff;
    if (b.popularity !== a.popularity) return b.popularity - a.popularity;
    return a.id.localeCompare(b.id);
  });
  const winner = ranked[0];
  city.policy = winner.policy;
  city.policyUntilDay = city.electionDay + CITY_ELECTION_INTERVAL;
  city.approval = Math.max(35, Math.min(80, Math.round(48 + winner.popularity / 4)));
  const result: CityElectionResult = {
    day: state.world.day,
    winnerId: winner.id,
    winnerName: winner.name,
    winnerNameFr: winner.nameFr,
    policy: winner.policy,
    playerVote: city.votedCandidateId,
    playerWon: winner.id === 'player',
    votes: { ...city.votes },
  };
  city.lastResult = result;
  syncCityFlags(state);
  return result;
}

export function startNextCityCycle(state: GameState): void {
  const city = ensureCityHall(state);
  city.cycle += 1;
  city.electionDay += CITY_ELECTION_INTERVAL;
  city.votingOpenDay = city.electionDay - CITY_VOTING_WINDOW;
  city.candidates = buildCandidates(city.cycle);
  city.votes = {};
  city.playerVotes = 0;
  city.votedCandidateId = null;
  city.votedDay = null;
  city.playerRunning = false;
  city.playerPolicy = null;
  city.campaignSpend = 0;
  syncCityFlags(state);
}

export function processCityHallDay(state: GameState, rng: RNG): CityElectionResult | null {
  const city = ensureCityHall(state);
  let result: CityElectionResult | null = null;
  let guard = 0;
  while (state.world.day >= city.electionDay && guard < 8) {
    guard += 1;
    result = resolveCityElection(state, rng);
    startNextCityCycle(state);
  }
  if (!result && state.world.day >= city.votingOpenDay) {
    addNpcVotes(state, rng);
  }
  syncCityFlags(state);
  return result;
}

export function declareCandidacy(state: GameState, policy: CityPolicyId, fee: number): { ok: boolean; message: string } {
  const city = ensureCityHall(state);
  if (!isVotingOpen(state)) return { ok: false, message: 'You can only declare while voting is open.' };
  if (city.playerRunning) return { ok: false, message: 'You are already on the ballot this cycle.' };
  if (state.wallet.cash + state.wallet.momo < fee) return { ok: false, message: `You need ${fee.toLocaleString()} FCFA for the deposit.` };
  const wallet = state.wallet.cash >= fee ? 'cash' : 'momo';
  state.wallet[wallet] -= fee;
  state.ledger.unshift({
    id: `l_${Date.now().toString(36)}`,
    day: state.world.day,
    minute: state.world.minute,
    kind: 'expense',
    category: 'civic',
    amount: fee,
    counterparty: 'City Hall',
    note: 'Candidacy deposit',
    wallet,
    balanceAfter: state.wallet[wallet],
  });
  city.playerRunning = true;
  city.playerPolicy = policy;
  city.campaignSpend = 0;
  city.candidates = buildCandidates(city.cycle, { name: state.player.name, policy });
  city.votes.player = city.votes.player ?? 0;
  syncCityFlags(state);
  return { ok: true, message: `You are on the ballot for ${CITY_POLICY_MAP[policy].name}.` };
}

export function runCityCampaign(state: GameState, amount: number): { ok: boolean; message: string } {
  const city = ensureCityHall(state);
  if (!city.playerRunning) return { ok: false, message: 'Declare your candidacy first.' };
  if (!isVotingOpen(state)) return { ok: false, message: 'Campaigning is closed.' };
  if (state.wallet.cash + state.wallet.momo < amount) return { ok: false, message: `You need ${amount.toLocaleString()} FCFA.` };
  const wallet = state.wallet.cash >= amount ? 'cash' : 'momo';
  state.wallet[wallet] -= amount;
  state.ledger.unshift({
    id: `l_${Date.now().toString(36)}`,
    day: state.world.day,
    minute: state.world.minute,
    kind: 'expense',
    category: 'civic',
    amount,
    counterparty: 'Campaign team',
    note: 'Campaign rally',
    wallet,
    balanceAfter: state.wallet[wallet],
  });
  city.campaignSpend += amount;
  const player = city.candidates.find((c) => c.id === 'player');
  if (player) player.popularity = Math.min(90, player.popularity + Math.max(1, Math.round(amount / 2500)));
  city.approval = Math.min(80, city.approval + 1);
  syncCityFlags(state);
  return { ok: true, message: `Rally held. Your popularity is now ${player?.popularity ?? 0}.` };
}
