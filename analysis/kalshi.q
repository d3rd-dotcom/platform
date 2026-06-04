// Kalshi market analytics
// Run: QHOME=~/m64 QLIC=~/m64/m64 ~/m64/m64/q analysis/kalshi.q

// ── Load ──
// Columns: ts,category,ticker,event_ticker,yes_bid,yes_ask,no_bid,no_ask,last_price,volume_24h,liquidity,close_time,score
d: ("*SSSFFFFFFFSF"; enlist ",") 0: `$"data/kalshi-snapshots.csv";

// Parse ts string into timestamp
d: update ts: "P"$ts from d;

show "Loaded ", (string count d), " rows across ", (string count distinct d`ts), " snapshots";

// ── 1. Score by category ──
show "--- Score by category (scored markets only) ---";
show select avg_score: avg score, med_score: med score, count_markets: count i
     by category
     from d where score > 0;

// ── 2. Price drift for the most-tracked market ──
top_ticker: first exec ticker from
  select count i by ticker from d where score > 0, count[i] = max count i;
show "--- yes_ask drift for: ", string top_ticker, " ---";
show select ts, yes_bid, yes_ask, score from d where ticker = top_ticker;

// ── 3. Bid-ask spread by category ──
show "--- Avg bid-ask spread by category ---";
show select avg_spread: avg yes_ask - yes_bid by category from d where score > 0;

// ── 4. Score filter rate per snapshot ──
show "--- Score filter rate per snapshot ---";
show select total: count i, scored: sum score > 0, pct_pass: (sum score > 0) % count i
     by ts from d;

// ── 5. Top 10 markets by avg 24h volume ──
show "--- Top 10 markets by avg 24h volume ---";
show 10 sublist `avg_vol24 xdesc
  select avg_vol24: avg volume_24h, category: first category, event_ticker: first event_ticker
  by ticker from d;

// ── 6. Most contested markets (highest yes_ask stddev) ──
show "--- Top 10 most contested markets ---";
show 10 sublist `stddev_ask xdesc
  select stddev_ask: dev yes_ask, category: first category, snapshots: count i
  by ticker from d where score > 0;
