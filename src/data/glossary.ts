export interface GlossaryEntry {
  term: string;
  termFr: string;
  definition: string;
  definitionFr: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Njangi', termFr: 'Njangi (tontine)', definition: 'A rotating savings group: everyone contributes on schedule and members take turns receiving the whole pot. Also called tontine.', definitionFr: 'Groupe d\'épargne rotatif : chacun cotise et reçoit la cagnotte à tour de rôle.' },
  { term: 'Delestage', termFr: 'Délestage', definition: 'Planned or unplanned power cuts that rotate across neighbourhoods. Shops use generators and ice to cope.', definitionFr: 'Coupures de courant planifiées ou non qui tournent entre quartiers.' },
  { term: 'Bendskin', termFr: 'Bendskin', definition: 'Moto-taxi: motorcycle taxis that carry passengers. Fast, common, and risky on bad roads.', definitionFr: 'Moto-taxi : rapide, courant, et risqué sur les mauvaises routes.' },
  { term: 'Poisson braise', termFr: 'Poisson braisé', definition: 'Grilled fish with pepper sauce, usually eaten with plantains or mion-do in the evening.', definitionFr: 'Poisson grillé à la sauce piment, souvent avec plantain ou mion-do.' },
  { term: 'Quartier', termFr: 'Quartier', definition: 'Neighbourhood. Yaounde is a city of quartiers, each with its own feel, prices and rhythm.', definitionFr: 'Quartier. Yaoundé est une ville de quartiers.' },
  { term: 'MoMo', termFr: 'MoMo', definition: 'Mobile money wallet (fictionalized in this game) used to send and receive money via phone and agents.', definitionFr: 'Portefeuille mobile (fictif dans ce jeu) pour envoyer et recevoir de l\'argent.' },
  { term: 'Camfranglais', termFr: 'Camfranglais', definition: 'A playful mix of French, English and Cameroonian languages used in street conversations.', definitionFr: 'Mélange ludique de français, anglais et langues camerounaises.' },
  { term: 'Concours', termFr: 'Concours', definition: 'Competitive public-service exams used to enter government jobs. Long queues, serious preparation.', definitionFr: 'Examens compétitifs pour entrer dans la fonction publique.' },
  { term: 'SMIG', termFr: 'SMIG', definition: 'The minimum wage (in-game value). Real-world figures vary; this game uses fictional balanced values.', definitionFr: 'Le salaire minimum (valeur du jeu, fictive et équilibrée).' },
  { term: 'Mion-do', termFr: 'Mion-do', definition: 'Fermented cassava sticks wrapped in leaves, eaten with fish or stew.', definitionFr: 'Bâtons de manioc, mangés avec poisson ou sauce.' },
  { term: 'Ndole', termFr: 'Ndolé', definition: 'A celebratory stew of bitterleaf and groundnut, usually with fish, beef or shrimp.', definitionFr: 'Ragoût festif de feuilles amères et arachide.' },
  { term: 'Soya', termFr: 'Soya', definition: 'Spiced grilled beef skewers sold in the evening at street corners.', definitionFr: 'Brochettes de bœuf épicées vendues le soir.' },
  { term: 'Pagne', termFr: 'Pagne', definition: 'Colourful printed fabric, worn or tailored for daily life, celebrations and ceremonies.', definitionFr: 'Tissu imprimé coloré pour tous les jours et les cérémonies.' },
  { term: 'Call-box', termFr: 'Call-box', definition: 'Informal phone-charging or credit mini-business. A classic small hustle.', definitionFr: 'Mini-entreprise informelle de crédit téléphonique ou recharge.' },
  { term: 'Bail', termFr: 'Bail', definition: 'Rental lease. In this game, lease terms and dates are always shown clearly before you commit.', definitionFr: 'Contrat de location. Toujours clair avant d\'accepter.' },
];

export const CAMFRANGLAIS_PHRASES = [
  'On dit quoi?',
  'C\'est comment?',
  'Tu es là!',
  'Mon frère, on est ensemble.',
  'Ça va un peu.',
  'Le boulot dort pas.',
  'Tu me comprends bien.',
  'C\'est le Cameroon, on se débrouille.',
  'Franchement, la ville est dure.',
  'On va gérer.',
];

export const CAMFRANGLAIS_CHANCE = { off: 0, light: 0.25, heavy: 0.6 } as const;
