export interface HolidayDef {
  id: string;
  name: string;
  nameFr: string;
  month: number;
  dayOfMonth: number;
  kind: 'national' | 'religious' | 'observance';
  wageMultiplier: number;
  flavor: string;
  flavorFr: string;
}

export const HOLIDAYS: HolidayDef[] = [
  {
    id: 'new_year',
    name: 'New Year',
    nameFr: 'Nouvel An',
    month: 1,
    dayOfMonth: 1,
    kind: 'observance',
    wageMultiplier: 1.5,
    flavor: 'The city wakes slowly, church bells and firecracker smoke. Everyone says bonne année.',
    flavorFr: 'La ville se réveille doucement, cloches et pétards. Tout le monde dit bonne année.',
  },
  {
    id: 'youth_day',
    name: 'Youth Day',
    nameFr: 'Fête de la Jeunesse',
    month: 2,
    dayOfMonth: 11,
    kind: 'national',
    wageMultiplier: 1.5,
    flavor: 'Parades from morning, school groups marching on the boulevard, flags sold at every corner.',
    flavorFr: 'Défilés dès le matin, groupes scolaires sur le boulevard, drapeaux vendus à chaque coin.',
  },
  {
    id: 'women_day',
    name: "International Women's Day",
    nameFr: 'Journée de la Femme',
    month: 3,
    dayOfMonth: 8,
    kind: 'national',
    wageMultiplier: 1.5,
    flavor: 'Pagne cloth in every colour, women honoured all day, food shared far past dark.',
    flavorFr: 'Pagnes de toutes couleurs, les femmes à l’honneur toute la journée, on mange jusqu’au soir.',
  },
  {
    id: 'eid_fitr',
    name: 'Eid al-Fitr',
    nameFr: 'Aïd el-Fitr',
    month: 4,
    dayOfMonth: 10,
    kind: 'religious',
    wageMultiplier: 1.5,
    flavor: 'The end of the fast. New clothes, prayers, and plates passed across the courtyard.',
    flavorFr: 'La fin du jeûne. Habits neufs, prières, et plats qui circulent dans la cour.',
  },
  {
    id: 'labour_day',
    name: 'Labour Day',
    nameFr: 'Fête du Travail',
    month: 5,
    dayOfMonth: 1,
    kind: 'national',
    wageMultiplier: 1.5,
    flavor: 'Workers march and everyone not marching watches. Rest is the real celebration.',
    flavorFr: 'Les travailleurs défilent, les autres regardent. Le vrai luxe, c’est le repos.',
  },
  {
    id: 'national_day',
    name: 'National Day',
    nameFr: 'Fête Nationale',
    month: 5,
    dayOfMonth: 20,
    kind: 'national',
    wageMultiplier: 1.5,
    flavor: 'The twentieth of May: the boulevard du 20 Mai is packed from dawn for the parade.',
    flavorFr: 'Le 20 mai : le boulevard du 20 Mai est bondé dès l’aube pour le défilé.',
  },
  {
    id: 'eid_adha',
    name: 'Eid al-Adha',
    nameFr: 'Aïd el-Kébir',
    month: 6,
    dayOfMonth: 20,
    kind: 'religious',
    wageMultiplier: 1.5,
    flavor: 'The feast of sacrifice. Grills smoke all morning and nobody eats alone.',
    flavorFr: 'La fête du sacrifice. Les grills fument toute la matinée, personne ne mange seul.',
  },
  {
    id: 'assumption',
    name: 'Assumption',
    nameFr: 'Assomption',
    month: 8,
    dayOfMonth: 15,
    kind: 'religious',
    wageMultiplier: 1.5,
    flavor: 'The cathedral overflows and the choirs carry across the whole quarter.',
    flavorFr: 'La cathédrale déborde et les chorales résonnent dans tout le quartier.',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    nameFr: 'Noël',
    month: 12,
    dayOfMonth: 25,
    kind: 'religious',
    wageMultiplier: 1.5,
    flavor: 'Chickens bought days in advance, kids in new outfits, the best meal of the year.',
    flavorFr: 'Poulets achetés des jours avant, enfants endimanchés, le meilleur repas de l’année.',
  },
  {
    id: 'end_of_year',
    name: 'End of Year',
    nameFr: 'Fin d’année',
    month: 12,
    dayOfMonth: 30,
    kind: 'observance',
    wageMultiplier: 1.5,
    flavor: 'Everyone counts the year out loud and makes promises they may or may not keep.',
    flavorFr: 'Chacun compte l’année à voix haute et promet ce qu’il tiendra peut-être.',
  },
];

export function dayOfYearFor(day: number): number {
  return ((day - 1) % 360) + 1;
}

export function monthDayFor(day: number): { month: number; dayOfMonth: number } {
  const doy = dayOfYearFor(day);
  return { month: Math.floor((doy - 1) / 30) + 1, dayOfMonth: ((doy - 1) % 30) + 1 };
}

export function holidayForDay(day: number): HolidayDef | null {
  const { month, dayOfMonth } = monthDayFor(day);
  return HOLIDAYS.find((h) => h.month === month && h.dayOfMonth === dayOfMonth) ?? null;
}
