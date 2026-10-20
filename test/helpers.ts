import { createGameState, type NewGameOptions } from '../src/sim/state';
import type { Appearance, GameState } from '../src/sim/types';

export const TEST_APPEARANCE: Appearance = {
  skinTone: 3,
  hair: 'fade',
  bodyType: 'medium',
  shirtColor: '#e0532f',
  pantsColor: '#2c3e50',
};

export function makeState(overrides: Partial<NewGameOptions> = {}): GameState {
  return createGameState({
    name: 'Test Player',
    gender: 'x',
    background: 'hustler',
    appearance: TEST_APPEARANCE,
    ...overrides,
  });
}
