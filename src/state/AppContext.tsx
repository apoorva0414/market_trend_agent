import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type AiStatus, fetchAiStatus } from "../ai/client";
import { data, DEMO_DATE, DEMO_NOW, SEED_REVIEW_LOG } from "../data";
import { bookStateAt } from "../logic/book";
import { runDailyBrief } from "../logic/brief";
import { simulateMonitor } from "../logic/monitor";
import { ensureReviewEntry, updateEntry, withLogged } from "../logic/reviewLog";
import type { Alert, AlertTrigger, BookState, DailyBrief, LogEntry, MonitorEvaluation, RankedClient, ReviewLogEntry, Rm, TpWorkspace } from "../types";
import { readStored, usePersistentState, writeStored } from "./storage";

const RM_KEY = "dmb.rmId";
// Stored shapes change between updates, so these keys carry a version.
const LOG_KEY = "dmb.activityLog.v5";
const REVIEW_KEY = "dmb.reviewLog.v3";
const SESSION_KEY = "dmb.session.v5";

/** Working state for the logged-in RM. Reset when the RM changes. */
interface Session {
  rmId: string;
  /** Talking-points chat: versions, thread and approval, keyed by alert and client. */
  workspaces: Record<string, TpWorkspace>;
}

type NewLogEntry = Omit<LogEntry, "id" | "timestamp" | "rmId" | "rmName">;

interface AppContextValue {
  rms: Rm[];
  rm: Rm;
  setRmId: (id: string) => void;
  date: string;
  /** Output of the 08:30 brief job, delivered at 09:00. */
  brief: DailyBrief;
  /** Client Alerts the monitor has sent so far today, oldest first. */
  alerts: Alert[];
  /** Every item the monitor has evaluated so far today. */
  evaluations: MonitorEvaluation[];
  /** The book as it stood when an alert was detected: its client rows and talking points. */
  stateForAlert: (alert: Alert) => BookState;
  /** Clears chats, the activity log and the review log (back to the seeded entries) for every RM. */
  resetDemo: () => void;
  workspaces: Record<string, TpWorkspace>;
  updateWorkspace: (key: string, initial: TpWorkspace, change: (current: TpWorkspace) => TpWorkspace) => void;
  aiStatus: AiStatus;
  markAiOffline: () => void;
  reviewLog: ReviewLogEntry[];
  /** Drafts the Portfolio Review log entry the first time the RM opens a client from an alert. */
  openClientWorkspace: (alert: Alert, trigger: AlertTrigger, row: RankedClient | undefined) => void;
  /** "Log for next portfolio review": the entry now reaches the client's next scheduled review. */
  /** Saves the RM's edits (if any) to the entry and logs it for the next review. Calling it again saves an update. */
  logForReview: (entryId: string, change?: (entry: ReviewLogEntry) => ReviewLogEntry) => void;
  changeReviewEntry: (id: string, change: (entry: ReviewLogEntry) => ReviewLogEntry) => void;
  log: LogEntry[];
  addLog: (entry: NewLogEntry) => void;
  clearLog: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function isRm(id: string | null): id is string {
  return !!id && data.rms.some((rm) => rm.id === id);
}

/** The demo opens on the Dedicated ARM, whose book has today's Client Alerts. */
export const DEFAULT_RM_ID = (data.rms.find((rm) => rm.arm_model === "Dedicated ARM") ?? data.rms[0]).id;

/**
 * The exported Client Alerts link to #/alerts/<id>?rm=<id>, which selects that RM on arrival.
 * With HashRouter the query sits inside the hash, so it is read from there.
 */
function resolveInitialRmId(): string {
  try {
    const { pathname, search, hash } = window.location;
    const [hashPath, hashQuery = ""] = hash.split("?");
    const inHash = new URLSearchParams(hashQuery);
    const inSearch = new URLSearchParams(search);
    const fromUrl = inHash.get("rm") ?? inSearch.get("rm");
    if (isRm(fromUrl)) {
      inHash.delete("rm");
      inSearch.delete("rm");
      const rest = (params: URLSearchParams) => (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState(null, "", `${pathname}${rest(inSearch)}${hashPath}${rest(inHash)}`);
      writeStored("session", RM_KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    // Fall through to the stored or default RM.
  }
  // The RM choice lasts for this browser tab only, so every new visit starts on the Dedicated ARM.
  const stored = readStored<string | null>("session", RM_KEY, null);
  return isRm(stored) ? stored : DEFAULT_RM_ID;
}

// Resolved once at module load so React's double-invoked initialisers cannot disagree.
const INITIAL_RM_ID = resolveInitialRmId();

function blankSession(rmId: string): Session {
  return { rmId, workspaces: {} };
}

/** The seeded history is always present: on first run, and again after Reset demo. */
function withSeeds(entries: ReviewLogEntry[]): ReviewLogEntry[] {
  const ids = new Set(entries.map((e) => e.id));
  return [...SEED_REVIEW_LOG.filter((e) => !ids.has(e.id)), ...entries];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [rmId, setRmIdState] = usePersistentState<string>("session", RM_KEY, () => INITIAL_RM_ID);
  const [log, setLog] = usePersistentState<LogEntry[]>("local", LOG_KEY, () => readStored("local", LOG_KEY, []));
  const [reviewLog, setReviewLog] = usePersistentState<ReviewLogEntry[]>("local", REVIEW_KEY, () =>
    withSeeds(readStored<ReviewLogEntry[]>("local", REVIEW_KEY, [])),
  );
  const [session, setSession] = usePersistentState<Session>("session", SESSION_KEY, () => {
    const stored = readStored<Session | null>("session", SESSION_KEY, null);
    return stored && stored.rmId === INITIAL_RM_ID ? { ...blankSession(INITIAL_RM_ID), ...stored } : blankSession(INITIAL_RM_ID);
  });

  const rm = data.rms.find((r) => r.id === rmId) ?? data.rms[0];

  const [aiStatus, setAiStatus] = useState<AiStatus>("checking");
  useEffect(() => {
    let active = true;
    void fetchAiStatus().then((status) => {
      if (active) setAiStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);
  const markAiOffline = useCallback(() => setAiStatus("offline"), []);

  const brief = useMemo(() => runDailyBrief({ date: DEMO_DATE, rmId: rm.id }), [rm.id]);
  const monitor = useMemo(() => simulateMonitor({ date: DEMO_DATE, rmId: rm.id, until: DEMO_NOW }), [rm.id]);
  const stateForAlert = useCallback((alert: Alert) => bookStateAt({ date: DEMO_DATE, rmId: rm.id, at: alert.time }), [rm.id]);

  const setRmId = useCallback(
    (id: string) => {
      if (!isRm(id)) return;
      setRmIdState(id);
      setSession(blankSession(id));
    },
    [setRmIdState, setSession],
  );

  const addLog = useCallback(
    (entry: NewLogEntry) => {
      const full: LogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        rmId: rm.id,
        rmName: rm.name,
      };
      setLog((previous) => (full.key && previous.some((e) => e.key === full.key) ? previous : [full, ...previous]));
    },
    [rm.id, rm.name, setLog],
  );

  const clearLog = useCallback(() => setLog([]), [setLog]);

  const logAlert = useCallback(
    (alert: Alert, key: string) => {
      const names = alert.triggers.map((t) => data.clients.find((c) => c.id === t.clientId)?.name).join(", ");
      addLog({
        type: "Alert sent",
        key,
        subject: names,
        theme: alert.triggers.map((t) => t.reason).join("; "),
        detail: `Client Alert at ${alert.time} SGT · ${alert.triggers.length} ${alert.triggers.length === 1 ? "client" : "clients"}`,
      });
    },
    [addLog],
  );

  // Bumped by resetDemo so the day's brief and alerts are recorded again in the cleared log.
  const [resetCount, setResetCount] = useState(0);

  // The brief and every alert sent so far today are recorded once each.
  useEffect(() => {
    addLog({
      type: "Brief delivered",
      key: `brief-${DEMO_DATE}-${rm.id}`,
      subject: "All clients",
      theme: `${brief.themes.length} themes`,
      detail: "MarketPulse Daily Brief delivered at 09:00 SGT (read only)",
    });
    for (const alert of monitor.alerts) logAlert(alert, alert.id);
  }, [addLog, logAlert, rm.id, brief, monitor.alerts, resetCount]);

  // A clean slate for a new demo: back to the Dedicated ARM, every RM's chats, the activity log, and the review log back to its seeds.
  const resetDemo = useCallback(() => {
    setRmIdState(DEFAULT_RM_ID);
    setSession(blankSession(DEFAULT_RM_ID));
    setReviewLog(withSeeds([]));
    setLog([]);
    setResetCount((n) => n + 1);
  }, [setRmIdState, setSession, setReviewLog, setLog]);

  const openClientWorkspace = useCallback(
    (alert: Alert, trigger: AlertTrigger, row: RankedClient | undefined) => {
      const client = data.clients.find((c) => c.id === trigger.clientId);
      if (!client) return;
      // Dated on the demo day, at the real time of day in Singapore.
      const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Singapore" }).format(new Date());
      const createdAt = `${alert.date}T${time}+08:00`;
      setReviewLog((entries) => ensureReviewEntry(entries, alert, trigger, row, client.nextReviewDate, createdAt).entries);
    },
    [setReviewLog],
  );

  const logForReview = useCallback(
    (entryId: string, change: (entry: ReviewLogEntry) => ReviewLogEntry = (e) => e) => {
      const entry = reviewLog.find((e) => e.id === entryId);
      if (!entry) return;
      const client = data.clients.find((c) => c.id === entry.clientId);
      const now = new Date().toISOString();
      setReviewLog((entries) => updateEntry(entries, entryId, (e) => withLogged(change(e), now), now));
      addLog({
        type: "Logged to Portfolio Review",
        key: entry.loggedAt ? undefined : `logged-${entryId}`,
        subject: client?.name ?? entry.clientId,
        theme: entry.trigger.reason,
        detail: entry.loggedAt ? `Log updated for the review on ${entry.nextReviewDate}` : `Logged for the review on ${entry.nextReviewDate}`,
      });
    },
    [reviewLog, setReviewLog, addLog],
  );

  const changeReviewEntry = useCallback(
    (id: string, change: (entry: ReviewLogEntry) => ReviewLogEntry) => setReviewLog((entries) => updateEntry(entries, id, change, new Date().toISOString())),
    [setReviewLog],
  );

  const updateWorkspace = useCallback(
    (key: string, initial: TpWorkspace, change: (current: TpWorkspace) => TpWorkspace) =>
      setSession((s) => ({ ...s, workspaces: { ...s.workspaces, [key]: change(s.workspaces[key] ?? initial) } })),
    [setSession],
  );

  const value: AppContextValue = {
    rms: data.rms,
    rm,
    setRmId,
    date: DEMO_DATE,
    brief,
    alerts: monitor.alerts,
    evaluations: monitor.evaluations,
    stateForAlert,
    resetDemo,
    workspaces: session.workspaces,
    updateWorkspace,
    aiStatus,
    markAiOffline,
    reviewLog,
    openClientWorkspace,
    logForReview,
    changeReviewEntry,
    log,
    addLog,
    clearLog,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
