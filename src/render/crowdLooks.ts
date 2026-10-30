export type CrowdBodyType = 'slim' | 'average' | 'broad' | 'petite' | 'tall' | 'curvy';

export interface CrowdBuild {
  type: CrowdBodyType;
  height: number;
  shoulder: number;
  hip: number;
  torso: number;
  arm: number;
  leg: number;
  head: number;
}

const BUILDS: Record<CrowdBodyType, Omit<CrowdBuild, 'type'>> = {
  slim: { height: 0.97, shoulder: 0.9, hip: 0.88, torso: 0.98, arm: 0.87, leg: 0.9, head: 0.98 },
  average: { height: 1, shoulder: 1, hip: 1, torso: 1, arm: 1, leg: 1, head: 1 },
  broad: { height: 1.02, shoulder: 1.14, hip: 1.06, torso: 1.04, arm: 1.16, leg: 1.1, head: 1.02 },
  petite: { height: 0.88, shoulder: 0.9, hip: 1.02, torso: 0.95, arm: 0.9, leg: 0.92, head: 0.97 },
  tall: { height: 1.12, shoulder: 1.02, hip: 0.96, torso: 1.06, arm: 1.04, leg: 1.08, head: 0.99 },
  curvy: { height: 0.95, shoulder: 0.96, hip: 1.18, torso: 0.97, arm: 0.94, leg: 0.95, head: 0.98 },
};

const TYPES = Object.keys(BUILDS) as CrowdBodyType[];

export function hashUnit(id: string, salt: string): number {
  let h = 2166136261;
  const key = `${id}:${salt}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function crowdBuildFor(id: string): CrowdBuild {
  const type = TYPES[Math.floor(hashUnit(id, 'build') * TYPES.length)] ?? 'average';
  const base = BUILDS[type];
  const jitter = (salt: string) => 0.96 + hashUnit(id, salt) * 0.08;
  return {
    type,
    height: base.height * jitter('height'),
    shoulder: base.shoulder * jitter('shoulder'),
    hip: base.hip * jitter('hip'),
    torso: base.torso * jitter('torso'),
    arm: base.arm * jitter('arm'),
    leg: base.leg * jitter('leg'),
    head: base.head * jitter('head'),
  };
}
