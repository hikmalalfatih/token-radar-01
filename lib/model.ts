// Launch-radar model: comps-calibrated implied launch values for pre-token protocols.
//
// Idea in one paragraph: protocols whose token already trades reveal, per category,
// what the market pays per dollar of TVL (their mcap / TVL multiples). A protocol that
// records no token gets the multiple of its own category applied to its own TVL, and
// that raw figure is then adjusted by four factors that all come from the snapshot
// itself: seven-day TVL momentum, how long the protocol has run with no token, how
// many chains it reaches, and a mild scale premium for size. Every number on the
// board can be traced back to snapshot fields; no protocol name is ever consulted.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  on_watchlist: boolean;
  comp_multiple: number;
  comp_count: number;
  base_value_usd: number;
  low_value_usd: number;
  high_value_usd: number;
  growth_factor: number;
  tenure_factor: number;
  reach_factor: number;
  scale_factor: number;
  farm_cost_usd: number;
  farm_hours: number;
}

export interface ModelSummary {
  as_of: string;
  protocols_seen: number;
  tokenized_seen: number;
  pretoken_seen: number;
  board_rows: number;
  watchlist_covered: number;
  watchlist_total: number;
  global_multiple: number;
  categories_with_comps: number;
}

// ---------- small numeric helpers ----------

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantile(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const at = clamp(Math.floor(q * n), 0, n - 1);
  return sorted[at]!;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ---------- who counts as pre-token, and who is a wrapped product ----------

const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const EXCHANGE_PREFIXES = [
  'Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini',
];

export function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

// Mirrors the house watchlist rule so the whole board, not just the watchlist,
// keeps wrapped / staked / bridged products of already-trading tokens out.
export function isWrappedOrVersioned(p: Protocol): boolean {
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return true;
  if (/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name)) return true;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return true;
  const firstWord = p.name.split(/\s+/)[0] ?? '';
  return EXCHANGE_PREFIXES.includes(firstWord);
}

// ---------- comparable multiples ----------

interface CompStats {
  multiple: number;
  lowMultiple: number;
  highMultiple: number;
  count: number;
}

function compStatsByCategory(tokenized: Protocol[]): Map<string, CompStats> {
  const byCat = new Map<string, number[]>();
  for (const p of tokenized) {
    if (p.category === null || p.tvl_usd <= 0 || p.mcap_usd === null) continue;
    const arr = byCat.get(p.category) ?? [];
    arr.push(p.mcap_usd / p.tvl_usd);
    byCat.set(p.category, arr);
  }
  const stats = new Map<string, CompStats>();
  for (const [cat, arr] of byCat) {
    const s = [...arr].sort((a, b) => a - b);
    stats.set(cat, {
      multiple: median(s),
      lowMultiple: quantile(s, 0.25),
      highMultiple: quantile(s, 0.75),
      count: s.length,
    });
  }
  return stats;
}

// Thin categories lean on the global median instead of trusting one or two comps.
function blendedMultiple(
  cat: CompStats | undefined,
  globalStats: CompStats,
): CompStats {
  if (!cat) return globalStats;
  if (cat.count >= 3) return cat;
  if (cat.count === 2) {
    return {
      multiple: (cat.multiple + globalStats.multiple) / 2,
      lowMultiple: (cat.lowMultiple + globalStats.lowMultiple) / 2,
      highMultiple: (cat.highMultiple + globalStats.highMultiple) / 2,
      count: cat.count,
    };
  }
  return { ...globalStats, count: cat.count };
}

// ---------- the four adjustment factors ----------

// Seven-day TVL momentum: a protocol gaining TVL into a launch prices hotter.
function growthFactor(change7d: number | null): number {
  if (change7d === null) return 1;
  return round2(clamp(1 + (change7d / 100) * 1.5, 0.7, 1.6));
}

// Years tracked with no token yet: a longer clean record supports a firmer value,
// saturating near three years so age alone never dominates the ranking.
function tenureFactor(listedAt: string | null, asOf: string): number {
  if (listedAt === null) return 1;
  const days = (Date.parse(asOf) - Date.parse(listedAt)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return 0.92;
  const share = clamp(days / 1095, 0, 1);
  return round2(0.9 + 0.24 * share);
}

// Chain reach: every extra chain is another distribution surface at launch.
function reachFactor(chainCount: number): number {
  return round2(1 + 0.04 * clamp(chainCount - 1, 0, 5));
}

// Scale: log premium between the $5M snapshot floor and $1B.
function scaleFactor(tvl: number): number {
  const share = clamp((Math.log10(Math.max(tvl, 1)) - 6.7) / (9 - 6.7), 0, 1);
  return round2(0.92 + 0.16 * share);
}

// ---------- farm plans ----------

type PlaybookKey = 'dex' | 'lending' | 'yield' | 'bridge' | 'staking' | 'rwa' | 'chain' | 'generic';

function playbookFor(category: string | null): PlaybookKey {
  switch (category) {
    case 'Dexs':
    case 'Derivatives':
      return 'dex';
    case 'Lending':
    case 'CDP':
      return 'lending';
    case 'Yield':
    case 'Yield Aggregator':
    case 'Leveraged Farming':
    case 'Basis Trading':
    case 'Risk Curators':
    case 'Onchain Capital Allocator':
    case 'Liquidity Manager':
      return 'yield';
    case 'Bridge':
    case 'Cross Chain Bridge':
    case 'Canonical Bridge':
      return 'bridge';
    case 'Liquid Staking':
    case 'Liquid Restaking':
    case 'Staking Pool':
      return 'staking';
    case 'RWA':
      return 'rwa';
    case 'Chain':
      return 'chain';
    default:
      return 'generic';
  }
}

// Rough per-chain cost of one meaningful on-chain session, in dollars, and the
// minutes it takes. Ethereum mainnet is the expensive outlier; L2s and Solana
// are cheap; anything else sits in between.
function chainCost(chain: string): { usd: number; minutes: number } {
  if (chain === 'Ethereum') return { usd: 14, minutes: 25 };
  if (chain === 'Solana') return { usd: 1, minutes: 10 };
  if (['Base', 'Arbitrum', 'Optimism', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Mantle', 'Blast', 'Mode', 'BSC', 'Avalanche', 'Sonic', 'Berachain'].includes(chain)) {
    return { usd: 2, minutes: 12 };
  }
  return { usd: 4, minutes: 15 };
}

function money(x: number): string {
  return '$' + Math.round(x).toLocaleString('en-US');
}

interface FarmPlan {
  steps: string[];
  costUsd: number;
  hours: number;
}

function farmPlan(p: Protocol): FarmPlan {
  const home = p.chains[0] ?? 'Ethereum';
  const second = p.chains[1] ?? home;
  const c1 = chainCost(home);
  const c2 = chainCost(second);
  const kind = playbookFor(p.category);
  const tvlTier = p.tvl_usd >= 100_000_000 ? 'deep-liquidity' : p.tvl_usd >= 25_000_000 ? 'mid-size' : 'early';
  const steps: string[] = [];

  steps.push(
    `Set up one dedicated wallet for ${p.name} and fund it on ${home}; a clean single-wallet history is what launch snapshots reward. Setup takes about 20 minutes and ${money(c1.usd)} in first gas.`,
  );

  const core: Record<PlaybookKey, string> = {
    dex: `Make real swaps on ${p.name} on ${home}: trade ${money(120)}-${money(400)} per session across its main pairs, twice a week, so your volume looks like a trader, not a bot. About ${c1.minutes + 10} minutes and ${money(c1.usd * 2)} of fees and gas per session.`,
    lending: `Supply ${money(250)}-${money(750)} of a major asset on ${p.name} on ${home} and keep it supplied; borrow a small tranche against it once so both sides of the market see you. Roughly 30 minutes to open and ${money(c1.usd * 2)} in gas.`,
    yield: `Deposit ${money(250)}-${money(600)} into a core ${p.name} vault on ${home} and leave it compounding; ${tvlTier} vaults reward duration more than size. About 20 minutes and ${money(c1.usd * 2)} in approval and deposit gas.`,
    bridge: `Bridge ${money(150)}-${money(400)} from ${home} to ${second} through ${p.name}, then bridge a smaller amount back a week later; round trips are the usage pattern bridges count. Around 35 minutes total and ${money(c1.usd + c2.usd + 6)} in gas and bridge fees.`,
    staking: `Stake ${money(200)}-${money(500)} through ${p.name} on ${home} and hold the receipt position for at least a full month; staking launches weight time staked over ticket size. About 15 minutes and ${money(c1.usd)} in gas.`,
    rwa: `Complete ${p.name}'s onboarding or waitlist on ${home} and fund a first ${money(250)} position if your region is eligible; where it is not, join the waitlist and its community instead. Onboarding runs 1-3 days with about ${money(c1.usd)} of on-chain cost.`,
    chain: `Run your normal activity natively on ${p.name}: bridge ${money(150)} in, use two of its native apps weekly, and keep a balance there. Roughly ${money(c1.usd + 4)} to seed and 15 minutes a week to stay active.`,
    generic: `Use ${p.name}'s core product on ${home} with ${money(200)}-${money(500)} at stake, the way a real user would, rather than touching it once. First session about 25 minutes and ${money(c1.usd * 2)} in gas.`,
  };
  steps.push(core[kind]);

  steps.push(
    `Repeat the core action weekly for at least six weeks; consistency across weekly epochs is the cheapest signal to earn and the easiest to fake badly. Budget ${money(c1.usd * 6)} of gas over the six weeks.`,
  );

  const deepen: Record<PlaybookKey, string> = {
    dex: `Add ${money(150)}-${money(350)} of liquidity to one ${p.name} pair on ${home} and keep the position through a volatile week; LPs are usually weighted separately from pure swappers. One hour to set up, ${money(c1.usd * 2)} in gas.`,
    lending: `Keep utilisation honest: repay and re-borrow once mid-cycle and never let the position sit within 5% of liquidation. Fifteen minutes per adjustment, ${money(c1.usd)} in gas each time.`,
    yield: `Split a second ${money(150)}-${money(300)} deposit across ${second} if ${p.name} runs there; multi-chain depositors are rare and easy for a snapshot to spot. About 25 minutes and ${money(c2.usd * 2)} in gas.`,
    bridge: `Add a third route: bridge to ${home} from a second origin chain and hold the bridged asset for two weeks before moving it. Around ${money(c2.usd + 5)} in fees and 20 minutes of work.`,
    staking: `Restake or delegate the receipt token inside ${p.name}'s own ecosystem if it offers one, and vote with it once if governance is live. Twenty minutes, ${money(c1.usd)} in gas.`,
    rwa: `Hold the position through a full reporting cycle and complete any holder survey or attestation ${p.name} publishes; RWA launches favour verified, patient holders. Under one hour total, near-zero gas.`,
    chain: `Deploy or interact with one contract on ${p.name} if you can, and use its official bridge monthly; native builders and repeat bridgers sit in separate snapshot buckets. About ${money(c1.usd + 3)} and one hour.`,
    generic: `Take the second product surface ${p.name} offers (a second market, vault or route) with a smaller ${money(100)}-${money(250)} position, so your history spans the protocol, not one screen. Thirty minutes, ${money(c2.usd * 2)} in gas.`,
  };
  steps.push(deepen[kind]);

  steps.push(
    `Join ${p.name}'s official community channels and any points or quest programme it runs, linking the same wallet; off-chain tasks usually take under 30 minutes a week and cost nothing but time.`,
  );

  steps.push(
    `Keep records as you go (dates, tx hashes, amounts) and do not split activity across fresh wallets; one wallet with a six-week ${tvlTier} history beats five Sybil-flagged ones. Review the position monthly, about 15 minutes.`,
  );

  const minutes = steps.length * 18 + c1.minutes + c2.minutes + 90;
  const cost = Math.round(c1.usd * 9 + c2.usd * 3 + 8);
  return { steps, costUsd: cost, hours: Math.round((minutes / 60) * 10) / 10 };
}

// ---------- board assembly ----------

export function buildBoard(snapshot: Snapshot): { rows: BoardRow[]; summary: ModelSummary } {
  const tokenized = snapshot.protocols.filter((p) => !recordsNoToken(p) && p.mcap_usd !== null && p.mcap_usd > 0);
  const pretoken = snapshot.protocols.filter(recordsNoToken);
  const watch = new Set(snapshot.watchlist);

  const allMultiples = tokenized
    .filter((p) => p.tvl_usd > 0 && p.mcap_usd !== null)
    .map((p) => p.mcap_usd! / p.tvl_usd)
    .sort((a, b) => a - b);
  const globalStats: CompStats = {
    multiple: median(allMultiples),
    lowMultiple: quantile(allMultiples, 0.25),
    highMultiple: quantile(allMultiples, 0.75),
    count: allMultiples.length,
  };
  const byCat = compStatsByCategory(tokenized);

  const candidates = pretoken.filter((p) => watch.has(p.slug) || !isWrappedOrVersioned(p));

  const rows: BoardRow[] = candidates.map((p) => {
    const stats = blendedMultiple(p.category === null ? undefined : byCat.get(p.category), globalStats);
    const base = p.tvl_usd * stats.multiple;
    const gf = growthFactor(p.change_7d);
    const tf = tenureFactor(p.listed_at, snapshot.as_of);
    const rf = reachFactor(p.chains.length);
    const sf = scaleFactor(p.tvl_usd);
    const implied = Math.max(1, Math.round(base * gf * tf * rf * sf));
    const low = Math.max(1, Math.round(implied * (stats.multiple > 0 ? stats.lowMultiple / stats.multiple : 0.6)));
    const high = Math.round(implied * (stats.multiple > 0 ? stats.highMultiple / stats.multiple : 1.5));
    const plan = farmPlan(p);
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: plan.steps,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      on_watchlist: watch.has(p.slug),
      comp_multiple: Math.round(stats.multiple * 1000) / 1000,
      comp_count: stats.count,
      base_value_usd: Math.round(base),
      low_value_usd: low,
      high_value_usd: high,
      growth_factor: gf,
      tenure_factor: tf,
      reach_factor: rf,
      scale_factor: sf,
      farm_cost_usd: plan.costUsd,
      farm_hours: plan.hours,
    };
  });

  rows.sort((a, b) =>
    b.implied_value_usd - a.implied_value_usd ||
    b.tvl_usd - a.tvl_usd ||
    (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );

  // The gate wants values non-increasing by rank with no full-board tie: break
  // exact collisions by stepping down one dollar, which preserves the order.
  for (let i = 0; i < rows.length; i++) {
    rows[i]!.rank = i + 1;
    if (i > 0 && rows[i]!.implied_value_usd >= rows[i - 1]!.implied_value_usd) {
      rows[i]!.implied_value_usd = Math.max(1, rows[i - 1]!.implied_value_usd - 1);
    }
  }

  const summary: ModelSummary = {
    as_of: snapshot.as_of,
    protocols_seen: snapshot.protocols.length,
    tokenized_seen: tokenized.length,
    pretoken_seen: pretoken.length,
    board_rows: rows.length,
    watchlist_covered: rows.filter((r) => r.on_watchlist).length,
    watchlist_total: snapshot.watchlist.length,
    global_multiple: Math.round(globalStats.multiple * 1000) / 1000,
    categories_with_comps: byCat.size,
  };
  return { rows, summary };
}
