import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type AiStatus, fetchAiStatus } from "../ai/client";
import { data, DEMO_DATE } from "../data";
import { NO_PROFILE } from "../documents/builders";
import { defaultAction } from "../logic/nextStep";
import { runScan } from "../logic/scan";
import type {
  ActItem,
  ClientAction,
  Handoff,
  LogEntry,
  RankedClient,
  Rm,
  ScanBatch,
  ScanResult,
  TpWorkspace,
} from "../types";
import { readStored, usePersistentState, writeStored } from "./storage";

const RM_KEY = "dmb.rmId";
const LOG_KEY = "dmb.activityLog";
// The stored shapes changed with update 1 (RM context, chat workspaces), so these keys carry a version.
const HANDOFF_KEY = "dmb.handoffs.v2";
const SESSION_KEY = "dmb.session.v2";

export interface ProspectPick {
  checked: boolean;
  profile: string;
}

export interface ActSession {
  upTo: ScanBatch;
  items: ActItem[];
}

/** Working state for the logged-in RM. Reset when the RM changes. */
interface Session {
  rmId: string;
  upTo: ScanBatch;
  overrides: Record<string, ClientAction>;
  picks: Record<string, ProspectPick>;
  act: ActSession | null;
  /** "Add context for the next agent", keyed by hand-off id. */
  notes: Record<string, string>;
  /** Talking-points chat: versions, thread and approval, keyed by document id. */
  workspaces: Record<string, TpWorkspace>;
  noActionAt: string | null;
}

type NewLogEntry = Omit<LogEntry, "id" | "timestamp" | "rmId" | "rmName">;

interface AppContextValue {
  rms: Rm[];
  rm: Rm;
  setRmId: (id: string) => void;
  date: string;
  upTo: ScanBatch;
  scan: ScanResult;
  morningScan: ScanResult;
  scanNow: () => void;
  resetToMorning: () => void;
  actionFor: (row: RankedClient) => ClientAction;
  setClientAction: (clientId: string, action: ClientAction) => void;
  prospectPicks: Record<string, ProspectPick>;
  setProspectPick: (themeId: string, patch: Partial<ProspectPick>) => void;
  selectedItems: ActItem[];
  commitSelections: () => void;
  logNoAction: () => void;
  noActionAt: string | null;
  act: ActSession | null;
  notes: Record<string, string>;
  setNote: (id: string, text: string) => void;
  workspaces: Record<string, TpWorkspace>;
  /** Applies a change to one workspace. `initial` is used the first time a workspace is touched. */
  updateWorkspace: (key: string, initial: TpWorkspace, change: (current: TpWorkspace) => TpWorkspace) => void;
  /** "live" only when an API endpoint is configured, reachable and has a key. Otherwise the chat runs offline. */
  aiStatus: AiStatus;
  markAiOffline: () => void;
  handoffs: Record<string, Handoff>;
  saveHandoff: (handoff: Handoff) => void;
  log: LogEntry[];
  addLog: (entry: NewLogEntry) => void;
  clearLog: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function isRm(id: string | null): id is string {
  return !!id && data.rms.some((rm) => rm.id === id);
}

/**
 * The exported email previews link to #/brief?rm=<id>, which selects that RM on arrival.
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
      writeStored("local", RM_KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    // Fall through to the stored or default RM.
  }
  const stored = readStored<string | null>("local", RM_KEY, null);
  return isRm(stored) ? stored : data.rms[0].id;
}

// Resolved once at module load so React's double-invoked initialisers cannot disagree.
const INITIAL_RM_ID = resolveInitialRmId();

function blankSession(rmId: string): Session {
  return { rmId, upTo: "morning", overrides: {}, picks: {}, act: null, notes: {}, workspaces: {}, noActionAt: null };
}

function itemKey(item: ActItem): string {
  return item.kind === "proposal" ? `${item.kind}:${item.themeId}:${item.profile}` : `${item.kind}:${item.clientId}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [rmId, setRmIdState] = usePersistentState<string>("local", RM_KEY, () => INITIAL_RM_ID);
  const [log, setLog] = usePersistentState<LogEntry[]>("local", LOG_KEY, () => readStored("local", LOG_KEY, []));
  const [handoffs, setHandoffs] = usePersistentState<Record<string, Handoff>>("local", HANDOFF_KEY, () =>
    readStored("local", HANDOFF_KEY, {}),
  );
  const [session, setSession] = usePersistentState<Session>("session", SESSION_KEY, () => {
    const stored = readStored<Session | null>("session", SESSION_KEY, null);
    return stored && stored.rmId === INITIAL_RM_ID ? { ...blankSession(INITIAL_RM_ID), ...stored } : blankSession(INITIAL_RM_ID);
  });

  const rm = data.rms.find((r) => r.id === rmId) ?? data.rms[0];
  const { upTo } = session;

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

  const morningScan = useMemo(() => runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" }), [rm.id]);
  const scan = useMemo(
    () => (upTo === "morning" ? morningScan : runScan({ date: DEMO_DATE, rmId: rm.id, upTo })),
    [rm.id, upTo, morningScan],
  );

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
      setLog((previous) => [full, ...previous]);
    },
    [rm.id, rm.name, setLog],
  );

  const clearLog = useCallback(() => setLog([]), [setLog]);

  const scanNow = useCallback(() => {
    const result = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "intraday" });
    const adHoc = result.record.adHoc;
    // A re-rank must never silently drop a client the RM had already selected, so current
    // selections are pinned. Rows left on Skip still follow the new ranking's defaults.
    setSession((s) => {
      const overrides = { ...s.overrides };
      for (const row of scan.clients) {
        const action = overrides[row.client.id] ?? defaultAction(row);
        if (action !== "Skip") overrides[row.client.id] = action;
      }
      return { ...s, upTo: "intraday", overrides };
    });
    addLog({
      type: "Scan",
      subject: "All clients",
      theme: result.themes.filter((t) => t.status !== "unchanged").map((t) => t.shortTitle).join(", ") || "No change",
      detail: adHoc ? `Ad hoc scan ${adHoc.at} SGT · ${adHoc.newItems} new items · ${adHoc.affectedClientCount} clients affected` : "Ad hoc scan",
    });
  }, [rm.id, scan, setSession, addLog]);

  const resetToMorning = useCallback(() => setSession((s) => ({ ...s, upTo: "morning" })), [setSession]);

  const actionFor = useCallback(
    (row: RankedClient): ClientAction => session.overrides[row.client.id] ?? defaultAction(row),
    [session.overrides],
  );

  const setClientAction = useCallback(
    (clientId: string, action: ClientAction) =>
      setSession((s) => ({ ...s, overrides: { ...s.overrides, [clientId]: action }, noActionAt: null })),
    [setSession],
  );

  const setProspectPick = useCallback(
    (themeId: string, patch: Partial<ProspectPick>) =>
      setSession((s) => {
        const current: ProspectPick = s.picks[themeId] ?? { checked: false, profile: "" };
        return { ...s, picks: { ...s.picks, [themeId]: { ...current, ...patch } }, noActionAt: null };
      }),
    [setSession],
  );

  const selectedItems = useMemo(() => {
    const items: ActItem[] = [];
    for (const row of scan.clients) {
      const action = actionFor(row);
      if (action === "Talking points") items.push({ kind: "talking-points", clientId: row.client.id });
      if (action === "Portfolio review") items.push({ kind: "portfolio-review", clientId: row.client.id });
    }
    for (const prospect of scan.prospectThemes) {
      const pick = session.picks[prospect.theme.id];
      if (pick?.checked) items.push({ kind: "proposal", themeId: prospect.theme.id, profile: pick.profile.trim() });
    }
    return items;
  }, [scan, actionFor, session.picks]);

  const commitSelections = useCallback(() => {
    // Log each decision once, even if the RM goes back to the brief and continues again.
    const alreadyLogged = new Set(session.act && session.act.upTo === upTo ? session.act.items.map(itemKey) : []);
    for (const item of selectedItems) {
      if (alreadyLogged.has(itemKey(item))) continue;
      if (item.kind === "proposal") {
        const theme = scan.themes.find((t) => t.id === item.themeId);
        addLog({ type: "Prospect", subject: item.profile || NO_PROFILE, theme: theme?.title ?? "", detail: "Decision: explore this theme for a prospect" });
      } else {
        const row = scan.clients.find((r) => r.client.id === item.clientId);
        if (!row) continue;
        addLog(
          item.kind === "talking-points"
            ? { type: "Contacted", subject: row.client.name, theme: row.primary.theme.title, detail: "Decision: contact with talking points" }
            : { type: "Portfolio review", subject: row.client.name, theme: row.primary.theme.title, detail: "Decision: hand off for a portfolio review" },
        );
      }
    }
    setSession((s) => ({ ...s, act: { upTo, items: selectedItems }, noActionAt: null }));
  }, [session.act, upTo, selectedItems, scan, addLog, setSession]);

  const logNoAction = useCallback(() => {
    addLog({ type: "No action", subject: "All clients", theme: "All themes", detail: `Reviewed the ${upTo === "morning" ? "9 AM brief" : "13:45 ad hoc scan"} and decided no action today` });
    setSession((s) => ({ ...s, noActionAt: new Date().toISOString() }));
  }, [addLog, setSession, upTo]);

  const setNote = useCallback((id: string, text: string) => setSession((s) => ({ ...s, notes: { ...s.notes, [id]: text } })), [setSession]);
  const updateWorkspace = useCallback(
    (key: string, initial: TpWorkspace, change: (current: TpWorkspace) => TpWorkspace) =>
      setSession((s) => ({ ...s, workspaces: { ...s.workspaces, [key]: change(s.workspaces[key] ?? initial) } })),
    [setSession],
  );
  const saveHandoff = useCallback((handoff: Handoff) => setHandoffs((h) => ({ ...h, [handoff.handoffId]: handoff })), [setHandoffs]);

  const value: AppContextValue = {
    rms: data.rms,
    rm,
    setRmId,
    date: DEMO_DATE,
    upTo,
    scan,
    morningScan,
    scanNow,
    resetToMorning,
    actionFor,
    setClientAction,
    prospectPicks: session.picks,
    setProspectPick,
    selectedItems,
    commitSelections,
    logNoAction,
    noActionAt: session.noActionAt,
    act: session.act,
    notes: session.notes,
    setNote,
    workspaces: session.workspaces,
    updateWorkspace,
    aiStatus,
    markAiOffline,
    handoffs,
    saveHandoff,
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
