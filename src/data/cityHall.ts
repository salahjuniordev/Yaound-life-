import type { CityCandidateSeed, CityPolicyId } from '../sim/types';

export interface CityPolicyDef {
  id: CityPolicyId;
  name: string;
  nameFr: string;
  blurb: string;
  blurbFr: string;
  effect: string;
  effectFr: string;
  accent: string;
}

export const CITY_POLICIES: CityPolicyDef[] = [
  {
    id: 'transport_subsidy',
    name: 'Cheaper rides',
    nameFr: 'Transport moins cher',
    blurb: 'Subsidise taxi and moto fares so the quartier keeps moving.',
    blurbFr: 'Subventionner taxis et motos pour que le quartier continue de bouger.',
    effect: 'Taxi and moto fares -25%.',
    effectFr: 'Tarifs taxi et moto -25 %.',
    accent: '#f0a23a',
  },
  {
    id: 'minimum_wage',
    name: 'Fair pay',
    nameFr: 'Salaire juste',
    blurb: 'Push employers to pay a liveable wage for every shift.',
    blurbFr: 'Pousser les employeurs à payer correctement chaque service.',
    effect: 'Shift pay +12%.',
    effectFr: 'Paie des services +12 %.',
    accent: '#3e8050',
  },
  {
    id: 'food_discount',
    name: 'Full plates',
    nameFr: 'Assiettes pleines',
    blurb: 'Cut market and food prices so no one sleeps hungry.',
    blurbFr: 'Baisser les prix du marché et de la nourriture.',
    effect: 'Food and market prices -15%.',
    effectFr: 'Prix nourriture et marché -15 %.',
    accent: '#d9694a',
  },
  {
    id: 'fun_boost',
    name: 'City that plays',
    nameFr: 'Ville qui respire',
    blurb: 'Fund music, football and culture across the seven hills.',
    blurbFr: 'Financer musique, foot et culture sur les sept collines.',
    effect: 'Fun activities lift mood more.',
    effectFr: 'Les loisirs remontent davantage le moral.',
    accent: '#7b61c9',
  },
  {
    id: 'power_deal',
    name: 'Lights on',
    nameFr: 'La lumière',
    blurb: 'Renegotiate with ENEO and shield small businesses from délestage.',
    blurbFr: 'Renégocier avec ENEO et protéger les petits commerces du délestage.',
    effect: 'Half as many power outages.',
    effectFr: 'Deux fois moins de délestages.',
    accent: '#2f6f8f',
  },
];

export const CITY_POLICY_MAP = Object.fromEntries(CITY_POLICIES.map((p) => [p.id, p])) as Record<CityPolicyId, CityPolicyDef>;

export const CITY_CANDIDATES: CityCandidateSeed[] = [
  {
    id: 'brandon',
    npcId: 'brandon',
    name: 'Brandon',
    nameFr: 'Brandon',
    role: 'Moto union',
    roleFr: 'Syndicat moto',
    slogan: 'Cheaper rides, fewer potholes.',
    sloganFr: 'Trajets moins chers, moins de nids-de-poule.',
    policy: 'transport_subsidy',
    popularity: 46,
  },
  {
    id: 'manager_njoya',
    npcId: 'manager_njoya',
    name: 'Manager Njoya',
    nameFr: 'Manager Njoya',
    role: 'Small business',
    roleFr: 'Petit commerce',
    slogan: 'A fair day of work, a fair day of pay.',
    sloganFr: 'Un jour de travail, un jour de paie juste.',
    policy: 'minimum_wage',
    popularity: 42,
  },
  {
    id: 'sister_grace',
    npcId: 'sister_grace',
    name: 'Sister Grace',
    nameFr: 'Sœur Grace',
    role: 'Community clinic',
    roleFr: 'Clinique de quartier',
    slogan: 'No pot empty at sunset.',
    sloganFr: 'Aucune marmite vide au coucher du soleil.',
    policy: 'food_discount',
    popularity: 54,
  },
  {
    id: 'papa_ngassa',
    npcId: 'papa_ngassa',
    name: 'Papa Ngassa',
    nameFr: 'Papa Ngassa',
    role: 'Market elders',
    roleFr: 'Anciens du marché',
    slogan: 'Keep the lights on, keep the stalls open.',
    sloganFr: 'La lumière allumée, les étals ouverts.',
    policy: 'power_deal',
    popularity: 39,
  },
  {
    id: 'sandra',
    npcId: 'sandra',
    name: 'Sandra',
    nameFr: 'Sandra',
    role: 'Youth & culture',
    roleFr: 'Jeunesse & culture',
    slogan: 'Yaoundé should be fun again.',
    sloganFr: 'Yaoundé doit redevenir joyeuse.',
    policy: 'fun_boost',
    popularity: 35,
  },
];

export const CITY_ELECTION_INTERVAL = 7;
export const CITY_VOTING_WINDOW = 3;
export const CITY_RUN_FEE = 20000;
export const CITY_CAMPAIGN_UNIT = 5000;
export const CITY_PLAYER_VOTE_WEIGHT = 20;
