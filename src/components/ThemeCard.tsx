import { fmtMove, TAG_LABEL } from "../logic/format";
import type { ActiveTheme } from "../types";
import { AgentLabel, agentTint, NewBadge, TypeBadge } from "./ui";

export function ThemeCard({ theme }: { theme: ActiveTheme }) {
  const changed = theme.status !== "unchanged";
  return (
    <article className={`flex flex-col rounded-lg p-5 ${agentTint} ${changed ? "ring-2 ring-brand-hover" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={theme.type} />
          {changed && <NewBadge />}
        </div>
        <AgentLabel />
      </div>
      <h3 className="mt-3 font-serif text-xl leading-snug text-ink">{theme.title}</h3>

      <dl className="mt-3 space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="text-[10px] font-semibold tracking-widest text-muted uppercase">What happened</dt>
          <dd className="mt-0.5 text-soft">{theme.whatHappened}</dd>
          {theme.updateNote && <dd className="mt-2 rounded-md border border-brand/40 bg-surface px-3 py-2 text-ink">{theme.updateNote}</dd>}
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-widest text-muted uppercase">Why it matters</dt>
          <dd className="mt-0.5 text-soft">{theme.whyItMatters}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {theme.affectedTags.map((move) => (
          <span key={move.tag} className="rounded border border-line bg-surface px-2 py-0.5 text-xs text-muted">
            {TAG_LABEL[move.tag]} <span className={`font-semibold tabular-nums ${move.estMovePct < 0 ? "text-loss" : "text-gain"}`}>{fmtMove(move.estMovePct)}</span>
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <span className="text-[10px] font-semibold tracking-widest text-muted uppercase">Sources</span>
        {theme.sources.map((source) => (
          <span key={source} className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-muted">
            {source}
          </span>
        ))}
      </div>
    </article>
  );
}
