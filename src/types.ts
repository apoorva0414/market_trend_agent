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
  /** Next scheduled six-monthly portfolio review. */
  nextReviewDate: string;
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
  /** Few words naming the cause, for Client Alert subjects: "US rate move". */
  alertCause: string;
  /** Phrases for the brief's summary sentence: "A rates-driven morning: yields up after Fed signals, with oil also in focus." */
  briefTone: string;
  briefHeadline: string;
  briefMention: string;
  whatHappened: string;
  whyItMatters: string;
  affectedTags: TagMove[];
  /** Plain-language version of what happened, for client-shareable text. */
  clientSummary: string;
  clientTalkingPoint: string;
  /** Theme-specific next step for advisory clients, and its wording for discretionary mandates. */
  clientNextStep?: string;
  clientNextStepDiscretionary?: string;
  /** View themes only: what the RM should stress-test before sharing. */
  stressTest?: string;
  /** Applied when an intraday news item for this theme is picked up by an ad hoc scan. */
  intradayUpdate?: {
    note: string;
    affectedTags: TagMove[];
  };
}

export type PositionEventType = "Call notice" | "Downgrade" | "Barrier proximity" | "Default";

/** An event on one specific holding. It alerts every client who holds that instrument (update 2, 4.2). */
export interface PositionEvent {
  id: string;
  batch: ScanBatch;
  eventType: PositionEventType;
  /** Matches holdings[].instrument exactly. */
  instrument: string;
  headline: string;
  description: string;
  publishedAt: string;
  /**
   * Optional theme-like content, so talking points can be drafted for a client whose only
   * link to today's news is this event. The tag moves give the estimated effect on the holding.
   */
  narrative?: Pick<
    Theme,
    "title" | "shortTitle" | "whatHappened" | "whyItMatters" | "affectedTags" | "clientSummary" | "clientTalkingPoint" | "clientNextStep" | "clientNextStepDiscretionary"
  >;
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

export type Priority = "High" | "Medium" | "Low";

export type ThemeStatus = "unchanged" | "updated" | "new";

/** A theme as it stands after a scan: effective moves, sources and intraday status. */
export interface ActiveTheme extends Theme {
  sources: string[];
  newsIds: string[];
  status: ThemeStatus;
  updateNote?: string;
  /** Set when this "theme" is the narrative of a position event rather than a market theme. */
  positionEventId?: string;
}

export interface ThemeAssessment {
  theme: ActiveTheme;
  exposure: ThemeExposure;
  factors: ScoreFactors;
  /** Set when the client holds a structured note this theme moves towards its barrier. */
  flag?: "Barrier risk";
}

/** How a client row differs from the 9 AM brief after an ad hoc scan. */
export interface RankedClient {
  client: Client;
  rank: number;
  priority: Priority;
  primary: ThemeAssessment;
  others: ThemeAssessment[];
}

/** What the system knows about one RM's book at a moment in the day: the items received so far, matched to holdings. */
export interface BookState {
  date: string;
  rmId: string;
  /** "HH:MM" SGT, inclusive: every item published at or before this time has been received. */
  at: string;
  news: NewsItem[];
  /** Market themes formed from the news received so far. */
  themes: ActiveTheme[];
  /** Position events received so far. */
  positionEvents: PositionEvent[];
  /** Clients with exposure to a market theme or a position event, ordered by priority score. */
  clients: RankedClient[];
  clientCount: number;
}

/** One theme as it appears in the MarketPulse Daily Brief: tailored to the RM's book with counts only. */
export interface BriefTheme {
  theme: ActiveTheme;
  /** Clients of this RM holding anything the theme moves. */
  clientsExposed: number;
  /** Readable names of the asset types those clients hold, e.g. "long-duration USD bonds or REITs". */
  assetTypes: string;
}

/** Output of the daily brief job: everything the 9 AM email says. */
export interface DailyBrief {
  date: string;
  rmId: string;
  generatedAt: string;
  deliveredAt: string;
  /** Ordered by relevance to the RM's book. */
  themes: BriefTheme[];
  events: { event: PositionEvent; holders: number }[];
  houseView: { assetClass: string; stance: string }[];
  /** Clients with some exposure today. A count, never names. */
  clientsExposed: number;
}

/** A news item or a position event, as the alert monitor receives it. */
export interface MonitorItem {
  id: string;
  kind: "news" | "event";
  headline: string;
  publishedAt: string;
  batch: ScanBatch;
}

export interface MonitorEvaluation {
  itemId: string;
  headline: string;
  evaluatedAt: string;
  /** Set when this item (alone or with items arriving at the same moment) caused a Client Alert. */
  alertId?: string;
}

// ---------- Documents ----------

/** Shared header of the talking points: Client · Theme · Why now · Data as of · Prepared for. */
export interface DocHeader {
  subjectKind: "Client";
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
  audience: string;
  header: { label: string; value: string }[];
  sections: DocSection[];
  fileName: string;
}

// ---------- Activity log ----------

export type LogType =
  | "Brief delivered"
  | "Alert sent"
  | "Talking points approved"
  | "Shared"
  | "No contact needed"
  | "Logged to Portfolio Review";

export interface LogEntry {
  id: string;
  timestamp: string;
  rmId: string;
  rmName: string;
  type: LogType;
  subject: string;
  theme: string;
  detail: string;
  /** System events (brief delivered, alert sent) are recorded once per key. */
  key?: string;
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

// ---------- Alerts and Portfolio Review log (update 2) ----------

export type TriggerKind = "position-event" | "material-impact" | "concentrated-exposure";

export interface AlertTrigger {
  clientId: string;
  kind: TriggerKind;
  themeId?: string;
  positionEventId?: string;
  /** Plain-language reason for the portal, e.g. "Call notice on Partner Bank A 5.875% USD Perpetual". */
  reason: string;
  /** "Why this client" for the Client Alert email: asset type and trigger in words, no amounts. */
  whyClient: string;
  /** Plain-language headline for the review timeline, e.g. "US rate move hit long-duration USD bonds and REITs". */
  summary: string;
  /** Theme or event the trigger is about. A client is alerted once per key per day. */
  key: string;
  /** Every theme or event that met the rule for this client when the alert went out, shown or not. */
  covers: string[];
}

export interface Alert {
  id: string;
  rmId: string;
  date: string;
  /** When the monitor sent it: a minute after the item that caused it arrived. ISO, SGT. */
  detectedAt: string;
  /** "HH:MM" of detectedAt. Alerts have no fixed schedule. */
  time: string;
  /** The news items or position events behind this alert (several only when they arrived together). */
  itemIds: string[];
  triggers: AlertTrigger[];
}

export type ReviewOutcome = "Contacted: no concerns" | "Contacted: concerns raised" | "Could not reach" | "No contact needed";

export interface ReviewLogEntry {
  id: string;
  clientId: string;
  rmId: string;
  alertId: string;
  createdAt: string;
  updatedAt: string;
  trigger: {
    kind: TriggerKind;
    themeId?: string;
    positionEventId?: string;
    reason: string;
    /** Plain-language headline for the review timeline. */
    summary: string;
  };
  holdingsSnapshot: { instrument: string; bank: string; marketValueUsd: number; estImpactUsd: number }[];
  talkingPoints: { status: "drafted" | "approved" | "shared"; approvedVersion?: number; sharedVia?: string[]; sharedAt?: string };
  outcome?: ReviewOutcome;
  rmNote?: string;
  discussAtNextReview: boolean;
  nextReviewDate: string;
  /** Set when the RM clicks "Log for next portfolio review". Only logged entries reach the review. */
  loggedAt?: string;
}
