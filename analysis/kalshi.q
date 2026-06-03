// Kalshi market analytics
// Load: q analysis/kalshi.q
// Requires: data/kalshi-snapshots.csv (collected by scripts/collect-kalshi-snapshot.ts)

// ── Load ──

// Column types: S=symbol, F=float, *=string (ts and close_time as strings for now)
d: ("*SSSFFFFFFFS*"; enlist ",") 0: `$"data/kalshi-snapshots.csv";

// Parse timestamps into q datetime
d: update ts: "P"$ts, close_time: "P"$close_time from d;

show "Loaded ", (string count d), " rows across ", (string count distinct d`ts), " snapshots";

// ── 1. Score quality by category ──
// Are elections markets genuinely better-balanced than politics/culture/science?
show "--- Score by category (scored markets only) ---";
show select avg_score: avg score, med_score: med score, count_markets: count i
     by category
     from d where score > 0;

// ── 2. Price drift over time for a single market ──
// Pick the most-snapshotted scored ticker to see how its yes_ask moves
top_ticker: first exec ticker from
  select count i by ticker from d where score > 0, count[i] = max count i;

show "--- yes_ask drift for: ", string top_ticker, " ---";
show select ts, yes_bid, yes_ask, score from d where ticker = top_ticker;

// ── 3. Spread analysis ──
// Tight spreads = more liquid markets; which categories have the tightest?
show "--- Avg bid-ask spread by category ---";
show select avg_spread: avg yes_ask - yes_bid by category from d where score > 0;

// ── 4. Score function audit ──
// How many markets score > 0 vs are filtered out each snapshot?
// A very low hit rate means the scoring weights are too aggressive.
show "--- Score filter rate per snapshot ---";
show select
    total:     count i,
    scored:    sum score > 0,
    pct_pass:  (sum score > 0) % count i
  by ts
  from d;

// ── 5. Volume leaders ──
// Which markets have the highest 24h volume across all snapshots?
show "--- Top 10 markets by avg 24h volume ---";
show 10 sublist `avg_vol24 xdesc
  select avg_vol24: avg volume_24h, category: first category, event_ticker: first event_ticker
  by ticker
  from d;

// ── 6. Price stability ──
// Markets where yes_ask barely moves are either certain or illiquid.
// High stddev = interesting / contested.
show "--- Top 10 most contested markets (highest yes_ask stddev) ---";
show 10 sublist `stddev_ask xdesc
  select stddev_ask: dev yes_ask, category: first category, snapshots: count i
  by ticker
  from d where score > 0;
