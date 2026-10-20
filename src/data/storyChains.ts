import type { GameState } from '../sim/types';

export interface StoryChainStep {
  id: string;
  text: string;
  textFr: string;
  check: (s: GameState) => boolean;
}

export interface StoryChainDef {
  id: string;
  name: string;
  nameFr: string;
  steps: StoryChainStep[];
}

function metCount(s: GameState): number {
  return Object.values(s.relationships).filter((r) => r.stage !== 'stranger').length;
}

function stockTotal(s: GameState): number {
  return s.businesses.reduce((sum, b) => sum + Object.values(b.stock).reduce((a, q) => a + q, 0), 0);
}

function hasBusinessIncome(s: GameState): boolean {
  return s.ledger.some((l) => l.category === 'business_revenue' && l.amount > 0);
}

export const STORY_CHAINS: StoryChainDef[] = [
  {
    id: 'A',
    name: 'First days in Yaounde',
    nameFr: 'Premiers jours à Yaoundé',
    steps: [
      { id: 'phone', text: 'Open your phone and read the Journal', textFr: 'Ouvre ton téléphone et lis le Journal', check: (s) => Number(s.storyFlags['tutorialStep'] ?? 0) >= 1 },
      { id: 'eat', text: 'Eat something from a vendor', textFr: 'Mange chez un vendeur', check: (s) => Number(s.storyFlags['tutorialStep'] ?? 0) >= 2 },
      { id: 'travel', text: 'Travel to another quartier', textFr: 'Voyage vers un autre quartier', check: (s) => s.learnedRoutes.length > 1 || s.travelLog.length > 0 },
      { id: 'earn', text: 'Earn your first francs', textFr: 'Gagne tes premiers francs', check: (s) => s.ledger.some((l) => l.amount > 0) || s.stats.gigsDone > 0 },
    ],
  },
  {
    id: 'B',
    name: 'First job, first client',
    nameFr: 'Premier emploi, premier client',
    steps: [
      { id: 'first', text: 'Get hired or finish a gig', textFr: 'Trouve un emploi ou finis une mission', check: (s) => Boolean(s.player.job) || s.stats.gigsDone >= 1 },
      { id: 'paid', text: 'Get paid for five shifts or three gigs', textFr: 'Sois payé pour cinq services ou trois missions', check: (s) => (s.player.job?.shiftsWorked ?? 0) >= 5 || s.stats.gigsDone >= 3 },
    ],
  },
  {
    id: 'C',
    name: 'The neighbourhood connection',
    nameFr: 'Les liens du quartier',
    steps: [
      { id: 'meet3', text: 'Get to know three people', textFr: 'Fais la connaissance de trois personnes', check: (s) => metCount(s) >= 3 },
      { id: 'meet5', text: 'Grow your circle to five people', textFr: 'Élargis ton cercle à cinq personnes', check: (s) => metCount(s) >= 5 },
    ],
  },
  {
    id: 'D',
    name: 'The small business choice',
    nameFr: 'Le petit commerce',
    steps: [
      { id: 'open', text: 'Open a small business', textFr: 'Ouvre un petit commerce', check: (s) => s.businesses.length >= 1 },
      { id: 'stock', text: 'Stock it to sell', textFr: 'Approvisionne-le pour vendre', check: (s) => stockTotal(s) > 0 },
      { id: 'sell', text: 'Make your first sale', textFr: 'Fais ta première vente', check: (s) => hasBusinessIncome(s) },
    ],
  },
  {
    id: 'E',
    name: 'The city event',
    nameFr: "L'événement de la ville",
    steps: [
      { id: 'attend', text: 'Show up at a city event or gathering', textFr: 'Participe à un événement de la ville', check: (s) => s.stats.eventsAttended >= 1 },
    ],
  },
  {
    id: 'F',
    name: 'The njangi invitation',
    nameFr: 'L’invitation au njangi',
    steps: [
      { id: 'join', text: 'Join a njangi group', textFr: 'Rejoins un groupe de njangi', check: (s) => Boolean(s.njangi.membership) },
      { id: 'sitting', text: 'Complete a contributing cycle', textFr: 'Termine un cycle de cotisation', check: (s) => (s.njangi.membership?.cyclesPaid ?? 0) >= 1 },
    ],
  },
  {
    id: 'G',
    name: 'The long week of power cuts',
    nameFr: 'La semaine des coupures',
    steps: [
      { id: 'first', text: 'Live through a delestage day', textFr: 'Vis une journée de délestage', check: (s) => Number(s.storyFlags['outage_days_seen'] ?? 0) >= 1 },
      { id: 'week', text: 'Get through three outage days', textFr: 'Traverse trois jours de coupure', check: (s) => Number(s.storyFlags['outage_days_seen'] ?? 0) >= 3 },
    ],
  },
  {
    id: 'H',
    name: 'The Concours season',
    nameFr: 'La saison des concours',
    steps: [
      { id: 'register', text: 'Register for a school exam', textFr: 'Inscris-toi à un examen', check: (s) => Boolean(s.storyFlags['exam_track']) || Boolean(s.storyFlags['exam_result']) },
      { id: 'pass', text: 'Pass it', textFr: 'Réussis-le', check: (s) => s.storyFlags['exam_result'] === 'pass' },
    ],
  },
];
