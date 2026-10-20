import type { GameState, LedgerEntry } from './types';

export const BUDGET_CATEGORIES = [
  { id: 'food', label: 'Food', labelFr: 'Nourriture' },
  { id: 'transport', label: 'Transport', labelFr: 'Transport' },
  { id: 'housing', label: 'Rent & bills', labelFr: 'Loyer & factures' },
  { id: 'phone', label: 'Phone & data', labelFr: 'Téléphone & data' },
  { id: 'fun', label: 'Going out', labelFr: 'Sorties' },
  { id: 'business', label: 'Business', labelFr: 'Commerce' },
  { id: 'savings', label: 'Savings', labelFr: 'Épargne' },
  { id: 'other', label: 'Other', labelFr: 'Autre' },
] as const;

export type BudgetCategoryId = (typeof BUDGET_CATEGORIES)[number]['id'];

const CATEGORY_MAP: Record<string, BudgetCategoryId> = {
  food: 'food',
  groceries: 'food',
  transport: 'transport',
  taxi: 'transport',
  moto: 'transport',
  airtime: 'phone',
  data: 'phone',
  phone: 'phone',
  utilities: 'housing',
  rent: 'housing',
  housing: 'housing',
  entertainment: 'fun',
  activities: 'fun',
  fun: 'fun',
  stock: 'business',
  business_costs: 'business',
  business_setup: 'business',
  staff_wages: 'business',
  business_revenue: 'business',
  savings: 'savings',
  savings_withdraw: 'savings',
};

export function budgetCategoryFor(ledgerCategory: string): BudgetCategoryId {
  return CATEGORY_MAP[ledgerCategory] ?? 'other';
}

export interface CategoryTotals {
  income: number;
  expense: number;
}

export function ledgerTotals(ledger: LedgerEntry[], sinceDay: number, untilDay: number): Record<BudgetCategoryId, CategoryTotals> {
  const totals = Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.id, { income: 0, expense: 0 }])) as Record<BudgetCategoryId, CategoryTotals>;
  for (const entry of ledger) {
    if (entry.day < sinceDay || entry.day > untilDay) continue;
    const bucket = budgetCategoryFor(entry.category);
    if (entry.amount >= 0) totals[bucket].income += entry.amount;
    else totals[bucket].expense += -entry.amount;
  }
  return totals;
}

export interface WeeklyBudgetView {
  sinceDay: number;
  untilDay: number;
  income: number;
  expense: number;
  plannedTotal: number;
  byCategory: Record<BudgetCategoryId, CategoryTotals & { planned: number }>;
  biggestExpense: BudgetCategoryId | null;
}

export function weeklyBudgetView(state: GameState, windowDays = 7): WeeklyBudgetView {
  const untilDay = state.world.day;
  const sinceDay = Math.max(1, untilDay - windowDays + 1);
  const totals = ledgerTotals(state.ledger, sinceDay, untilDay);
  const byCategory = Object.fromEntries(
    BUDGET_CATEGORIES.map((c) => [c.id, { ...totals[c.id], planned: state.budget?.planned?.[c.id] ?? 0 }]),
  ) as WeeklyBudgetView['byCategory'];
  let income = 0;
  let expense = 0;
  let plannedTotal = 0;
  let biggestExpense: BudgetCategoryId | null = null;
  let biggestAmount = 0;
  for (const c of BUDGET_CATEGORIES) {
    income += byCategory[c.id].income;
    expense += byCategory[c.id].expense;
    plannedTotal += byCategory[c.id].planned;
    if (byCategory[c.id].expense > biggestAmount) {
      biggestAmount = byCategory[c.id].expense;
      biggestExpense = c.id;
    }
  }
  return { sinceDay, untilDay, income, expense, plannedTotal, byCategory, biggestExpense };
}

export function budgetCategoryLabel(id: BudgetCategoryId, fr: boolean): string {
  const cat = BUDGET_CATEGORIES.find((c) => c.id === id);
  if (!cat) return id;
  return fr ? cat.labelFr : cat.label;
}
