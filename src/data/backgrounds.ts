import type { BackgroundId, DistrictId, NeedsState, SkillKey } from '../sim/types';

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  nameFr: string;
  blurb: string;
  blurbFr: string;
  cash: number;
  momo: number;
  bank: number;
  debt: number;
  needs: Partial<NeedsState>;
  skills: Partial<Record<SkillKey, number>>;
  traits: string[];
  district: DistrictId;
  inventory: { itemId: string; qty: number }[];
  storyStart: string;
  powerCurveNote: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: 'student',
    name: 'The Student',
    nameFr: "L'Étudiant(e)",
    blurb: 'You arrived to study at Ngoa-Ekelle. Low money, academic duties, maybe a part-time hustle on the side.',
    blurbFr: "Tu es venu(e) étudier à Ngoa-Ekelle. Peu d'argent, des cours, peut-être un petit boulot à côté.",
    cash: 12000, momo: 5000, bank: 0, debt: 0,
    needs: { energy: 85, hunger: 70, hygiene: 80, mood: 72, social: 55 },
    skills: { academics: 3, tech: 1, charisma: 1 },
    traits: ['curious', 'organized'],
    district: 'ngoa_ekelle',
    inventory: [{ itemId: 'rice_kg', qty: 1 }, { itemId: 'spices_pack', qty: 1 }],
    storyStart: 'Your room near campus has a mattress, a chair, and a landlord expecting rent.',
    powerCurveNote: 'Cheap living and study bonuses, but slow early income.',
  },
  {
    id: 'hustler',
    name: 'The Hustler',
    nameFr: 'Le Débrouillard',
    blurb: 'Little money, big ambition. Find the angles, take the risks, keep moving.',
    blurbFr: "Peu d'argent, grande ambition. Trouve les combines, prends des risques, avance.",
    cash: 8000, momo: 3000, bank: 0, debt: 0,
    needs: { energy: 80, hunger: 65, hygiene: 70, mood: 78, social: 70 },
    skills: { sales: 2, charisma: 2, fitness: 1 },
    traits: ['outgoing', 'competitive'],
    district: 'mokolo',
    inventory: [{ itemId: 'beignets_haricots', qty: 2 }],
    storyStart: 'You sleep at your cousin\'s place in Mvog-Mbi. He says the market rewards people who move early.',
    powerCurveNote: 'High variance informal income, strong network growth.',
  },
  {
    id: 'graduate',
    name: 'The Graduate',
    nameFr: 'Le Diplômé',
    blurb: 'You have qualifications and a folder of certificates. Now navigate interviews and the long wait.',
    blurbFr: 'Tu as des diplômes et une chemise de certificats. Maintenant, les entretiens et la longue attente.',
    cash: 15000, momo: 8000, bank: 20000, debt: 0,
    needs: { energy: 88, hunger: 75, hygiene: 85, mood: 70, social: 60 },
    skills: { academics: 4, tech: 2, negotiation: 1 },
    traits: ['organized', 'cautious'],
    district: 'mvog_mbi',
    inventory: [{ itemId: 'tshirt', qty: 1 }],
    storyStart: 'You just moved back from Buea with a Bac+3. Your aunt asks every evening: "So, the job?"',
    powerCurveNote: 'Fast formal-career entry, slower informal income.',
  },
  {
    id: 'entrepreneur',
    name: 'The Entrepreneur',
    nameFr: "L'Entrepreneur(e)",
    blurb: 'Small starting capital and a notebook full of business ideas. Build something real.',
    blurbFr: "Un petit capital et un carnet plein d'idées. Construis quelque chose de réel.",
    cash: 25000, momo: 15000, bank: 0, debt: 25000,
    needs: { energy: 85, hunger: 75, hygiene: 80, mood: 75, social: 65 },
    skills: { sales: 2, management: 2, marketing: 1 },
    traits: ['ambitious', 'outgoing'],
    district: 'nlongkak',
    inventory: [{ itemId: 'plastic_stool', qty: 2 }],
    storyStart: 'You borrowed 25,000 FCFA from your brother. He believes in you. That is heavy.',
    powerCurveNote: 'Business tools from day one, debt pressure early.',
  },
  {
    id: 'established',
    name: 'The Established Citizen',
    nameFr: 'Le Citoyen Établi',
    blurb: 'A job, a home, possessions, an existing network. Keep the machine running and grow.',
    blurbFr: 'Un emploi, un logement, des biens, un réseau. Fais tourner la machine et grandis.',
    cash: 45000, momo: 30000, bank: 150000, debt: 0,
    needs: { energy: 90, hunger: 80, hygiene: 90, mood: 80, social: 75 },
    skills: { negotiation: 2, management: 2, charisma: 2 },
    traits: ['organized', 'empathetic'],
    district: 'mvog_mbi',
    inventory: [{ itemId: 'rice_kg', qty: 2 }, { itemId: 'powerbank', qty: 1 }],
    storyStart: 'You have been in Yaounde for years. People call you when they need a number or a favour.',
    powerCurveNote: 'Comfortable start, higher expectations and family obligations.',
  },
  {
    id: 'traders_child',
    name: "The Trader's Child",
    nameFr: 'L\'Enfant de Commerçant',
    blurb: 'You grew up between market stalls. You know cost price, margin, and how to greet a customer.',
    blurbFr: 'Tu as grandi entre les étals. Tu connais le prix de gros, la marge, et comment saluer un client.',
    cash: 18000, momo: 6000, bank: 0, debt: 0,
    needs: { energy: 86, hunger: 72, hygiene: 75, mood: 74, social: 80 },
    skills: { sales: 4, negotiation: 3, cooking: 1 },
    traits: ['outgoing', 'generous'],
    district: 'mokolo',
    inventory: [{ itemId: 'tomatoes_kg', qty: 3 }, { itemId: 'plantain_bunch', qty: 1 }],
    storyStart: 'Your mother runs a stall at Mokolo. She says you can take over the small table on market days.',
    powerCurveNote: 'Strong trading start, family expectations to support the stall.',
  },
  {
    id: 'moto_driver',
    name: 'The Moto-Taxi Driver',
    nameFr: 'Le Bendskinneur',
    blurb: 'You rent a bike by the day and chase the target. Fast money, real risk on these roads.',
    blurbFr: 'Tu loues une moto à la journée et poursuis l\'objectif. Argent rapide, vrai risque sur les routes.',
    cash: 10000, momo: 4000, bank: 0, debt: 12000,
    needs: { energy: 90, hunger: 65, hygiene: 65, mood: 70, social: 60 },
    skills: { driving: 4, fitness: 2 },
    traits: ['brave', 'easygoing'],
    district: 'mvan',
    inventory: [{ itemId: 'water_sachet', qty: 3 }],
    storyStart: 'The bike owner takes 5,000 FCFA rental before you turn a wheel. The rest depends on you.',
    powerCurveNote: 'Immediate cash flow, accident risk, daily rental pressure.',
  },
  {
    id: 'village_arrival',
    name: 'The Village Arrival',
    nameFr: 'Le Villageois Arrivé',
    blurb: 'You just got off the bus with a bag and a phone number. Small network, big hopes.',
    blurbFr: 'Tu viens de descendre du bus avec un sac et un numéro. Petit réseau, grands espoirs.',
    cash: 9000, momo: 1500, bank: 0, debt: 0,
    needs: { energy: 75, hunger: 60, hygiene: 65, mood: 72, social: 45 },
    skills: { fitness: 2, cooking: 2, charisma: 1 },
    traits: ['curious', 'humble'],
    district: 'mvan',
    inventory: [{ itemId: 'beignets_haricots', qty: 1 }],
    storyStart: 'A family friend in Mvog-Mbi can host you for two weeks. After that, the city decides.',
    powerCurveNote: 'Weakest network start, but every friendship is new and possible.',
  },
  {
    id: 'civil_servant',
    name: 'The Civil Servant In Wait',
    nameFr: 'Le Fonctionnaire en Attente',
    blurb: 'Your file is "in process" for integration. The pay is small, the paperwork is long, the patience is real.',
    blurbFr: 'Ton dossier est « en cours ». Le salaire est petit, la paperasse longue, la patience réelle.',
    cash: 14000, momo: 7000, bank: 30000, debt: 0,
    needs: { energy: 82, hunger: 75, hygiene: 82, mood: 62, social: 65 },
    skills: { academics: 3, negotiation: 1, charisma: 2 },
    traits: ['patient', 'cautious'],
    district: 'mvog_mbi',
    inventory: [{ itemId: 'spices_pack', qty: 1 }],
    storyStart: 'You check the notice board every Monday. One day your name will be there.',
    powerCurveNote: 'Slow start, big endgame stability with the integration quest.',
  },
  {
    id: 'freelancer',
    name: 'The Freelancer',
    nameFr: 'Le Créatif Indépendant',
    blurb: 'You have a skill, a phone, and clients to find. Design, edit, shoot, arrange — money follows reputation.',
    blurbFr: 'Tu as une compétence, un téléphone, des clients à trouver. Design, montage, photo — la réputation paie.',
    cash: 16000, momo: 12000, bank: 0, debt: 0,
    needs: { energy: 80, hunger: 70, hygiene: 78, mood: 76, social: 60 },
    skills: { tech: 2, creativity: 3, marketing: 1 },
    traits: ['creative', 'curious'],
    district: 'nlongkak',
    inventory: [{ itemId: 'powerbank', qty: 1 }],
    storyStart: 'Your friend says a restaurant in Nlongkak needs a menu redesign. Small budget, real portfolio piece.',
    powerCurveNote: 'Flexible schedule, income depends on building reputation.',
  },
  {
    id: 'employee',
    name: 'The Entry-Level Employee',
    nameFr: "L'Employé Débutant",
    blurb: 'You signed your first contract. Steady but limited. Show up, learn, and choose when to grow.',
    blurbFr: 'Tu as signé ton premier contrat. Stable mais limité. Sois présent, apprends, et choisis quand grandir.',
    cash: 13000, momo: 6000, bank: 10000, debt: 8000,
    needs: { energy: 88, hunger: 74, hygiene: 84, mood: 74, social: 62 },
    skills: { sales: 1, academics: 2, management: 1 },
    traits: ['reliable', 'organized'],
    district: 'nlongkak',
    inventory: [{ itemId: 'tshirt', qty: 1 }],
    storyStart: 'Your probation period is 90 days. The supervisor is watching who arrives on time.',
    powerCurveNote: 'Predictable income, schedule trade-offs early.',
  },
];

export const BACKGROUND_MAP: Record<BackgroundId, BackgroundDef> = Object.fromEntries(
  BACKGROUNDS.map((b) => [b.id, b]),
) as Record<BackgroundId, BackgroundDef>;

export const HAIR_STYLES = ['fade', 'braids', 'natural', 'bald', 'locks', 'wig', 'twists'] as const;
export const SKIN_TONES = ['#5b3a29', '#7a4a2f', '#8d5a3a', '#a06a45', '#4a2e20', '#6b4327', '#96633f', '#3b241a'];
export const SHIRT_COLORS = ['#e0532f', '#2f6fe0', '#f2b134', '#2fa05a', '#8e44ad', '#e8e2d4', '#d94f6b', '#2b2b2b'];
export const PANTS_COLORS = ['#2c3e50', '#3a2f28', '#5c6b73', '#1f2a30', '#4b3b6b', '#6d4c41', '#2a7d7b'];
