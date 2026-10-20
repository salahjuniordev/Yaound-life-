import type { GameState, LedgerEntry, WalletState } from './types';
import { DISTRICT_MAP } from '../data/districts';

let ledgerCounter = 0;

export function makeLedgerId(): string {
  ledgerCounter++;
  return `tx_${Date.now().toString(36)}_${ledgerCounter.toString(36)}`;
}

export interface TransactionInput {
  kind: LedgerEntry['kind'];
  category: string;
  amount: number;
  counterparty: string;
  note: string;
  wallet: 'cash' | 'momo' | 'bank' | 'debt';
}

export function applyTransaction(state: GameState, tx: TransactionInput): { ok: boolean; reason?: string; balanceAfter: number } {
  const w = state.wallet;
  const amount = Math.round(tx.amount);
  if (amount < 0) return { ok: false, reason: 'invalid_amount', balanceAfter: w[tx.wallet] };

  if (tx.wallet === 'debt') {
    w.debt += amount;
    pushLedger(state, tx, w.debt);
    return { ok: true, balanceAfter: w.debt };
  }

  if (w[tx.wallet] < amount) {
    return { ok: false, reason: 'insufficient_funds', balanceAfter: w[tx.wallet] };
  }
  w[tx.wallet] -= amount;
  if (tx.kind === 'income') {
    state.stats.totalEarned += amount;
  } else {
    state.stats.totalSpent += amount;
  }
  pushLedger(state, tx, w[tx.wallet]);
  return { ok: true, balanceAfter: w[tx.wallet] };
}

function pushLedger(state: GameState, tx: TransactionInput, balanceAfter: number) {
  state.ledger.unshift({
    id: makeLedgerId(),
    day: state.world.day,
    minute: state.world.minute,
    kind: tx.kind,
    category: tx.category,
    amount: tx.amount,
    counterparty: tx.counterparty,
    note: tx.note,
    wallet: tx.wallet,
    balanceAfter,
  });
  if (state.ledger.length > 300) state.ledger.length = 300;
}

export function addIncome(state: GameState, wallet: 'cash' | 'momo' | 'bank', amount: number, category: string, counterparty: string, note: string) {
  const w = state.wallet;
  const amt = Math.round(amount);
  w[wallet] += amt;
  state.stats.totalEarned += amt;
  pushLedger(state, { kind: 'income', category, amount: amt, counterparty, note, wallet }, w[wallet]);
}

export function spendMoney(state: GameState, wallet: 'cash' | 'momo' | 'bank', amount: number, category: string, counterparty: string, note: string): { ok: boolean; reason?: string } {
  const res = applyTransaction(state, { kind: 'expense', category, amount, counterparty, note, wallet });
  if (!res.ok) {
    const fallback = fallbackWallet(state, amount, wallet);
    if (fallback) {
      const res2 = applyTransaction(state, { kind: 'expense', category, amount, counterparty, note, wallet: fallback });
      return res2.ok ? { ok: true } : { ok: false, reason: 'insufficient_funds' };
    }
    return { ok: false, reason: res.reason };
  }
  return { ok: true };
}

export function fallbackWallet(state: GameState, amount: number, avoid: 'cash' | 'momo' | 'bank'): 'cash' | 'momo' | 'bank' | null {
  const order: ('cash' | 'momo' | 'bank')[] = ['cash', 'momo', 'bank'];
  for (const w of order) {
    if (w !== avoid && state.wallet[w] >= amount && (w !== 'momo' || state.wallet.momo >= amount)) {
      return w;
    }
  }
  return null;
}

export function totalMoney(w: WalletState): number {
  return w.cash + w.momo + w.bank;
}

export function districtPrice(state: GameState, district: string, base: number): number {
  const zone = DISTRICT_MAP[district as keyof typeof DISTRICT_MAP];
  const mult = zone ? zone.priceMultiplier : 1;
  const inflation = 1 + Math.floor(state.world.day / 30) * 0.01;
  return Math.round(base * mult * inflation);
}

export function momoFee(amount: number): number {
  return Math.max(50, Math.round(amount * 0.01));
}

export function fuelCostForDistance(districtA: string, districtB: string): number {
  const a = DISTRICT_MAP[districtA as keyof typeof DISTRICT_MAP];
  const b = DISTRICT_MAP[districtB as keyof typeof DISTRICT_MAP];
  if (!a || !b) return 250;
  const dx = a.center[0] - b.center[0];
  const dz = a.center[1] - b.center[1];
  const dist = Math.sqrt(dx * dx + dz * dz);
  return Math.round(150 + dist * 2.2);
}
