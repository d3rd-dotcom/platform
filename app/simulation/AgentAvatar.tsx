'use client';

import { useMemo } from 'react';
import { ImageData } from '@nouns/assets';
import { buildSVG } from '@nouns/sdk';
import { MWA_BRAND_BG } from '@/lib/avatars';

/**
 * Avatar for a simulated agent, rendered as a deterministic Nouns avatar.
 *
 * The agent id seeds the part selection, so the same agent always shows the same
 * Noun across the population grid, the live feeds, and the interview picker.
 * Generation is fully local (uses @nouns/assets part data + @nouns/sdk buildSVG)
 * — no network, no on-chain calls.
 */

export interface AgentAvatarProps {
  id: string | number;
  size?: number;
  className?: string;
}

const { bodies, accessories, heads, glasses } = ImageData.images;
const { palette } = ImageData;

/** FNV-1a hash with a salt so we can derive several independent indices per id. */
function hashWithSalt(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Memoize built SVGs across renders/components — the part data is the same for a
// given id, and buildSVG is the only non-trivial cost.
const svgCache = new Map<string, string>();

function buildNounSvg(id: string): string {
  const cached = svgCache.get(id);
  if (cached) return cached;
  const parts = [
    bodies[hashWithSalt(id, 1) % bodies.length],
    accessories[hashWithSalt(id, 2) % accessories.length],
    heads[hashWithSalt(id, 3) % heads.length],
    glasses[hashWithSalt(id, 4) % glasses.length],
  ];
  const svg = buildSVG(parts, palette, MWA_BRAND_BG);
  svgCache.set(id, svg);
  return svg;
}

export default function AgentAvatar({ id, size = 36, className }: AgentAvatarProps) {
  const svg = useMemo(() => buildNounSvg(String(id)), [id]);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
        lineHeight: 0,
      }}
      role="img"
      aria-label={`Agent ${id}`}
      // svg is generated locally from static part data — no external/user input
      dangerouslySetInnerHTML={{ __html: svg.replace('width="320" height="320"', 'width="100%" height="100%"') }}
    />
  );
}
