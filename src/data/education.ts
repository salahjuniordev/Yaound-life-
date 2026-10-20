import type { DistrictId } from '../sim/types';

export interface ExamTrackDef {
  id: 'probatoire' | 'bac' | 'concours';
  name: string;
  nameFr: string;
  fromLevels: string[];
  toLevel: string;
  fee: number;
  prepDays: number;
  minAcademics: number;
  passThreshold: number;
  examDistrict: DistrictId;
  place: string;
  placeFr: string;
  description: string;
  descriptionFr: string;
}

export const EDUCATION_RANKS: Record<string, number> = {
  'GCE A-Level': 1,
  Probatoire: 2,
  Bac: 3,
  Student: 3,
  'Bac+3': 4,
  'Concours réussi': 5,
};

export function educationAtLeast(have: string, required: string): boolean {
  return (EDUCATION_RANKS[have] ?? 0) >= (EDUCATION_RANKS[required] ?? 99);
}

export const EXAM_TRACKS: ExamTrackDef[] = [
  {
    id: 'probatoire',
    name: 'Probatoire',
    nameFr: 'Probatoire',
    fromLevels: ['GCE A-Level'],
    toLevel: 'Probatoire',
    fee: 5000,
    prepDays: 3,
    minAcademics: 1,
    passThreshold: 4,
    examDistrict: 'mvog_mbi',
    place: 'Bright Future School (Mvog-Mbi)',
    placeFr: 'École Bright Future (Mvog-Mbi)',
    description: 'The first big school exam. Study a few days, pay the fees, sit it at Bright Future School.',
    descriptionFr: 'Le premier grand examen. Étudie quelques jours, paie les frais, passe-le à Bright Future School.',
  },
  {
    id: 'bac',
    name: 'Baccalauréat',
    nameFr: 'Baccalauréat',
    fromLevels: ['Probatoire'],
    toLevel: 'Bac',
    fee: 10000,
    prepDays: 4,
    minAcademics: 3,
    passThreshold: 6,
    examDistrict: 'mvog_mbi',
    place: 'Bright Future School (Mvog-Mbi)',
    placeFr: 'École Bright Future (Mvog-Mbi)',
    description: 'Opens doors to university and office jobs. Needs solid academics before you register.',
    descriptionFr: "Ouvre l'université et les emplois de bureau. Il faut de bonnes bases avant de s'inscrire.",
  },
  {
    id: 'concours',
    name: 'Concours',
    nameFr: 'Concours',
    fromLevels: ['Bac', 'Student', 'Bac+3'],
    toLevel: 'Concours réussi',
    fee: 20000,
    prepDays: 5,
    minAcademics: 5,
    passThreshold: 8,
    examDistrict: 'ngoa_ekelle',
    place: 'University campus (Ngoa-Ekelle)',
    placeFr: 'Campus universitaire (Ngoa-Ekelle)',
    description: 'The public service competition. Long odds, months of study culture, life-changing payoff.',
    descriptionFr: 'Le concours de la fonction publique. Longue préparation, mais un vrai tournant.',
  },
];

export const EXAM_MAP: Record<string, ExamTrackDef> = Object.fromEntries(EXAM_TRACKS.map((t) => [t.id, t]));
