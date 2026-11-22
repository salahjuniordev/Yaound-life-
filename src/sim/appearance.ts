import type { Appearance, BottomStyle, CharacterSex } from './types';

const MALE_FORBIDDEN_BOTTOMS: ReadonlySet<BottomStyle> = new Set(['skirt', 'dress']);

export function canWearBottom(sex: CharacterSex, bottom: BottomStyle): boolean {
  return !(sex === 'm' && MALE_FORBIDDEN_BOTTOMS.has(bottom));
}

/** Keep old saves and preset changes renderable when clothing is sex-gated. */
export function normalizeAppearanceForSex(appearance: Appearance, sex: CharacterSex): Appearance {
  const bottom = appearance.bottomStyle;
  if (!bottom || canWearBottom(sex, bottom)) return appearance;
  return { ...appearance, bottomStyle: 'pants' };
}
