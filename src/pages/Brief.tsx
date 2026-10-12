import { useNavigate } from "react-router-dom";
import { ClientTable } from "../components/ClientTable";
import { ScanStrip } from "../components/ScanStrip";
import { ThemeCard } from "../components/ThemeCard";
import { AgentLabel, agentTint, buttonPrimary, buttonSecondary, DecisionLabel, decisionOutline, NewBadge, SectionHeading, TypeBadge } from "../components/ui";
import { fmtDateLong, fmtTimeSgt, plural } from "../logic/format";
import { useApp } from "../state/AppContext";
import type { ProspectTheme } from "../types";

function ProspectCard({ prospect }: { prospect: ProspectTheme }) {
  const { prospectPicks, setProspectPick } = useApp();
  const { theme, products, featured } = prospect;
  const pick = prospectPicks[theme.id] ?? { checked: false, profile: "" };
  const checkboxId = `prospect-${theme.id}`;

  return (
    <article className={`flex flex-col rounded-lg p-5 ${agentTint} ${theme.status !== "unchanged" ? "ring-2 ring-brand-hover" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={theme.type} />
          {featured && <span className="rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-muted">Main prospect theme</span>}
          {theme.status !== "unchanged" && <NewBadge />}
        </div>
        <AgentLabel />
      </div>
      <h3 className="mt-3 font-serif text-xl leading-snug text-ink">{theme.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-soft">{theme.prospectAngle}</p>
      <p className="mt-2 text-sm text-soft">
        <span className="font-semibold">Suits:</span> {theme.prospectSuits}
      </p>

      <p className="mt-4 text-[10px] font-semibold tracking-widest text-muted uppercase">Relevant shelf products</p>
      <ul className="mt-1.5 space-y-1.5 text-sm">
        {products.map((product) => (
          <li key={product.id} className="flex items-baseline justify-between gap-3 rounded-md border border-line bg-surface px-3 py-1.5">
            <span className="text-ink">{product.name}</span>
            <span className="shrink-0 text-xs text-muted">Risk {product.riskLevel} of 5</span>
          </li>
        ))}
      </ul>

      <div className={`mt-5 rounded-md bg-surface p-3 ${pick.checked ? decisionOutline : "border-2 border-line"}`}>
        <label htmlFor={checkboxId} className="flex items-center gap-2.5 text-sm font-semibold text-ink">
          <input
            id={checkboxId}
            type="checkbox"
            checked={pick.checked}
            onChange={(event) => setProspectPick(theme.id, { checked: event.target.checked })}
            className="h-4 w-4 accent-brand-tint"
          />
          Explore for a prospect
        </label>
        <input
          type="text"
          value={pick.profile}
          onChange={(event) => setProspectPick(theme.id, { profile: event.target.value })}
          placeholder="Prospect profile (e.g. 'Tech founder, SGD 10m, growth')"
          aria-label={`Prospect profile for ${theme.title}`}
          className="mt-2.5 w-full rounded-md border border-line px-3 py-1.5 text-sm placeholder:text-muted/80 focus:border-brand-tint focus:outline-none"
        />
      </div>
    </article>
  );
}

function CheckpointBar() {
  const { selectedItems, commitSelections, logNoAction, noActionAt } = useApp();
  const navigate = useNavigate();
  const clientCount = selectedItems.filter((item) => item.kind !== "proposal").length;
  const prospectCount = selectedItems.length - clientCount;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
      <div className={`mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-surface px-6 py-4 shadow-xl ${decisionOutline}`}>
        <div>
          <DecisionLabel>RM checkpoint · your decision</DecisionLabel>
          <p className="mt-0.5 text-base font-medium text-ink" aria-live="polite">
            You've selected {plural(clientCount, "client")} and {plural(prospectCount, "prospect theme")}
          </p>
          {noActionAt && <p className="mt-0.5 text-sm text-gain">Logged at {fmtTimeSgt(noActionAt)} SGT: no action today. Nothing was sent to anyone.</p>}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className={buttonSecondary} onClick={logNoAction}>
            No action today
          </button>
          <button
            type="button"
            className={buttonPrimary}
            disabled={selectedItems.length === 0}
            onClick={() => {
              commitSelections();
              navigate("/act");
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export function Brief() {
  const { rm, date, scan } = useApp();
  const unaffected = scan.clientCount - scan.clients.length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-12 px-6 pt-8 pb-40">
      <div>
        <p className="text-sm text-muted">{fmtDateLong(date)}</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">Brief for {rm.name}</h1>
        <div className="mt-6">
          <ScanStrip />
        </div>
      </div>

      <section>
        <SectionHeading title="Market summary" hint="Pulse themes are facts and can be shared directly. View themes are opinions: stress-test them before sharing." />
        <div className="grid gap-5 lg:grid-cols-2">
          {scan.themes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Your affected clients"
          hint={`Ranked by follow-up priority. ${plural(unaffected, "client")} with less than 3% exposed to any theme ${unaffected === 1 ? "is" : "are"} not shown. Click a row for holdings and notes.`}
          right={<DecisionLabel>Choose an action for each client</DecisionLabel>}
        />
        <ClientTable />
      </section>

      <section>
        <SectionHeading title="Themes for prospects" hint="Optional. Tick a theme and describe the prospect to prepare a proposal hand-off." />
        <div className="grid gap-5 lg:grid-cols-2">
          {scan.prospectThemes.map((prospect) => (
            <ProspectCard key={prospect.theme.id} prospect={prospect} />
          ))}
        </div>
      </section>

      <CheckpointBar />
    </div>
  );
}
