/**
 * Diamond prices for shop items, shared by the client (display + burn amount)
 * and the server (authoritative price for burn verification). The server never
 * trusts a client-supplied amount — it looks the price up here by item id.
 *
 * Diamonds are the fun, spendable currency: prices are set to feel affordable
 * to an engaged learner, not punishing. Paying with diamonds is a real burn
 * (a token sink), so it is offered as an alternative to the USDC price.
 */
export const SHOP_DIAMOND_PRICES: Record<string, number> = {
  shirt: 650,
  journal: 700,
  hoodie: 1300,
  'pin-set': 450,
  snapback: 600,
  'blue-world': 350,
  magazine: 250,
  labcoat: 1450,
  tote: 350,
  headphones: 2700,
  keycard: 150,
  'sticker-pack': 100,
  sneakers: 3300,
  lanyard: 200,
  notebook: 250,
  'starter-kit': 2800,
};

export function getDiamondPrice(itemId: string): number | null {
  return SHOP_DIAMOND_PRICES[itemId] ?? null;
}
