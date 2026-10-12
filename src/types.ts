// ---------- Sample data (src/data/*.json) ----------

export const TAGS = [
  "us-tech",
  "us-tech-credit",
  "long-duration-usd-bonds",
  "short-duration-bonds",
  "reits",
  "energy",
  "airlines",
  "china-equity",
  "hk-equity",
  "asia-credit",
  "gold",
  "usd-cash",
  "sgd-cash",
  "structured-notes-tech-underlying",
  // Added for the intraday call-notice theme, which targets one specific bond (see README).
  "called-usd-perpetual",
] as const;

export type Tag = (typeof TAGS)[number];

export type Mandate = "Advisory" | "Discretionary";
export type RiskProfile = "Conservative" | "Balanced" | "Growth" | "Aggressive";
export type AssetClass = "Equity" | "Bond" | "Fund" | "Structured Product" | "Cash";
export type ThemeType = "Pulse" | "View";
export type ScanBatch = "morning" | "intraday";

export interface Rm {
  id: string;
  name: string;
  arm_model: "Dedicated ARM" | "Central ARM";
}

export interface Client {
  id: string;
  rmId: string;
  name: string;
  mandate: Mandate;
  riskProfile: RiskProfile;
  banks: string[];
  aumUsd: number;
  prefersFrequentUpdates: boolean;
  lastContactDate: string;
  notes?: string;
}

export interface Holding {
  clientId: string;
  instrument: string;
  assetClass: AssetClass;
  bank: string;
  currency: string;
  marketValueUsd: number;
  costBasisUsd: number;
  tags: Tag[];
  /** Structured notes only: how far the worst underlying sits above the barrier. */
  barrierDistancePct?: number;
}

export interface NewsItem {
  id: string;
  source: string;
  publishedAt: string;
  headline: string;
  summary: string;
  /** null for items the scan filters out as not market-moving. */
  themeId: string | null;
  relevant: boolean;
  batch: ScanBatch;
}

export interface TagMove {
  tag: Tag;
  estMovePct: number;
}

export interface Theme {
  id: string;
  title: string;
  shortTitle: string;
  type: ThemeType;
  batch: ScanBatch;
  whatHappened: string;
  whyItMatters: string;
  affectedTags: TagMove[];
  prospectAngle: string;
  prospectSuits: string;
  /** Always shown in "Themes for prospects", and featured in the 9 AM email. */
  prospectFeatured?: boolean;
  relevantProductIds: string[];
  /** Plain-language version of what happened, for client-shareable text. */
  clientSummary: string;
  clientTalkingPoint: string;
  /** Theme-specific next step for advisory clients, and its wording for discretionary mandates. */
  clientNextStep?: string;
  clientNextStepDiscretionary?: string;
  /** View themes only: what the RM should stress-test before sharing. */
  stressTest?: string;
  keyRisks: string[];
  likelyQuestions: string[];
  /** Applied when an intraday news item for this theme is picked up by an ad hoc scan. */
  intradayUpdate?: {
    note: string;
    affectedTags: TagMove[];
  };
}

export interface Product {
  id: string;
  name: string;
  assetClass: string;
  tags: Tag[];
  riskLevel: 1 | 2 | 3 | 4 | 5;
  oneLiner: string;
}

export interface HouseViewEntry {
  id: string;
  assetClass: string;
  stance: string;
  view: string;
  /** What the firm would do, as a lower-case phrase. Used by "Add what we'd do next". */
  action: string;
  tags: Tag[];
}

// ---------- Scan output (src/logic) ----------

export interface HoldingImpact {
  holding: Holding;
  tag: Tag;
  estMovePct: number;
  estImpactUsd: number;
  pctOfAum: number;
}

export interface ThemeExposure {
  themeId: string;
  exposureUsd: number;
  exposurePct: number;
  estImpactUsd: number;
  estImpactPct: number;
  holdings: HoldingImpact[];
}

export interface ScoreFactors {
  base: number;
  riskWeight: number;
  mandateWeight: number;
  lossWeight: number;
  contactBoost: number;
  contactReason: string | null;
  score: number;
}

export type NextStepAction = "Talking points" | "Portfolio review";

export interface NextStep {
  action: NextStepAction;
  reason: string;
  rule: 1 | 2 | 3 | 4 | 5;
  flag?: "Barrier risk";
}

export type Priority = "High" | "Medium" | "Low";

export type ThemeStatus = "unchanged" | "updated" | "new";

/** A theme as it stands after a scan: effective moves, sources and intraday status. */
export interface ActiveTheme extends Theme {
  sources: string[];
  newsIds: string[];
  status: ThemeStatus;
  updateNote?: string;
}

export interface ThemeAssessment {
  theme: ActiveTheme;
  exposure: ThemeExposure;
  factors: ScoreFactors;
  nextStep: NextStep;
}

/** How a client row differs from the 9 AM brief after an ad hoc scan. */
export interface ClientChange {
  isNew: boolean;
  /** Positive = moved up the list. */
  rankDelta: number;
  impactChanged: boolean;
}

export interface RankedClient {
  client: Client;
  rank: number;
  priority: Priority;
  primary: ThemeAssessment;
  others: ThemeAssessment[];
  change: ClientChange | null;
}

export interface ProspectTheme {
  theme: ActiveTheme;
  products: Product[];
  featured: boolean;
}

export interface ScanRecord {
  completedAt: string;
  deliveredAt: string;
  itemsRead: number;
  sourceCount: number;
  relevantCount: number;
  themeCount: number;
  affectedClientCount: number;
  adHoc: {
    at: string;
    newItems: number;
    newRelevant: number;
    newThemes: number;
    updatedThemes: number;
    themeCount: number;
    affectedClientCount: number;
  } | null;
}

export interface ScanArgs {
  date: string;
  rmId: string;
  upTo: ScanBatch;
}

export interface ScanResult extends ScanArgs {
  record: ScanRecord;
  news: NewsItem[];
  themes: ActiveTheme[];
  clients: RankedClient[];
  clientCount: number;
  prospectThemes: ProspectTheme[];
}

// ---------- Documents ----------

/** Shared by all three documents: Client or prospect · Theme · Why now · Data as of. */
export interface DocHeader {
  subjectKind: "Client" | "Prospect";
  subject: string;
  themeTitle: string;
  themeType: ThemeType;
  whyNow: string;
  dataAsOf: string;
  preparedFor: string;
  date: string;
}

export interface DocHoldingLine {
  instrument: string;
  assetClass: AssetClass;
  bank: string;
  currency: string;
  marketValueUsd: number;
  pctOfAum: number;
  estMovePct: number;
  estImpactUsd: number;
}

export interface DocProductLine {
  productId: string;
  name: string;
  assetClass: string;
  riskLevel: number;
  oneLiner: string;
}

/** The only part of the talking points that chat can change. */
export interface TalkingPointsWording {
  summary: string;
  talkingPoints: string[];
  nextSteps: string[];
}

/**
 * Talking points are a structured object. Everything except `wording` is a fact field:
 * rendered from portfolio data and never editable through chat.
 */
export interface TalkingPointsDoc {
  id: string;
  kind: "talking-points";
  header: DocHeader;
  clientId: string;
  themeId: string;
  holdings: DocHoldingLine[];
  totalExposureUsd: number;
  totalImpactUsd: number;
  disclaimer: string;
  flag?: "Barrier risk";
  /** The generated first draft (v1). Later versions live in the chat workspace. */
  wording: TalkingPointsWording;
}

export interface PortfolioReviewHandoff {
  handoffId: string;
  kind: "portfolio-review";
  createdAt: string;
  header: DocHeader;
  rm: { id: string; name: string };
  client: {
    id: string;
    name: string;
    mandate: Mandate;
    riskProfile: RiskProfile;
    banks: string[];
    aumUsd: number;
    lastContactDate: string;
    notes?: string;
  };
  theme: { id: string; title: string; type: ThemeType; whatHappened: string; whyItMatters: string; stressTest?: string };
  exposure: { exposureUsd: number; exposurePct: number; estImpactUsd: number; estImpactPct: number };
  recommendation: { action: NextStepAction; reason: string };
  affectedHoldings: DocHoldingLine[];
  otherThemes: { id: string; title: string; exposurePct: number; estImpactUsd: number }[];
  pointsToCover: string[];
  likelyClientQuestions: string[];
  optionsToDiscuss: DocProductLine[];
  /** Free text from the RM for the Portfolio Review agent. */
  rmContext: string;
  /** Gaps the completeness check still found when the RM sent the hand-off. */
  openGaps: string[];
}

export interface ProposalHandoff {
  handoffId: string;
  kind: "proposal";
  createdAt: string;
  header: DocHeader;
  rm: { id: string; name: string };
  theme: { id: string; title: string; type: ThemeType; whatHappened: string; whyItMatters: string; stressTest?: string };
  prospectFit: { profile: string; suits: string; angle: string };
  products: DocProductLine[];
  keyRisks: string[];
  /** Free text from the RM for the Proposal agent. */
  rmContext: string;
  /** Gaps the completeness check still found when the RM sent the hand-off. */
  openGaps: string[];
}

export type Handoff = PortfolioReviewHandoff | ProposalHandoff;

/** Neutral layout model. The on-screen view, the .docx and the plain text all render from it. */
export type DocBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; columns: string[]; rows: string[][]; numericFrom?: number; totalRow?: boolean }
  | { kind: "note"; text: string };

export interface DocSection {
  heading: string;
  blocks: DocBlock[];
}

export interface DocModel {
  title: string;
  audience: "Client-shareable" | "Internal";
  header: { label: string; value: string }[];
  sections: DocSection[];
  fileName: string;
}

// ---------- Checkpoint and activity log ----------

export type ClientAction = "Talking points" | "Portfolio review" | "Skip";

export type ActItem =
  | { kind: "talking-points"; clientId: string }
  | { kind: "portfolio-review"; clientId: string }
  | { kind: "proposal"; themeId: string; profile: string };

export type LogType =
  | "Approved"
  | "Contacted"
  | "Portfolio review"
  | "Prospect"
  | "No action"
  | "Downloaded"
  | "Shared"
  | "Scan";

export interface LogEntry {
  id: string;
  timestamp: string;
  rmId: string;
  rmName: string;
  type: LogType;
  subject: string;
  theme: string;
  detail: string;
}

// ---------- Talking points chat (update 1) ----------

export type QuickAction = "shorter" | "conservative" | "whatsapp" | "mandarin" | "next" | "personal";

export interface TpVersion {
  /** 1 is the generated draft. Every later edit or restore adds one. */
  n: number;
  wording: TalkingPointsWording;
  origin: "draft" | "chat" | "restore";
  /** Short description for the version list, e.g. "WhatsApp length". */
  note: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "agent" | "rm";
  text: string;
  /** Version this agent reply created, if any. */
  version?: number;
  /** Small notice under the reply, e.g. when invented figures were rejected. */
  notice?: string;
  /** Muted helper text under the reply. */
  hint?: string;
}

export interface Approval {
  version: number;
  by: string;
  at: string;
}

export interface TpWorkspace {
  versions: TpVersion[];
  /** Version number shown in the document pane. */
  viewing: number;
  messages: ChatMessage[];
  /** Number of instructions the RM has sent. */
  rounds: number;
  approval: Approval | null;
  /** True after "Unlock to edit": chat is open again, and the next edit clears the approval. */
  unlocked: boolean;
}

/** Figures the model may quote but never change. Everything is pre-formatted exactly as shown to the RM. */
export interface LockedFacts {
  clientName: string;
  themeTitle: string;
  whyNow: string;
  dataAsOf: string;
  holdings: { instrument: string; value: string; pctOfPortfolio: string; estMove: string; estImpact: string }[];
  totals: { exposure: string; exposureShare: string; estImpact: string; estImpactPct: string; portfolio: string };
  versusPurchaseCost: string;
  barrierDistance?: string;
  lastContact: { iso: string; spoken: string };
  options: { name: string; riskLevel: string }[];
  otherThemes: string[];
  disclaimer: string;
}

/** POST /api/refine-talking-points */
export interface RefineRequest {
  currentDoc: TalkingPointsWording & { disclaimer: string };
  factsLocked: LockedFacts;
  theme: { title: string; type: ThemeType; whatHappened: string; whyItMatters: string; clientSummary: string; stressTest?: string };
  client: { name: string; mandate: Mandate; riskProfile: RiskProfile; notes?: string };
  houseView: { assetClass: string; stance: string; view: string }[];
  instruction: string;
  history: { role: "agent" | "rm"; text: string }[];
}

export interface RefineResponse {
  updatedDoc: TalkingPointsWording & { disclaimer: string };
  reply: string;
  /** Wording fields where the model's text was discarded because it contained a figure that is not in the source data. */
  rejectedFields: (keyof TalkingPointsWording)[];
}
