import type { Appearance, CharacterSex } from '../sim/types';

export interface CharacterPreset {
  id: 'amina' | 'brice' | 'marie';
  sex: CharacterSex;
  name: string;
  nameFr: string;
  subtitle: string;
  subtitleFr: string;
  referenceImage: string;
  appearance: Appearance;
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'amina',
    sex: 'f',
    name: 'Amina',
    nameFr: 'Amina',
    subtitle: 'Student',
    subtitleFr: 'Étudiante',
    referenceImage: 'amina_student.png',
    appearance: {
      skinTone: 2,
      hair: 'twists',
      bodyType: 'slim',
      faceShape: 'oval',
      pattern: 'weave',
      shirtColor: '#f2b134',
      pantsColor: '#2a7d7b',
      shoeColor: '#e0532f',
      bag: 'crossbody',
      bagColor: '#6d4c41',
    },
  },
  {
    id: 'brice',
    sex: 'm',
    name: 'Brice',
    nameFr: 'Brice',
    subtitle: 'Creative Hustler',
    subtitleFr: 'Créatif débrouillard',
    referenceImage: 'brice_hustler_creative.png',
    appearance: {
      skinTone: 1,
      hair: 'fade',
      bodyType: 'medium',
      faceShape: 'square',
      facialHair: 'stubble',
      shirtColor: '#e8e2d4',
      overShirtColor: '#e0532f',
      pantsColor: '#2c3e50',
      shoeColor: '#2b2b2b',
      bag: 'sling',
      bagColor: '#2b2b2b',
    },
  },
  {
    id: 'marie',
    sex: 'f',
    name: 'Marie',
    nameFr: 'Marie',
    subtitle: 'Market Trader',
    subtitleFr: 'Commerçante',
    referenceImage: 'marie_trader.png',
    appearance: {
      skinTone: 0,
      hair: 'braids',
      bodyType: 'medium',
      faceShape: 'round',
      pattern: 'geo',
      shirtColor: '#d94f6b',
      pantsColor: '#1f2a30',
      bottomStyle: 'skirt',
      headwear: 'headwrap',
      headwearColor: '#2f6fe0',
      shoeColor: '#6d4c41',
      bag: 'tote',
      bagColor: '#2f6fe0',
    },
  },
];
