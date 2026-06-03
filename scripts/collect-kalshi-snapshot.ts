/**
 * Appends a snapshot of live Kalshi market data to data/kalshi-snapshots.csv.
 *
 * Run manually:   npx tsx scripts/collect-kalshi-snapshot.ts
 * Schedule via cron (every 15 min):
 *   crontab -e  →  add:  * /15 * * * * cd /path/to/MentalWealthAcademy && npx tsx scripts/collect-kalshi-snapshot.ts >> /tmp/kalshi-collector.log 2>&1
 *
 * CSV columns:
 *   ts, category, ticker, event_ticker, yes_bid, yes_ask, no_bid, no_ask,
 *   last_price, volume_24h, liquidity, close_time, score
 */

import fs from 'fs';
import path from 'path';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const OUT_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'kalshi-snapshots.csv');

const HEADER = 'ts,category,ticker,event_ticker,yes_bid,yes_ask,no_bid,no_ask,last_price,volume_24h,liquidity,close_time,score';

const CATEGORY_MAP: Record<string, string> = {
  Elections: 'elections',
  Politics: 'politics',
  Entertainment: 'culture',
  Social: 'culture',
  'Science and Technology': 'science',
};

const MAX_DAYS_OUT = 730;
const EVENTS_PAGE_LIMIT = 200;
const MAX_EVENT_PAGES = 4;

function num(s: string | number | null | undefined, fallback = 0): number {
  if (s == null) return fallback;
  const n = typeof s === 'number' ? s : parseFloat(s as string);
  return isFinite(n) ? n : fallback;
}

function score(yesBid: number, yesAsk: number, lastPrice: number, volume24h: number, closeTime: string): number {
  const bid = yesBid;
  const ask = yesAsk;
  const last = lastPrice;
  const placeholder = bid === 0 && ask === 1;

  let yes: number;
  if (!placeholder && bid > 0 && ask > 0) yes = (bid + ask) / 2;
  else if (last > 0) yes = last;
  else if (ask > 0 && ask < 1) yes = ask;
  else yes = 0;

  yes = Math.max(0, Math.min(1, yes));
  if (yes <= 0.02 || yes >= 0.98) return -1;

  const now = Date.now();
  const maxMs = MAX_DAYS_OUT * 86_400_000;
  const endMs = closeTime ? new Date(closeTime).getTime() - now : Infinity;
  if (endMs <= 0 || endMs > maxMs) return -1;

  const balance = 1 - Math.abs(yes - 0.5) * 2;
  const proximity = 1 - endMs / maxMs;
  return balance * 0.40 + Math.min(volume24h / 10_000, 1.0) * 0.25 + proximity * 0.35;
}

async function fetchPage(cursor?: string): Promise<{ events: any[]; cursor: string | null }> {
  const params = new URLSearchParams({
    status: 'open',
    with_nested_markets: 'true',
    limit: String(EVENTS_PAGE_LIMIT),
  });
  if (cursor) params.set('cursor', cursor);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${KALSHI_BASE}/events?${params}`, { cache: 'no-store' });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
        continue;
      }
      if (!res.ok) return { events: [], cursor: null };
      const json = await res.json();
      return { events: json.events || [], cursor: json.cursor || null };
    } catch {
      return { events: [], cursor: null };
    }
  }
  return { events: [], cursor: null };
}

async function main() {
  const dataDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const writeHeader = !fs.existsSync(OUT_FILE);
  const stream = fs.createWriteStream(OUT_FILE, { flags: 'a' });
  if (writeHeader) stream.write(HEADER + '\n');

  const ts = new Date().toISOString();
  let rows = 0;

  let cursor: string | undefined;
  for (let page = 0; page < MAX_EVENT_PAGES; page++) {
    const { events, cursor: next } = await fetchPage(cursor);

    for (const evt of events) {
      const category = CATEGORY_MAP[evt.category];
      if (!category) continue;

      for (const m of evt.markets || []) {
        const yesBid  = num(m.yes_bid_dollars);
        const yesAsk  = num(m.yes_ask_dollars);
        const noBid   = num(m.no_bid_dollars);
        const noAsk   = num(m.no_ask_dollars);
        const last    = num(m.last_price_dollars);
        const vol24   = num(m.volume_24h_fp);
        const liq     = num(m.liquidity_dollars);
        const s       = score(yesBid, yesAsk, last, vol24, m.close_time ?? '');

        // Escape any commas in close_time (ISO strings won't have them, but be safe)
        const closeTime = (m.close_time ?? '').replace(/,/g, '');

        stream.write(
          `${ts},${category},${m.ticker},${m.event_ticker},${yesBid},${yesAsk},${noBid},${noAsk},${last},${vol24},${liq},${closeTime},${s.toFixed(6)}\n`
        );
        rows++;
      }
    }

    if (!next) break;
    cursor = next;
  }

  stream.end();
  console.log(`[${ts}] wrote ${rows} rows → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('collect-kalshi-snapshot failed:', err);
  process.exit(1);
});
