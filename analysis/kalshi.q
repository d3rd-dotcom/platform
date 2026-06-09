// Kalshi market analytics
// Run: QHOME=~/Downloads/m64 QLIC=~/Downloads/m64/m64 ~/Downloads/m64/m64/q analysis/kalshi.q

// ── Load ──
// Columns: ts,category,ticker,event_ticker,yes_bid,yes_ask,no_bid,no_ask,last_price,volume_24h,liquidity,close_time,score
d: ("*SSSFFFFFFFSF"; enlist ",") 0: `$"data/kalshi-snapshots.csv";

// Strip trailing Z then parse timestamps (q needs no Z suffix)
d: update ts: "P"$-1_'ts from d;

show "Loaded ", (string count d), " rows across ", (string count distinct d`ts), " snapshots";

// ── 1. Score by category ──
show "--- Score by category (scored markets only) ---";
show select avg_score: avg score, med_score: med score, count_markets: count i
     by category from d where score > 0;

// ── 2. Bid-ask spread by category ──
show "--- Avg bid-ask spread by category ---";
show select avg_spread: avg yes_ask - yes_bid by category from d where score > 0;

// ── 3. Score filter rate per day ──
show "--- Score filter rate by day ---";
show select total: count i, scored: sum score > 0, pct_pass: (sum score > 0) % count i
     by `date$ts from d;

// ── 4. Top 10 markets by avg 24h volume ──
show "--- Top 10 markets by avg 24h volume ---";
show 10 sublist `avg_vol24 xdesc
  select avg_vol24: avg volume_24h, category: first category, event_ticker: first event_ticker
  by ticker from d;

// ── 5. Most contested markets (highest yes_ask stddev) ──
show "--- Top 10 most contested markets ---";
show 10 sublist `stddev_ask xdesc
  select stddev_ask: dev yes_ask, category: first category, snapshots: count i
  by ticker from d where score > 0;

// ── 6. Drift detection ──
// Markets with a consistent directional move over the last 24h of snapshots.
// Signal-to-noise = abs(net_move) / stddev — high means clean directional trend.
show "--- Drifting markets (last 24h, move >= 0.05, signal/noise >= 1.5) ---";
recent: select from d where ts >= (max ts) - 0D23:59;
drifts: select
    first_ask:  first yes_ask,
    last_ask:   last yes_ask,
    net_move:   last[yes_ask] - first[yes_ask],
    stddev_ask: dev yes_ask,
    snapshots:  count i,
    category:   first category,
    event:      first event_ticker
  by ticker
  from `ts xasc recent
  where score > 0;
drifts: update snr: abs[net_move] % (stddev_ask | 0.001) from drifts;
show `net_move xdesc select ticker, category, net_move, first_ask, last_ask, snr
  from drifts
  where snapshots > 3, abs[net_move] >= 0.05, snr >= 1.5;
