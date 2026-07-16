// ============================================================================
// Affiliate link tagging + safe-default fallback for outbound material links
// (guide "Materials for this guide" marketplace surface — Phase 6).
//
// Fail-open by design: this is a link-rendering path, not a money path. Any
// malformed URL, unsupported host, or missing env var falls back to passing
// the URL through unchanged — a bad affiliate tag must never crash the page
// or block the link. (Money/backend paths elsewhere in the app stay
// fail-closed; this file is intentionally the opposite.)
// ============================================================================

/** Amazon storefronts we know how to tag. Extend as more retailers are added. */
const AMAZON_HOSTS = new Set([
  'amazon.com',
  'www.amazon.com',
  'amazon.co.uk',
  'www.amazon.co.uk',
  'amazon.ca',
  'www.amazon.ca',
]);

/**
 * MWA's Amazon Associates tag. Must be set via env for tagging to activate;
 * unset today (no affiliate ID has been created for this project yet).
 */
function getAmazonTag(): string | null {
  const tag = process.env.NEXT_PUBLIC_MWA_AMAZON_TAG;
  return typeof tag === 'string' && tag.trim() ? tag.trim() : null;
}

/** True if `rawUrl` is a non-empty, well-formed http(s) URL. */
export function isUsableLink(rawUrl: string | null | undefined): rawUrl is string {
  if (!rawUrl || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Appends the MWA Amazon affiliate tag to a supported retailer URL. Any
 * other host, an invalid URL, or an unset tag env var returns the URL
 * unchanged — fail-open.
 */
export function withAffiliateTag(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return rawUrl;

  if (AMAZON_HOSTS.has(parsed.hostname)) {
    const tag = getAmazonTag();
    if (!tag) return rawUrl;
    parsed.searchParams.set('tag', tag);
    return parsed.toString();
  }

  return rawUrl;
}

/** True if `withAffiliateTag` would actually tag this URL right now. */
export function isAffiliateLink(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return AMAZON_HOSTS.has(parsed.hostname) && Boolean(getAmazonTag());
  } catch {
    return false;
  }
}

/**
 * Default outbound link for a material with no usable URL — a Bookshop.org
 * search built from the material's name, so a broken/missing link never
 * renders dead. Bookshop's own affiliate program is a separate query param
 * (?affiliate=) and isn't wired up yet; this just guarantees a live link.
 */
export function defaultMaterialSearchLink(name: string | null | undefined): string {
  const query = encodeURIComponent((name || '').trim() || 'book');
  return `https://bookshop.org/search?keywords=${query}`;
}

/**
 * Resolves the final outbound URL (falling back to a search link when the
 * material has no usable url) and whether it ended up affiliate-tagged.
 */
export function resolveOutboundLink(
  rawUrl: string | null | undefined,
  name: string | null | undefined,
): { url: string; isAffiliate: boolean } {
  const base = isUsableLink(rawUrl) ? rawUrl : defaultMaterialSearchLink(name);
  return { url: withAffiliateTag(base), isAffiliate: isAffiliateLink(base) };
}
