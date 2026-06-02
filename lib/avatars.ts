/**
 * Avatar System — DiceBear "toon-head"
 *
 * Generates unique toon avatars for each user with @dicebear/core + the
 * toon-head style from @dicebear/styles. Generation is fully local (no network
 * calls) and deterministic per seed.
 *
 * Each user gets 6 deterministic options derived from their user id; the same
 * seed always returns the same 6. Selecting one stores its seed as
 * selected_avatar_id and the rendered SVG data URI as avatar_url.
 *
 * Legacy Academic Angel avatars (angel_NNN) are still supported — agents use
 * them (so they stay visually distinct from humans), and they cover any
 * existing lookups. Angel images are hosted on IPFS, not generated.
 *
 * Toon Head style: a remix of "ToonHead" by Johan Melin, licensed CC BY 4.0.
 */

import { Style, Avatar as DiceBearAvatar } from '@dicebear/core';
import toonHeadDefinition from '@dicebear/styles/toon-head.json';

// Academic Angels NFT config (legacy — agents + existing avatar lookups)
const ANGELS_METADATA_BASE = 'https://nftstorage.link/ipfs/QmWag7KqqDs7yyXzzPxg3xS3jWGgZcPRd2YAS7Whd1L6Xd';
const IPFS_GATEWAY = 'https://nftstorage.link/ipfs/';
const TOTAL_ANGELS = 550;

// Number of avatars to assign per user
const AVATARS_PER_USER = 6;

// Academy blue. Kept for components that still tint Noun-based agent artwork
// (e.g. app/simulation/AgentAvatar.tsx); toon-head avatars don't use it.
export const MWA_BRAND_BG = '5168ff';

/**
 * Avatar interface representing a single avatar
 */
export interface Avatar {
  id: string;           // DiceBear seed (e.g. "<userId>#2") or legacy "angel_NNN"
  image_url: string;    // SVG data URI (toon) or IPFS image URL (legacy angel)
  metadata_url: string; // Empty for toons, IPFS URL for legacy angels
}

// Build the toon-head style once at module load.
const toonStyle = new Style(toonHeadDefinition as unknown as ConstructorParameters<typeof Style>[0]);

/**
 * Renders a toon-head SVG data URI from a seed string.
 */
function buildToonDataUri(seed: string): string {
  const svg = new DiceBearAvatar(toonStyle, { seed }).toString();
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Deterministic seed for the Nth avatar option of a given user/base seed.
 * The seed IS the avatar id, so an id alone is enough to re-render the avatar.
 */
function optionSeed(userSeed: string, index: number): string {
  return `${userSeed}#${index}`;
}

/**
 * Converts an ipfs:// URI to an HTTPS gateway URL (legacy angel support)
 */
function ipfsToHttp(ipfsUri: string): string {
  if (ipfsUri.startsWith('ipfs://')) {
    return IPFS_GATEWAY + ipfsUri.slice(7);
  }
  return ipfsUri;
}

// In-memory cache for angel metadata (legacy, tokenId -> image URL)
const angelImageCache = new Map<number, string>();

/**
 * Fetches the image URL for an Academic Angel token from IPFS metadata.
 * Legacy — used for agents and existing users who have an angel avatar.
 */
async function fetchAngelImageUrl(tokenId: number): Promise<string> {
  const cached = angelImageCache.get(tokenId);
  if (cached) return cached;

  const metadataUrl = `${ANGELS_METADATA_BASE}/${tokenId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(metadataUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch angel metadata for token ${tokenId}: ${res.statusText}`);
    }
    const metadata = await res.json();
    const imageUrl = ipfsToHttp(metadata.image);
    angelImageCache.set(tokenId, imageUrl);
    return imageUrl;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gets deterministically assigned avatars for a user.
 * Returns 6 unique toons — all generated locally, no network calls.
 *
 * Same user seed always returns the same 6 avatars.
 */
export function getAssignedAvatars(userSeed: string): Avatar[] {
  const avatars: Avatar[] = [];
  for (let i = 0; i < AVATARS_PER_USER; i++) {
    const seed = optionSeed(userSeed, i);
    avatars.push({
      id: seed,
      image_url: buildToonDataUri(seed),
      metadata_url: '',
    });
  }
  return avatars;
}

/**
 * Validates that an avatar ID is in the user's assigned set
 */
export function isAvatarValidForUser(userSeed: string, avatarId: string): boolean {
  for (let i = 0; i < AVATARS_PER_USER; i++) {
    if (optionSeed(userSeed, i) === avatarId) return true;
  }
  return false;
}

/**
 * Gets a single avatar by its ID.
 * Supports toon seeds (any non-empty string) and legacy angel IDs (angel_NNN).
 */
export async function getAvatarByAvatarId(avatarId: string): Promise<Avatar | null> {
  if (!avatarId) return null;

  // Legacy Academic Angel format: angel_NNN (agents + existing users)
  const angelMatch = avatarId.match(/^angel_(\d{2,3})$/);
  if (angelMatch) {
    const tokenId = parseInt(angelMatch[1], 10);
    if (tokenId < 1 || tokenId > TOTAL_ANGELS) return null;
    try {
      const imageUrl = await fetchAngelImageUrl(tokenId);
      return {
        id: avatarId,
        image_url: imageUrl,
        metadata_url: `${ANGELS_METADATA_BASE}/${tokenId}`,
      };
    } catch (err) {
      console.error(`Failed to fetch angel avatar ${avatarId}:`, err);
      return null;
    }
  }

  // Otherwise the id is a DiceBear seed — render the toon deterministically.
  return {
    id: avatarId,
    image_url: buildToonDataUri(avatarId),
    metadata_url: '',
  };
}

/**
 * Returns a sample of Academic Angel avatars for the agent avatar picker.
 *
 * Agents use Academic Angel artwork so they are visually distinct from humans,
 * who get toons. Angel images live on IPFS, so this oversamples random token
 * ids, resolves them in parallel, and returns up to `count` that loaded.
 */
export async function getAngelAvatars(count = 8): Promise<Avatar[]> {
  const target = Math.min(count, TOTAL_ANGELS);
  const tokenIds = new Set<number>();
  while (tokenIds.size < Math.min(target * 2, TOTAL_ANGELS)) {
    tokenIds.add(1 + Math.floor(Math.random() * TOTAL_ANGELS));
  }

  const resolved = await Promise.allSettled(
    [...tokenIds].map((tokenId) =>
      getAvatarByAvatarId(`angel_${String(tokenId).padStart(2, '0')}`)
    )
  );

  const avatars: Avatar[] = [];
  for (const result of resolved) {
    if (result.status === 'fulfilled' && result.value) avatars.push(result.value);
    if (avatars.length >= target) break;
  }
  return avatars;
}
