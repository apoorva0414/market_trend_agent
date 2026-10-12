// Generates src/data/clients.json and src/data/holdings.json from the compact tables below.
// Run with `npm run data`. Values are illustrative; client names are fictional.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetClass, Client, Holding, Mandate, RiskProfile, Tag } from "../src/types";

type Instrument = [name: string, assetClass: AssetClass, currency: string, tags: Tag[], costRatio: number];

const INSTRUMENTS = {
  ust46: ["US Treasury 4.25% 2046", "Bond", "USD", ["long-duration-usd-bonds"], 1.07],
  ust52: ["US Treasury 3.00% 2052", "Bond", "USD", ["long-duration-usd-bonds"], 1.12],
  longig: ["Long-Dated USD IG Corporate Bond Fund", "Fund", "USD", ["long-duration-usd-bonds"], 1.05],
  sdusd: ["Short Duration USD Bond Fund", "Fund", "USD", ["short-duration-bonds"], 0.98],
  cict: ["CapitaLand Integrated Commercial Trust", "Equity", "SGD", ["reits"], 1.06],
  mlt: ["Mapletree Logistics Trust", "Equity", "SGD", ["reits"], 1.15],
  apreit: ["Asia-Pacific REIT Income Fund", "Fund", "SGD", ["reits"], 1.08],
  nvda: ["NVIDIA Corp", "Equity", "USD", ["us-tech"], 0.55],
  msft: ["Microsoft Corp", "Equity", "USD", ["us-tech"], 0.72],
  qqq: ["Invesco QQQ Trust (Nasdaq-100 ETF)", "Fund", "USD", ["us-tech"], 0.78],
  techig: ["US Technology IG Credit Fund", "Fund", "USD", ["us-tech-credit"], 1.02],
  orcl55: ["Oracle Corp 5.50% 2055", "Bond", "USD", ["us-tech-credit"], 1.04],
  meta64: ["Meta Platforms 5.75% 2064", "Bond", "USD", ["us-tech-credit"], 1.03],
  note: ["Worst-of Autocallable Note on NVDA / MSFT / AVGO (60% barrier)", "Structured Product", "USD", ["structured-notes-tech-underlying"], 1.11],
  xom: ["Exxon Mobil Corp", "Equity", "USD", ["energy"], 0.84],
  shel: ["Shell plc ADR", "Equity", "USD", ["energy"], 0.9],
  xle: ["Energy Select Sector SPDR ETF", "Fund", "USD", ["energy"], 0.88],
  sia: ["Singapore Airlines Ltd", "Equity", "SGD", ["airlines"], 0.95],
  cx: ["Cathay Pacific Airways", "Equity", "HKD", ["airlines"], 1.02],
  tencent: ["Tencent Holdings", "Equity", "HKD", ["china-equity"], 1.1],
  baba: ["Alibaba Group ADR", "Equity", "USD", ["china-equity"], 1.25],
  csi300: ["iShares Core CSI 300 ETF", "Fund", "HKD", ["china-equity"], 1.12],
  hsbc: ["HSBC Holdings (HK)", "Equity", "HKD", ["hk-equity"], 0.8],
  aia: ["AIA Group", "Equity", "HKD", ["hk-equity"], 1.1],
  tracker: ["Tracker Fund of Hong Kong", "Fund", "HKD", ["hk-equity"], 1.05],
  asiaig: ["Asia Investment Grade Credit Fund", "Fund", "USD", ["asia-credit"], 0.99],
  asiahy: ["Asia High Yield Bond Fund", "Fund", "USD", ["asia-credit"], 1.08],
  perp: ["Partner Bank A 5.875% USD Perpetual", "Bond", "USD", ["called-usd-perpetual"], 1.04],
  gold: ["Physical Gold ETF", "Fund", "USD", ["gold"], 0.7],
  usd: ["USD cash", "Cash", "USD", ["usd-cash"], 1],
  sgd: ["SGD cash", "Cash", "SGD", ["sgd-cash"], 1],
  sgdfd: ["SGD fixed deposit (6 months)", "Cash", "SGD", ["sgd-cash"], 1],
  sgs: ["Singapore Government Securities 2.875% 2030", "Bond", "SGD", [], 1.0],
  gq: ["Global Quality Equity Fund", "Fund", "USD", [], 0.82],
  jp: ["Japan Equity Fund", "Fund", "USD", [], 0.85],
  eu: ["European Equity Fund", "Fund", "USD", [], 0.9],
  india: ["India Equity Fund", "Fund", "USD", [], 0.8],
  dbs: ["DBS Group Holdings", "Equity", "SGD", [], 0.65],
  sti: ["SPDR Straits Times Index ETF", "Fund", "SGD", [], 0.88],
  mai: ["Global Multi-Asset Income Fund", "Fund", "USD", [], 0.97],
  pe: ["Private Equity Feeder Fund", "Fund", "USD", [], 0.9],
} satisfies Record<string, Instrument>;

type Key = keyof typeof INSTRUMENTS;
/** [instrument, market value in USD thousands, index into the client's banks, barrier distance %] */
type Position = [key: Key, valueK: number, bankIndex?: number, barrierDistancePct?: number];

interface ClientSpec {
  id: string;
  rmId: string;
  name: string;
  mandate: Mandate;
  riskProfile: RiskProfile;
  banks: string[];
  prefersFrequentUpdates: boolean;
  lastContactDate: string;
  notes?: string;
  positions: Position[];
}

const A: Mandate = "Advisory";
const D: Mandate = "Discretionary";

const CLIENTS: ClientSpec[] = [
  // ---------- Kevin Tan (Dedicated ARM) ----------
  {
    // Anchor: rank #1, Discretionary Conservative, about 35% in long-duration USD bonds and REITs.
    id: "c-k1", rmId: "rm-kevin", name: "Eleanor Chua", mandate: D, riskProfile: "Conservative",
    banks: ["DBS", "UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-07-02",
    positions: [
      ["ust46", 1900, 1], ["longig", 1250, 0], ["cict", 700, 0], ["mlt", 500, 0], ["sgs", 2200, 0],
      ["sgdfd", 1500, 0], ["gq", 1800, 1], ["gold", 650, 1], ["usd", 900, 1], ["sgd", 1000, 0],
    ],
  },
  {
    // Anchor: Advisory Growth with a structured note on tech underlyings near its barrier.
    id: "c-k2", rmId: "rm-kevin", name: "Rajesh Menon", mandate: A, riskProfile: "Growth",
    banks: ["UBS"], prefersFrequentUpdates: true, lastContactDate: "2026-10-02",
    notes: "Asked to be told promptly about anything affecting his structured note.",
    positions: [
      ["note", 900, 0, 8], ["nvda", 400], ["msft", 300], ["gq", 1700], ["jp", 900],
      ["india", 700], ["asiaig", 900], ["sdusd", 900], ["gold", 500], ["usd", 800],
    ],
  },
  {
    // Anchor: family account with a note.
    id: "c-k3", rmId: "rm-kevin", name: "Lim Boon Huat & Family", mandate: A, riskProfile: "Balanced",
    banks: ["DBS", "Julius Baer"], prefersFrequentUpdates: false, lastContactDate: "2026-09-29",
    notes: "Family account: separate beneficial owners. Confirm which family member to contact for each position.",
    positions: [
      ["tencent", 1500, 1], ["csi300", 1200, 1], ["hsbc", 1900, 0], ["asiaig", 2000, 1], ["ust52", 1400, 1],
      ["sia", 700, 0], ["gq", 5300, 1], ["dbs", 2500, 0], ["sdusd", 1500, 0], ["usd", 3000, 1],
    ],
  },
  {
    id: "c-k4", rmId: "rm-kevin", name: "Hartono Wijaya", mandate: A, riskProfile: "Aggressive",
    banks: ["UBS", "Bank of Singapore"], prefersFrequentUpdates: false, lastContactDate: "2026-09-21",
    positions: [
      ["xom", 1400, 0], ["shel", 1000, 0], ["xle", 900, 1], ["nvda", 600, 0], ["baba", 900, 1],
      ["gq", 3500, 0], ["jp", 2000, 1], ["asiahy", 1500, 1], ["gold", 1200, 0], ["usd", 2000, 0],
    ],
  },
  {
    id: "c-k5", rmId: "rm-kevin", name: "Sophie Laurent", mandate: A, riskProfile: "Balanced",
    banks: ["Julius Baer"], prefersFrequentUpdates: true, lastContactDate: "2026-10-06",
    positions: [
      ["sia", 500], ["cx", 300], ["tracker", 500], ["ust46", 400], ["gq", 1800],
      ["eu", 900], ["sdusd", 700], ["gold", 400], ["sgd", 500], ["usd", 500],
    ],
  },
  {
    // Holds the perpetual that is called intraday (as a secondary theme).
    id: "c-k6", rmId: "rm-kevin", name: "Dr Amanda Yeo", mandate: D, riskProfile: "Balanced",
    banks: ["DBS", "UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-24",
    positions: [
      ["orcl55", 700, 1], ["meta64", 600, 1], ["qqq", 800, 1], ["perp", 800, 1], ["asiaig", 1200, 0],
      ["gq", 2200, 1], ["mlt", 400, 0], ["sgs", 1300, 0], ["gold", 500, 1], ["sgd", 1000, 0],
    ],
  },
  {
    // Unaffected at 9 AM; enters the list when the perpetual call notice is picked up intraday.
    id: "c-k7", rmId: "rm-kevin", name: "Victor Ong", mandate: D, riskProfile: "Conservative",
    banks: ["Bank of Singapore"], prefersFrequentUpdates: false, lastContactDate: "2026-08-14",
    notes: "Relies on bond coupons for regular income.",
    positions: [["perp", 1000], ["sgs", 1200], ["gq", 900], ["gold", 500], ["sgdfd", 800], ["usd", 600]],
  },
  {
    // Anchor: unaffected by every theme.
    id: "c-k8", rmId: "rm-kevin", name: "Margaret Seah", mandate: A, riskProfile: "Conservative",
    banks: ["DBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-30",
    positions: [["sgs", 1000], ["sgdfd", 600], ["gold", 300], ["dbs", 400], ["gq", 400], ["sdusd", 80], ["usd", 420]],
  },

  // ---------- Sarah Lim (Central ARM) ----------
  {
    id: "c-s1", rmId: "rm-sarah", name: "Chen Wei Ming", mandate: A, riskProfile: "Aggressive",
    banks: ["UBS", "Julius Baer"], prefersFrequentUpdates: true, lastContactDate: "2026-10-05",
    positions: [
      ["nvda", 3000, 0], ["msft", 2200, 0], ["qqq", 2400, 1], ["note", 1500, 0, 14], ["techig", 1400, 1],
      ["gq", 5000, 1], ["baba", 1500, 0], ["pe", 4000, 1], ["gold", 2000, 0], ["usd", 5000, 0],
    ],
  },
  {
    id: "c-s2", rmId: "rm-sarah", name: "Priya Nair", mandate: D, riskProfile: "Conservative",
    banks: ["DBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-25",
    positions: [
      ["ust46", 700], ["cict", 500], ["sdusd", 400], ["sgs", 2900], ["gq", 1000],
      ["asiaig", 700], ["gold", 400], ["sgd", 600],
    ],
  },
  {
    id: "c-s3", rmId: "rm-sarah", name: "Marcus Koh", mandate: A, riskProfile: "Growth",
    banks: ["Bank of Singapore", "UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-01",
    positions: [
      ["xom", 900, 0], ["shel", 700, 0], ["sia", 400, 0], ["tencent", 800, 1], ["tracker", 600, 1],
      ["gq", 3000, 1], ["jp", 1500, 1], ["sdusd", 1200, 0], ["gold", 600, 0], ["usd", 1300, 0],
    ],
  },
  {
    id: "c-s4", rmId: "rm-sarah", name: "Isabelle Fontaine", mandate: A, riskProfile: "Balanced",
    banks: ["Julius Baer"], prefersFrequentUpdates: false, lastContactDate: "2026-09-28",
    positions: [
      ["cict", 500], ["mlt", 400], ["apreit", 500], ["eu", 900], ["gq", 1000],
      ["sgs", 700], ["gold", 300], ["sgd", 500],
    ],
  },
  {
    id: "c-s5", rmId: "rm-sarah", name: "Tan Kok Leong", mandate: D, riskProfile: "Balanced",
    banks: ["DBS", "UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-22",
    notes: "Joint account with spouse. Both sign off on strategy changes.",
    positions: [
      ["asiaig", 2500, 0], ["asiahy", 1000, 0], ["csi300", 1200, 1], ["hsbc", 900, 1], ["orcl55", 800, 1],
      ["gq", 4000, 1], ["sgs", 2500, 0], ["gold", 1000, 1], ["usd", 1300, 1], ["sgd", 1300, 0],
    ],
  },
  {
    id: "c-s6", rmId: "rm-sarah", name: "Farah Abdullah", mandate: A, riskProfile: "Conservative",
    banks: ["DBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-18",
    positions: [["sgs", 800], ["sgdfd", 500], ["mai", 500], ["dbs", 200], ["gold", 200], ["sgd", 400]],
  },
  {
    id: "c-s7", rmId: "rm-sarah", name: "Oliver Hayes", mandate: A, riskProfile: "Growth",
    banks: ["UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-10-01",
    positions: [["gq", 1800], ["eu", 900], ["jp", 800], ["india", 600], ["gold", 400], ["usd", 800], ["nvda", 100]],
  },
  {
    id: "c-s8", rmId: "rm-sarah", name: "Lee Hui Min", mandate: D, riskProfile: "Balanced",
    banks: ["Bank of Singapore"], prefersFrequentUpdates: true, lastContactDate: "2026-10-07",
    positions: [["mai", 2500], ["gq", 2000], ["sgs", 1800], ["sti", 900], ["gold", 600], ["sgd", 700], ["usd", 500]],
  },

  // ---------- Daniel Wong (Central ARM) ----------
  {
    id: "c-d1", rmId: "rm-daniel", name: "Nguyen Thanh Hai", mandate: A, riskProfile: "Aggressive",
    banks: ["UBS", "Standard Chartered"], prefersFrequentUpdates: false, lastContactDate: "2026-09-23",
    positions: [
      ["sia", 4000, 1], ["xle", 1500, 0], ["nvda", 3000, 0], ["qqq", 2500, 0], ["tencent", 5000, 1],
      ["tracker", 1500, 1], ["gq", 9500, 0], ["pe", 6000, 0], ["gold", 3000, 1], ["usd", 6000, 0],
    ],
  },
  {
    id: "c-d2", rmId: "rm-daniel", name: "Grace Halim", mandate: D, riskProfile: "Conservative",
    banks: ["Standard Chartered"], prefersFrequentUpdates: true, lastContactDate: "2026-10-01",
    positions: [["ust52", 1000], ["longig", 800], ["sdusd", 900], ["sgs", 1200], ["mai", 900], ["gold", 400], ["sgd", 800]],
  },
  {
    id: "c-d3", rmId: "rm-daniel", name: "Benjamin Teo", mandate: A, riskProfile: "Growth",
    banks: ["DBS", "UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-26",
    positions: [
      ["note", 1000, 1, 10], ["meta64", 900, 1], ["orcl55", 600, 1], ["msft", 600, 1], ["hsbc", 700, 0],
      ["gq", 3800, 1], ["jp", 1500, 0], ["india", 1300, 0], ["gold", 700, 1], ["usd", 2400, 1],
    ],
  },
  {
    id: "c-d4", rmId: "rm-daniel", name: "Chong Mei Ling", mandate: A, riskProfile: "Balanced",
    banks: ["DBS"], prefersFrequentUpdates: false, lastContactDate: "2026-08-30",
    positions: [
      ["tracker", 500], ["aia", 300], ["cict", 150], ["sti", 700], ["sgs", 800],
      ["gq", 700], ["gold", 250], ["sgd", 500],
    ],
  },
  {
    id: "c-d5", rmId: "rm-daniel", name: "Arjun Kapoor", mandate: A, riskProfile: "Growth",
    banks: ["Standard Chartered"], prefersFrequentUpdates: false, lastContactDate: "2026-09-27",
    positions: [["india", 2000], ["gq", 2300], ["jp", 1000], ["eu", 900], ["gold", 600], ["usd", 1000]],
  },
  {
    id: "c-d6", rmId: "rm-daniel", name: "Helen Sim", mandate: D, riskProfile: "Conservative",
    banks: ["DBS"], prefersFrequentUpdates: false, lastContactDate: "2026-09-19",
    positions: [["sgs", 1600], ["sgdfd", 900], ["mai", 800], ["sti", 400], ["gold", 300], ["sgd", 400]],
  },
  {
    id: "c-d7", rmId: "rm-daniel", name: "Kenji Watanabe", mandate: A, riskProfile: "Balanced",
    banks: ["UBS"], prefersFrequentUpdates: false, lastContactDate: "2026-10-03",
    positions: [["jp", 3000], ["gq", 2500], ["mai", 1500], ["gold", 1200], ["usd", 1800], ["sdusd", 200]],
  },
  {
    id: "c-d8", rmId: "rm-daniel", name: "Stephanie Ng", mandate: D, riskProfile: "Growth",
    banks: ["Bank of Singapore"], prefersFrequentUpdates: false, lastContactDate: "2026-09-16",
    positions: [["gq", 2200], ["eu", 1000], ["india", 800], ["pe", 600], ["gold", 400], ["usd", 600]],
  },
];

/** Small deterministic variation so cost bases differ between clients without using randomness. */
function jitter(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 1 + ((h % 81) - 40) / 1000; // 0.96 to 1.04
}

const clients: Client[] = [];
const holdings: Holding[] = [];

for (const spec of CLIENTS) {
  const { positions, ...rest } = spec;
  const aumUsd = positions.reduce((sum, p) => sum + p[1], 0) * 1000;
  clients.push({ ...rest, aumUsd });
  for (const [key, valueK, bankIndex = 0, barrierDistancePct] of positions) {
    const [instrument, assetClass, currency, tags, costRatio] = INSTRUMENTS[key] as Instrument;
    const marketValueUsd = valueK * 1000;
    const ratio = assetClass === "Cash" ? 1 : costRatio * jitter(spec.id + key);
    holdings.push({
      clientId: spec.id,
      instrument,
      assetClass,
      bank: spec.banks[bankIndex],
      currency,
      marketValueUsd,
      costBasisUsd: Math.round((marketValueUsd * ratio) / 1000) * 1000,
      tags,
      ...(barrierDistancePct !== undefined ? { barrierDistancePct } : {}),
    });
  }
}

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data");
writeFileSync(resolve(dataDir, "clients.json"), JSON.stringify(clients, null, 2) + "\n");
writeFileSync(resolve(dataDir, "holdings.json"), JSON.stringify(holdings, null, 2) + "\n");
console.log(`Wrote ${clients.length} clients and ${holdings.length} holdings to src/data/`);
