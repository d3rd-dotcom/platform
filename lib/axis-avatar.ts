/**
 * Deterministic three-axis avatars inspired by the 3-Axis Pattern Generator.
 *
 * The source pattern is a sum of three rotating vectors. A seed controls the
 * vector lengths, angular speeds, phases, scale, and palette. The same seed
 * always produces the same closed curve.
 */

const AVATAR_ROUTE = '/api/avatars/render';
const DICEBEAR_HOST = 'api.dicebear.com';

const SPEEDS = [
  -9, -8.5, -8, -7.5, -7, -6.5, -6, -5.5, -5, -4.5, -4, -3.5, -3, -2.5, -2,
  2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9,
] as const;

const PALETTES = [
  { background: '#101633', backgroundEdge: '#070B1C', glow: '#6B7CFF', core: '#F0F3FF', accent: '#9BA7FF' },
  { background: '#24122E', backgroundEdge: '#100717', glow: '#F052C9', core: '#FFE9F8', accent: '#FF8FE0' },
  { background: '#092A2C', backgroundEdge: '#041416', glow: '#33D6BE', core: '#E6FFFA', accent: '#75EAD8' },
  { background: '#30190D', backgroundEdge: '#150A04', glow: '#FF8A3D', core: '#FFF1E7', accent: '#FFB178' },
  { background: '#18270D', backgroundEdge: '#0A1205', glow: '#9CD641', core: '#F5FFE7', accent: '#C1EA7D' },
  { background: '#20163A', backgroundEdge: '#0D0819', glow: '#A47BFF', core: '#F2ECFF', accent: '#C4AAFF' },
] as const;

export interface AxisAvatarParams {
  lengths: [number, number, number];
  speeds: [number, number, number];
  phases: [number, number, number];
  scale: number;
  paletteIndex: number;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSpeed(random: () => number, usedMagnitudes: Set<number>): number {
  for (let attempt = 0; attempt < SPEEDS.length; attempt += 1) {
    const speed = SPEEDS[Math.floor(random() * SPEEDS.length)];
    if (!usedMagnitudes.has(Math.abs(speed))) {
      usedMagnitudes.add(Math.abs(speed));
      return speed;
    }
  }
  return 2;
}

export function getAxisAvatarParams(seed: string): AxisAvatarParams {
  const random = seededRandom(seed);
  const usedMagnitudes = new Set<number>();
  const length = () => (Math.floor(random() * 13) + 8) * 5;
  const phase = () => Math.floor(random() * 360) * Math.PI / 180;

  return {
    lengths: [length(), length(), length()],
    speeds: [
      pickSpeed(random, usedMagnitudes),
      pickSpeed(random, usedMagnitudes),
      pickSpeed(random, usedMagnitudes),
    ],
    phases: [phase(), phase(), phase()],
    scale: 0.82 + random() * 0.12,
    paletteIndex: Math.floor(random() * PALETTES.length),
  };
}

function curvePath(params: AxisAvatarParams): string {
  const center = 128;
  const radius = 106;
  const totalLength = params.lengths.reduce((sum, length) => sum + length, 0);
  const dynamicScale = radius / totalLength * params.scale;
  const hasHalfSpeed = params.speeds.some((speed) => !Number.isInteger(speed));
  const maxT = (hasHalfSpeed ? 4 : 2) * Math.PI;
  const samples = hasHalfSpeed ? 720 : 480;
  const points: string[] = [];

  for (let index = 0; index <= samples; index += 1) {
    const t = maxT * index / samples;
    let x = center;
    let y = center;
    for (let axis = 0; axis < 3; axis += 1) {
      const angle = params.speeds[axis] * t + params.phases[axis];
      x += params.lengths[axis] * dynamicScale * Math.cos(angle);
      y += params.lengths[axis] * dynamicScale * Math.sin(angle);
    }
    points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return `${points.join(' ')} Z`;
}

export function renderAxisAvatarSvg(seed: string): string {
  const params = getAxisAvatarParams(seed);
  const palette = PALETTES[params.paletteIndex];
  const path = curvePath(params);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">',
    '<defs>',
    `<radialGradient id="bg" cx="38%" cy="30%" r="76%"><stop stop-color="${palette.background}"/><stop offset="1" stop-color="${palette.backgroundEdge}"/></radialGradient>`,
    `<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>`,
    '<clipPath id="avatar-clip"><circle cx="128" cy="128" r="118"/></clipPath>',
    `<path id="curve" d="${path}"/>`,
    '</defs>',
    '<rect width="256" height="256" rx="128" fill="url(#bg)"/>',
    `<circle cx="128" cy="128" r="106" stroke="${palette.accent}" stroke-opacity=".16"/>`,
    '<g clip-path="url(#avatar-clip)">',
    `<use href="#curve" stroke="${palette.glow}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" opacity=".34" filter="url(#glow)"/>`,
    `<use href="#curve" stroke="${palette.glow}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".58"/>`,
    `<use href="#curve" stroke="${palette.core}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</g>',
    `<circle cx="128" cy="128" r="126" stroke="${palette.accent}" stroke-opacity=".28" stroke-width="2"/>`,
    '</svg>',
  ].join('');
}

export function buildAxisAvatarUrl(seed: string): string {
  return `${AVATAR_ROUTE}?seed=${encodeURIComponent(seed)}`;
}

/**
 * Converts stored DiceBear URLs during the rollout while leaving uploads,
 * Academic Angels, and already-migrated avatar URLs untouched.
 */
export function normalizeAvatarUrl(avatarUrl: string | null, fallbackSeed?: string): string | null {
  if (!avatarUrl) return null;

  try {
    const url = new URL(avatarUrl, 'https://mentalwealthacademy.world');
    if (url.hostname !== DICEBEAR_HOST) return avatarUrl;
    const seed = url.searchParams.get('seed') || fallbackSeed;
    return seed ? buildAxisAvatarUrl(seed) : null;
  } catch {
    return avatarUrl;
  }
}
