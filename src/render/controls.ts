export interface MoveInput {
  x: number;
  y: number;
  run: boolean;
}

export const moveInput: MoveInput = { x: 0, y: 0, run: false };

export const cameraState = {
  yaw: Math.PI,
  pitch: 0.42,
  distance: 11,
  dragging: false,
};

export const tapState: { target: { x: number; z: number } | null } = { target: null };

export const joystickState = { active: false, x: 0, y: 0 };

export const qualityTiers = {
  low: { dpr: 1, shadows: false, crowd: 14, fog: 150, rain: 350, viewDistance: 240 },
  mid: { dpr: 1.25, shadows: false, crowd: 26, fog: 210, rain: 700, viewDistance: 320 },
  high: { dpr: 1.6, shadows: true, crowd: 42, fog: 300, rain: 1100, viewDistance: 420 },
} as const;

export type QualityTier = keyof typeof qualityTiers;
