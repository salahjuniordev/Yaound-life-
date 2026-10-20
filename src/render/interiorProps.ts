export interface PropBox {
  shape: 'box';
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
  color: string;
  rx?: number;
  ry?: number;
  rz?: number;
  structural?: boolean;
}

export interface PropCyl {
  shape: 'cyl';
  r: number;
  h: number;
  x: number;
  y: number;
  z: number;
  color: string;
  rx?: number;
  ry?: number;
  rz?: number;
  structural?: boolean;
}

export interface PropSphere {
  shape: 'sphere';
  r: number;
  x: number;
  y: number;
  z: number;
  color: string;
  rx?: number;
  ry?: number;
  rz?: number;
  structural?: boolean;
}

export type PropDef = PropBox | PropCyl | PropSphere;

export interface InteriorLayout {
  floorColor: string;
  matColor: string;
  props: PropDef[];
}

export const SIT_INTERIORS = new Set(['home_room', 'njangi', 'bank', 'bar', 'restaurant']);

export const INTERIOR_IDS = [
  'home_room',
  'restaurant',
  'bar',
  'bank',
  'shop',
  'cyber',
  'clinic',
  'gym',
  'library',
  'salon',
  'tailor',
  'workshop',
  'studio',
  'school',
  'njangi',
];

export const PROP_SAFE_ZONE = { minX: -0.9, maxX: 0.9, minZ: -0.15, maxZ: 1.75, maxY: 1.8 };

export function propHalfExtents(p: PropDef): { hw: number; hd: number; hh: number } {
  if (p.shape === 'box') return { hw: p.w / 2, hd: p.d / 2, hh: p.h / 2 };
  if (p.shape === 'cyl') return { hw: p.r, hd: p.r, hh: p.h / 2 };
  return { hw: p.r, hd: p.r, hh: p.r };
}

const b = (w: number, h: number, d: number, x: number, y: number, z: number, color: string): PropBox => ({
  shape: 'box', w, h, d, x, y, z, color,
});
const c = (r: number, h: number, x: number, y: number, z: number, color: string): PropCyl => ({
  shape: 'cyl', r, h, x, y, z, color,
});
const sph = (r: number, x: number, y: number, z: number, color: string): PropSphere => ({
  shape: 'sphere', r, x, y, z, color,
});

const STOOLS = ['#2c3e50', '#c96f4a', '#2fa05a', '#8c6b45'];
const PRODUCE = ['#e0532f', '#f2b134', '#2fa05a', '#2f6fe0', '#d94f6b', '#8e44ad'];
const BOOKS = ['#d94f6b', '#2f6fe0', '#f2b134', '#2fa05a', '#c96f4a', '#8e44ad'];
const FABRIC = ['#2f6fe0', '#e0532f', '#2fa05a', '#f2b134', '#d94f6b', '#4b3b6b'];
const BOTTLES = ['#2fa05a', '#f2b134', '#e0532f', '#2f6fe0', '#8e44ad', '#d94f6b'];

function pick(palette: string[], i: number): string {
  return palette[((i % palette.length) + palette.length) % palette.length];
}

function baseProps(floorColor: string, matColor: string): PropDef[] {
  return [
    { ...b(14, 0.3, 10, 0, -0.15, 0, floorColor), structural: true },
    { ...b(14, 3.4, 0.3, 0, 1.7, -5, '#b9a98f'), structural: true },
    { ...b(0.3, 3.4, 10, -7, 1.7, 0, '#b0a089'), structural: true },
    { ...b(0.3, 3.4, 10, 7, 1.7, 0, '#b0a089'), structural: true },
    { ...b(3.2, 2.4, 0.18, 0, 1.2, 4.9, '#7a5b3a'), structural: true },
    b(1.6, 0.35, 1.6, 5.6, 0.18, 3.6, '#6d4c41'),
    b(0.4, 0.5, 0.4, 5.6, 0.55, 3.6, '#2fa05a'),
    b(2.4, 0.02, 1.4, 0, 0.01, 3.6, matColor),
  ];
}

function stoolsAround(cx: number, cz: number, offsets: [number, number][], paletteOffset = 0): PropDef[] {
  return offsets.map(([ox, oz], i) => c(0.27, 0.5, cx + ox, 0.25, cz + oz, pick(STOOLS, i + paletteOffset)));
}

function tableWithStools(cx: number, cz: number, stoolColor: string): PropDef[] {
  return [
    b(1.4, 0.08, 1.4, cx, 0.74, cz, '#8c6b45'),
    c(0.09, 0.7, cx, 0.35, cz, '#5c6b73'),
    c(0.27, 0.5, cx - 1.0, 0.25, cz, stoolColor),
    c(0.27, 0.5, cx + 1.0, 0.25, cz, stoolColor),
    c(0.27, 0.5, cx, 0.25, cz - 1.0, stoolColor),
    c(0.27, 0.5, cx, 0.25, cz + 1.0, stoolColor),
  ];
}

function chair(x: number, z: number, color: string): PropDef[] {
  return [
    b(0.5, 0.1, 0.5, x, 0.45, z, color),
    b(0.5, 0.5, 0.08, x, 0.72, z + 0.24, color),
  ];
}

function schoolDesk(x: number, z: number): PropDef[] {
  return [
    b(1.2, 0.06, 0.6, x, 0.72, z, '#8c6b45'),
    b(0.9, 0.66, 0.5, x, 0.33, z, '#7a5b3a'),
    b(0.45, 0.1, 0.45, x, 0.48, z + 0.55, '#5c6b73'),
    b(0.45, 0.45, 0.08, x, 0.75, z + 0.75, '#5c6b73'),
  ];
}

function homeRoom(): InteriorLayout {
  return {
    floorColor: '#8a7a66',
    matColor: '#c96f4a',
    props: [
      ...baseProps('#8a7a66', '#c96f4a'),
      b(2.6, 0.45, 1.7, -4.6, 0.25, -3.4, '#5c6b73'),
      b(2.4, 0.12, 0.5, -4.6, 0.55, -4.05, '#e8e2d4'),
      b(1.5, 0.06, 1.2, -1.2, 0.03, -3.6, '#c96f4a'),
      b(0.9, 0.8, 0.9, 2.4, 0.4, -3.8, '#7a5b3a'),
      b(1.4, 0.08, 0.8, 2.4, 0.84, -3.8, '#8c6b45'),
      b(1.6, 1.1, 0.5, -0.4, 0.55, -4.6, '#3f4a55'),
      b(1.3, 0.75, 0.06, -0.4, 1.15, -4.35, '#1a2530'),
      b(2.6, 0.9, 0.8, 5.2, 0.45, -3.9, '#9a8f7f'),
      b(0.6, 0.5, 0.6, 4.6, 0.25, -4.3, '#3a3a3a'),
      b(0.34, 0.28, 0.34, 5.8, 1.05, -4.4, '#2fa05a'),
      b(0.7, 0.9, 2.6, -6.5, 0.45, 2.4, '#8c6b45'),
      c(0.3, 0.35, -6.5, 1.0, 1.8, '#c96f4a'),
      c(0.24, 0.3, -6.5, 0.98, 2.9, '#3a3a3a'),
      b(0.6, 1.9, 1.4, -6.55, 0.95, -1.0, '#5c6b73'),
      c(0.22, 0.45, -6.1, 0.22, 3.8, '#8c6b45'),
    ],
  };
}

function restaurantRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#6d5442', '#c96f4a'),
    b(5, 1.05, 1, -3.2, 0.52, -3.6, '#7a5b3a'),
    b(5, 0.08, 1.2, -3.2, 1.1, -3.6, '#8c6b45'),
    b(2.6, 1.1, 0.08, -3.2, 2.1, -4.8, '#2c3e50'),
    b(1.2, 0.9, 0.9, 3.4, 0.45, -3.9, '#3a3a3a'),
    c(0.34, 0.5, 3.4, 1.15, -3.9, '#c96f4a'),
    c(0.26, 0.4, 4.2, 1.1, -3.9, '#8c6b45'),
    b(0.8, 1.7, 0.8, 5.9, 0.85, -4.3, '#e8e2d4'),
    ...tableWithStools(-3.6, -0.8, '#2c3e50'),
    ...tableWithStools(2.8, -1.4, '#c96f4a'),
    c(0.16, 0.05, -3.6, 0.81, -0.8, '#e8e2d4'),
    c(0.16, 0.05, 2.8, 0.81, -1.4, '#e8e2d4'),
  ];
  return { floorColor: '#6d5442', matColor: '#c96f4a', props };
}

function barRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#4e3b33', '#d94f6b'),
    b(6, 1.05, 1, 0, 0.52, -3.6, '#7a5b3a'),
    b(6, 0.08, 1.2, 0, 1.1, -3.6, '#8c6b45'),
    b(4.6, 0.06, 0.5, 0, 1.75, -4.6, '#5c6b73'),
    b(4.6, 0.06, 0.5, 0, 1.32, -4.6, '#5c6b73'),
    b(3, 0.02, 2.4, 2.6, 0.02, 0.9, '#4b3b6b'),
    b(0.7, 1.8, 0.7, -5.9, 0.9, -0.2, '#1a2530'),
    b(0.7, 1.8, 0.7, 5.9, 0.9, -0.2, '#1a2530'),
    c(0.18, 0.1, -5.9, 1.75, -0.2, '#5c6b73'),
    c(0.18, 0.1, 5.9, 1.75, -0.2, '#5c6b73'),
    b(1.6, 0.9, 0.08, 0, 2.3, -4.8, '#1a2530'),
    b(1.44, 0.74, 0.03, 0, 2.3, -4.74, '#2f6fe0'),
  ];
  for (let i = 0; i < 6; i++) props.push(c(0.09, 0.42, -1.9 + i * 0.76, 2.0, -4.6, pick(BOTTLES, i)));
  for (let i = 0; i < 5; i++) props.push(c(0.08, 0.34, -1.6 + i * 0.8, 1.53, -4.6, pick(BOTTLES, i + 2)));
  for (const x of [-2.3, -0.7, 0.9, 2.5]) props.push(c(0.26, 1.05, x, 0.53, -2.9, '#8c6b45'));
  return { floorColor: '#4e3b33', matColor: '#d94f6b', props };
}

function bankRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#9c9c96', '#3f4a55'),
    b(3.4, 1.05, 1, -3.4, 0.52, -3.8, '#b9b2a6'),
    b(3.4, 1.05, 1, 1.4, 0.52, -3.8, '#b9b2a6'),
    b(3.5, 0.08, 1.1, -3.4, 1.1, -3.8, '#d8d2c6'),
    b(3.5, 0.08, 1.1, 1.4, 1.1, -3.8, '#d8d2c6'),
    b(3.3, 1.1, 0.05, -3.4, 1.75, -3.8, '#a8c6d8'),
    b(3.3, 1.1, 0.05, 1.4, 1.75, -3.8, '#a8c6d8'),
    b(0.5, 0.5, 0.5, -3.4, 0.3, -4.6, '#3f4a55'),
    b(0.5, 0.5, 0.5, 1.4, 0.3, -4.6, '#3f4a55'),
    b(1.0, 2.2, 0.8, 6.2, 1.1, -1.6, '#3f4a55'),
    b(0.72, 0.5, 0.03, 6.2, 1.5, -1.18, '#2f6fe0'),
    b(0.4, 0.25, 0.03, 6.2, 1.1, -1.18, '#d8d2c6'),
    b(0.1, 2.0, 0.05, 6.75, 1.3, -1.6, '#f2b134'),
    c(0.05, 1.0, -2.6, 0.5, 1.6, '#3f4a55'),
    c(0.05, 1.0, -2.6, 0.5, 0.2, '#3f4a55'),
    c(0.05, 1.0, -2.6, 0.5, -1.2, '#3f4a55'),
    b(0.04, 0.04, 1.3, -2.6, 0.95, 0.9, '#d94f6b'),
    b(0.04, 0.04, 1.3, -2.6, 0.95, -0.5, '#d94f6b'),
    ...chair(-3.6, 1.4, '#2f6fe0'),
    ...chair(-4.5, 1.4, '#2f6fe0'),
    ...chair(-5.4, 1.4, '#2f6fe0'),
    b(2.2, 1.0, 0.8, 4.8, 0.5, 3.4, '#7a5b3a'),
  ];
  return { floorColor: '#9c9c96', matColor: '#3f4a55', props };
}

function shopRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#8a7a66', '#2fa05a'),
    b(5, 2.0, 0.5, 0, 1.0, -4.6, '#8c6b45'),
    b(0.5, 2.0, 4.2, -6.6, 1.0, 0.2, '#8c6b45'),
    b(0.9, 1.8, 0.8, 6.35, 0.9, -2.6, '#2f6fe0'),
    b(0.03, 1.6, 0.72, 5.99, 0.95, -2.6, '#a8c6d8'),
    b(2.6, 1.0, 0.9, 3.6, 0.5, 3.2, '#7a5b3a'),
    b(0.4, 0.32, 0.32, 4.2, 1.16, 3.2, '#3a3a3a'),
    c(0.35, 0.3, -3.0, 0.15, 3.0, '#c96f4a'),
    c(0.35, 0.3, -3.9, 0.15, 3.0, '#f2b134'),
  ];
  for (const y of [0.7, 1.3, 1.9]) {
    props.push(b(5, 0.06, 0.5, 0, y, -4.6, '#5c6b73'));
    props.push(b(0.5, 0.06, 4.2, -6.6, y, 0.2, '#5c6b73'));
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      props.push(b(0.34, 0.34, 0.3, -2.0 + i * 0.8, 0.93 + row * 0.6, -4.6, pick(PRODUCE, i + row)));
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3; i++) {
      props.push(b(0.3, 0.34, 0.34, -6.6, 0.93 + row * 0.6, -1.1 + i * 0.9, pick(PRODUCE, i + row + 2)));
    }
  }
  return { floorColor: '#8a7a66', matColor: '#2fa05a', props };
}

function cyberRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#5c6b73', '#2f6fe0'),
    b(3, 1.05, 0.9, -4.4, 0.52, 3.3, '#5c6b73'),
    b(3.1, 0.06, 1.0, -4.4, 1.08, 3.3, '#3f4a55'),
    b(0.45, 0.35, 0.4, -3.6, 1.28, 3.3, '#1a2530'),
    b(0.7, 0.75, 4.4, 6.45, 0.375, -0.8, '#7a5b3a'),
    b(0.8, 1.6, 0.6, 6.2, 0.8, -4.4, '#1a2530'),
    b(0.06, 0.06, 0.03, 6.2, 1.2, -4.04, '#2fa05a'),
    b(0.06, 0.06, 0.03, 6.2, 1.0, -4.04, '#f2b134'),
  ];
  for (const x of [-4.6, -2.8]) {
    for (const z of [-2.8, -0.9]) {
      props.push(b(0.8, 0.72, 0.55, x, 0.36, z, '#7a5b3a'));
      props.push(b(1.1, 0.06, 0.65, x, 0.76, z, '#8c6b45'));
      props.push(b(0.52, 0.42, 0.05, x, 1.1, z - 0.12, '#1a2530'));
      props.push(b(0.46, 0.36, 0.02, x, 1.1, z - 0.08, '#2f6fe0'));
      props.push(b(0.45, 0.1, 0.45, x, 0.5, z + 0.6, '#3f4a55'));
      props.push(b(0.45, 0.5, 0.08, x, 0.78, z + 0.82, '#3f4a55'));
    }
  }
  for (const z of [-2.4, -0.8, 0.8]) {
    props.push(b(0.1, 0.1, 0.1, 6.35, 0.85, z, '#3a3a3a'));
    props.push(b(0.05, 0.42, 0.52, 6.15, 1.1, z, '#1a2530'));
    props.push(b(0.02, 0.36, 0.46, 6.11, 1.1, z, '#2f6fe0'));
    props.push(b(0.45, 0.1, 0.45, 5.7, 0.5, z, '#3f4a55'));
    props.push(b(0.08, 0.5, 0.45, 5.48, 0.78, z, '#3f4a55'));
  }
  return { floorColor: '#5c6b73', matColor: '#2f6fe0', props };
}

function clinicRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#b9c4c9', '#a8c6d8'),
    b(2.8, 1.05, 0.9, -5.0, 0.52, 3.0, '#e8e2d4'),
    b(2.9, 0.06, 1.0, -5.0, 1.08, 3.0, '#d8d2c6'),
    b(0.06, 0.06, 2.4, 1.5, 2.2, -1.4, '#3f4a55'),
    b(0.05, 2.2, 1.1, 1.5, 1.1, -1.95, '#a8c6d8'),
    b(0.05, 2.2, 1.0, 1.5, 1.1, -0.75, '#a8c6d8'),
    b(0.5, 1.8, 1.2, 6.4, 0.9, 1.6, '#e8e2d4'),
    b(0.04, 0.14, 0.5, 6.13, 1.5, 1.6, '#d94f4f'),
    b(0.04, 0.5, 0.14, 6.13, 1.5, 1.6, '#d94f4f'),
    b(2.6, 0.45, 0.6, -3.6, 0.22, 0.4, '#f2b134'),
    b(2.6, 0.5, 0.08, -3.6, 0.7, 0.08, '#e8e2d4'),
    b(0.6, 1.6, 1.2, 6.4, 0.8, -3.2, '#d8d2c6'),
    c(0.22, 0.1, 6.4, 1.65, -3.2, '#a8c6d8'),
  ];
  for (const z of [-2.6, -0.2]) {
    props.push(b(2.0, 0.55, 0.9, 3.0, 0.28, z, '#5c6b73'));
    props.push(b(1.9, 0.12, 0.8, 3.0, 0.61, z, '#e8e2d4'));
    props.push(b(0.5, 0.1, 0.35, 2.35, 0.72, z, '#d8d2c6'));
    props.push(b(0.06, 0.6, 0.9, 2.03, 0.65, z, '#5c6b73'));
  }
  return { floorColor: '#b9c4c9', matColor: '#a8c6d8', props };
}

function gymRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#5c6b73', '#2fa05a'),
    b(1.8, 0.5, 0.5, -3.4, 0.25, -3.2, '#2c3e50'),
    b(1.8, 0.5, 0.5, -3.4, 0.8, -3.2, '#2c3e50'),
    b(2.2, 0.15, 0.6, 3.6, 0.08, -2.2, '#3a3a3a'),
    b(2.2, 0.15, 0.6, 3.6, 0.75, -2.2, '#3a3a3a'),
    b(0.6, 1.4, 0.6, 4.6, 0.7, -3.6, '#c96f4a'),
    b(0.5, 0.5, 0.5, -5.6, 0.25, 1.4, '#2fa05a'),
    b(0.5, 0.5, 0.5, -5.6, 0.25, -0.4, '#f2b134'),
    b(0.06, 2.2, 4.0, -6.75, 1.4, 0.2, '#a8c6d8'),
    b(2.6, 0.04, 1.8, 2.8, 0.02, 2.4, '#2fa05a'),
    b(0.5, 0.5, 2.4, -6.6, 0.25, -1.4, '#5c6b73'),
    b(1.7, 0.25, 0.7, 4.6, 0.13, 3.2, '#1a2530'),
    b(0.12, 1.1, 0.12, 4.6, 0.9, 3.5, '#3a3a3a'),
    b(0.5, 0.3, 0.08, 4.6, 1.35, 3.5, '#3a3a3a'),
    b(0.5, 1.4, 0.5, 6.4, 0.7, 3.6, '#2f6fe0'),
    c(0.18, 0.4, 6.4, 1.6, 3.6, '#a8c6d8'),
  ];
  for (let i = 0; i < 6; i++) {
    props.push(b(0.18, 0.18, 0.5, -6.6, 0.6, -2.3 + i * 0.36, pick(['#3a3a3a', '#2fa05a'], i)));
  }
  return { floorColor: '#5c6b73', matColor: '#2fa05a', props };
}

function libraryRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#7d6b52', '#4b3b6b'),
    b(0.5, 2.4, 5.2, -6.6, 1.2, 0, '#8c6b45'),
    b(0.5, 2.4, 5.2, 6.6, 1.2, 0, '#8c6b45'),
    b(5.2, 2.4, 0.5, 0, 1.2, -4.6, '#8c6b45'),
    b(4.6, 0.5, 0.34, 0, 0.9, -4.28, '#e0532f'),
    b(4.6, 0.5, 0.34, 0, 1.6, -4.28, '#2f6fe0'),
    b(0.38, 0.5, 3.6, -6.28, 0.9, 0, '#2fa05a'),
    b(0.38, 0.5, 3.6, -6.28, 1.6, 0, '#f2b134'),
    b(0.38, 0.5, 3.6, 6.28, 0.9, 0, '#8e44ad'),
    b(0.38, 0.5, 3.6, 6.28, 1.6, 0, '#c96f4a'),
    b(2.4, 1.05, 0.9, -4.6, 0.52, 3.4, '#7a5b3a'),
    c(0.22, 0.25, -4.0, 1.18, 3.4, '#f2b134'),
    ...tableWithStools(-2.6, -0.6, '#4b3b6b'),
    ...tableWithStools(2.6, -1.6, '#4b3b6b'),
    b(0.16, 0.28, 0.16, -2.6, 0.92, -0.6, '#2fa05a'),
    b(0.16, 0.28, 0.16, 2.6, 0.92, -1.6, '#2fa05a'),
  ];
  for (let i = 0; i < 6; i++) {
    props.push(b(0.14, 0.5, 0.3, -2.3 + i * 0.9, 0.9, -4.28, pick(BOOKS, i)));
    props.push(b(0.14, 0.5, 0.3, -2.3 + i * 0.9, 1.6, -4.28, pick(BOOKS, i + 3)));
  }
  return { floorColor: '#7d6b52', matColor: '#4b3b6b', props };
}

function salonRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#8c7a8a', '#d94f6b'),
    b(0.06, 1.6, 5.2, 6.75, 1.7, 0, '#a8c6d8'),
    b(0.7, 0.9, 1.8, -6.5, 0.45, -2.6, '#5c6b73'),
    c(0.24, 0.1, -6.5, 0.95, -2.2, '#e8e2d4'),
    b(0.05, 0.3, 0.05, -6.75, 1.1, -2.2, '#d8d2c6'),
    b(0.5, 1.6, 1.6, -6.6, 1.4, 1.8, '#8c6b45'),
    b(1.8, 0.45, 0.6, -1.0, 0.22, 3.6, '#d94f6b'),
    b(0.05, 2.0, 0.05, 6.3, 1.0, -1.6, '#5c6b73'),
    c(0.3, 0.4, 6.0, 2.15, -1.6, '#2f6fe0'),
  ];
  for (const z of [-1.6, 0, 1.6]) {
    props.push(b(0.6, 0.14, 0.6, 5.7, 0.5, z, '#8c6b45'));
    props.push(b(0.1, 0.6, 0.6, 5.4, 0.85, z, '#3f4a55'));
  }
  for (let i = 0; i < 4; i++) {
    props.push(c(0.1, 0.3, -6.32, 0.9 + i * 0.35, 1.8, pick(BOTTLES, i)));
  }
  return { floorColor: '#8c7a8a', matColor: '#d94f6b', props };
}

function tailorRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#8a7a66', '#f2b134'),
    b(2.6, 0.9, 1.2, -3.0, 0.45, -1.4, '#8c6b45'),
    b(0.3, 0.3, 1.0, -3.8, 1.05, -1.4, '#2f6fe0'),
    b(0.3, 0.3, 1.0, -3.0, 1.05, -1.4, '#e0532f'),
    b(0.3, 0.3, 1.0, -2.2, 1.05, -1.4, '#2fa05a'),
    b(3.6, 0.06, 0.06, 0, 2.0, -4.6, '#3f4a55'),
    b(0.06, 1.6, 0.9, 6.75, 1.4, 2.0, '#a8c6d8'),
    b(2.0, 1.0, 0.8, 4.6, 0.5, 3.2, '#7a5b3a'),
  ];
  for (const x of [3.0, 4.6]) {
    props.push(b(1.0, 0.75, 0.6, x, 0.37, -3.4, '#7a5b3a'));
    props.push(b(0.45, 0.3, 0.3, x, 0.9, -3.5, '#1a2530'));
    props.push(c(0.05, 0.16, x + 0.35, 0.82, -3.3, '#d94f6b'));
    props.push(b(0.4, 0.1, 0.4, x, 0.45, -2.9, '#5c6b73'));
  }
  for (const z of [1.2, -0.2]) {
    props.push(c(0.28, 0.06, -5.6, 0.03, z, '#3f4a55'));
    props.push(c(0.04, 1.0, -5.6, 0.5, z, '#8c6b45'));
    props.push(b(0.5, 0.7, 0.28, -5.6, 1.35, z, z > 0 ? '#d94f6b' : '#2f6fe0'));
  }
  for (let i = 0; i < 6; i++) {
    props.push(c(0.12, 1.3, -1.5 + i * 0.6, 1.32, -4.6, pick(FABRIC, i)));
  }
  return { floorColor: '#8a7a66', matColor: '#f2b134', props };
}

function workshopRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#6b6f73', '#e0532f'),
    b(4.4, 0.25, 2.0, 0.6, 0.13, -1.8, '#3a3a3a'),
    c(0.09, 1.9, -1.5, 0.95, -2.7, '#e0532f'),
    c(0.09, 1.9, 2.7, 0.95, -2.7, '#e0532f'),
    b(4.4, 0.12, 0.12, 0.6, 1.9, -2.7, '#e0532f'),
    b(2.8, 0.9, 0.7, -5.2, 0.45, -4.4, '#7a5b3a'),
    b(0.5, 0.08, 0.3, -5.8, 0.94, -4.4, '#d94f4f'),
    b(0.3, 0.1, 0.3, -4.9, 0.95, -4.4, '#3a3a3a'),
    b(0.28, 0.28, 0.28, -4.2, 0.94, -4.35, '#5c6b73'),
    b(1.1, 1.4, 0.6, -6.28, 0.7, 0.4, '#d94f4f'),
    b(0.6, 0.25, 0.4, -6.28, 1.52, 0.4, '#f2b134'),
    b(3.0, 1.8, 0.5, 1.2, 0.9, -4.6, '#5c6b73'),
    c(0.34, 0.9, 6.2, 0.45, -2.2, '#2fa05a'),
    c(0.34, 0.9, 6.2, 0.45, -3.3, '#e0532f'),
  ];
  props.push(b(0.6, 0.4, 0.35, 0.7, 1.0, -4.6, '#3a3a3a'));
  props.push(b(0.45, 0.3, 0.3, 1.5, 0.95, -4.6, '#f2b134'));
  for (const y of [0.11, 0.33, 0.55, 0.77]) props.push(c(0.45, 0.22, 4.9, y, 2.6, '#1a2530'));
  return { floorColor: '#6b6f73', matColor: '#e0532f', props };
}

function studioRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#3f3a4a', '#8e44ad'),
    b(3.0, 0.9, 1.0, -3.4, 0.45, -2.2, '#3a3a3a'),
    b(2.4, 0.1, 0.6, -3.4, 0.98, -2.2, '#1a2530'),
    b(0.5, 0.9, 0.5, -2.2, 1.9, -4.55, '#1a2530'),
    b(0.5, 0.9, 0.5, -4.6, 1.9, -4.55, '#1a2530'),
    c(0.14, 0.12, -2.2, 2.45, -4.55, '#5c6b73'),
    c(0.14, 0.12, -4.6, 2.45, -4.55, '#5c6b73'),
    c(0.04, 1.7, 1.4, 0.85, -0.6, '#3f4a55'),
    b(0.5, 0.04, 0.04, 1.65, 1.68, -0.6, '#3a3a3a'),
    c(0.07, 0.22, 1.9, 1.62, -0.6, '#1a2530'),
    b(2.2, 2.6, 0.08, 3.8, 1.3, -1.6, '#a8c6d8'),
    b(0.12, 0.5, 0.72, 5.9, 0.3, 0.6, '#c96f4a'),
    b(0.08, 0.9, 0.08, 5.9, 0.95, 0.6, '#3a3a3a'),
    b(0.12, 0.5, 0.72, 5.9, 0.3, 1.5, '#f2b134'),
    b(0.08, 0.9, 0.08, 5.9, 0.95, 1.5, '#3a3a3a'),
    b(2.0, 0.8, 0.8, -1.8, 0.4, 3.4, '#4b3b6b'),
  ];
  for (let i = 0; i < 6; i++) props.push(c(0.04, 0.06, -4.2 + i * 0.32, 1.05, -2.3, '#f2b134'));
  for (const x of [-0.6, 0.8, 2.2, 3.6]) props.push(b(1.1, 1.1, 0.08, x, 1.8, -4.8, '#4b3b6b'));
  return { floorColor: '#3f3a4a', matColor: '#8e44ad', props };
}

function schoolRoom(): InteriorLayout {
  const props: PropDef[] = [
    ...baseProps('#9a8f7f', '#2f6fe0'),
    b(4.2, 1.6, 0.08, 0, 1.9, -4.8, '#2a4d3a'),
    b(4.2, 0.08, 0.14, 0, 1.05, -4.75, '#d8d2c6'),
    b(1.8, 0.9, 0.9, 4.6, 0.45, -3.6, '#8c6b45'),
    b(0.5, 0.1, 0.5, 4.6, 0.45, -4.4, '#5c6b73'),
    b(0.5, 0.5, 0.08, 4.6, 0.72, -4.62, '#5c6b73'),
    c(0.03, 0.15, 4.2, 0.98, -3.9, '#8c6b45'),
    sph(0.2, 4.2, 1.15, -3.9, '#2f6fe0'),
    b(0.5, 1.8, 2.4, 6.6, 0.9, 2.6, '#8c6b45'),
    b(0.3, 0.4, 2.0, 6.28, 1.1, 2.6, '#e0532f'),
    b(0.06, 1.2, 2.0, -6.8, 1.8, 0.8, '#a8c6a0'),
  ];
  for (const x of [-3.6, -1.8, 1.8, 3.6]) {
    for (const z of [-2.7, -0.8]) props.push(...schoolDesk(x, z));
  }
  return { floorColor: '#9a8f7f', matColor: '#2f6fe0', props };
}

function njangiRoom(): InteriorLayout {
  const props: PropDef[] = [...baseProps('#7d6b52', '#2f6fe0')];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    props.push(c(0.3, 0.45, Math.cos(a) * 1.4, 0.22, Math.sin(a) * 1.0 - 1.6, '#8c6b45'));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    props.push(c(0.3, 0.45, Math.cos(a) * 2.0, 0.22, Math.sin(a) * 1.1 - 1.6, '#5c6b73'));
  }
  props.push(
    b(1.4, 0.5, 1.4, 0, 0.4, -1.6, '#5c6b73'),
    b(0.8, 0.3, 0.8, 0, 0.75, -1.6, '#c96f4a'),
    b(0.5, 0.3, 0.4, 0, 1.05, -1.6, '#f2b134'),
    b(2.2, 2.2, 0.12, -0.4, 1.1, -4.78, '#2c3e50'),
    b(2, 0.02, 1.4, 0, 0.02, 1.8, '#3f6f8a'),
    b(0.7, 0.6, 0.7, 0, 0.3, -3.3, '#5c6b73'),
    b(0.7, 0.7, 0.06, 0, 2.5, -4.8, '#e8e2d4'),
    b(0.1, 0.1, 0.02, 0, 2.5, -4.76, '#3a3a3a'),
    b(2.8, 0.7, 0.06, 0, 2.3, -4.8, '#2c3e50'),
    b(2.8, 0.08, 0.07, 0, 2.72, -4.8, '#f2b134'),
  );
  return { floorColor: '#7d6b52', matColor: '#2f6fe0', props };
}

export function interiorLayout(interiorId: string): InteriorLayout {
  switch (interiorId) {
    case 'home_room': return homeRoom();
    case 'restaurant': return restaurantRoom();
    case 'bar': return barRoom();
    case 'bank': return bankRoom();
    case 'shop': return shopRoom();
    case 'cyber': return cyberRoom();
    case 'clinic': return clinicRoom();
    case 'gym': return gymRoom();
    case 'library': return libraryRoom();
    case 'salon': return salonRoom();
    case 'tailor': return tailorRoom();
    case 'workshop': return workshopRoom();
    case 'studio': return studioRoom();
    case 'school': return schoolRoom();
    case 'njangi': return njangiRoom();
    default:
      return {
        floorColor: '#8a7a66',
        matColor: '#3f4a55',
        props: [
          ...baseProps('#8a7a66', '#3f4a55'),
          b(2.0, 0.5, 0.6, -3.0, 0.25, -2.4, '#8c6b45'),
          b(0.8, 0.8, 0.8, 4.4, 0.4, -4.0, '#7a5b3a'),
        ],
      };
  }
}
