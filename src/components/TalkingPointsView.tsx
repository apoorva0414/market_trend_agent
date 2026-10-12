import type { ReactNode } from "react";
import { labelsFor, talkingPointsToDoc } from "../documents/model";
import { isChinese, splitSentences } from "../logic/text";
import { diffLines, type LineChange, newLines } from "../talkingPoints/diff";
import type { TalkingPointsDoc, TalkingPointsWording } from "../types";
import { AgentLabel, agentTint, LockIcon, Tooltip } from "./ui";

const added = "rounded-sm bg-gain/20 text-ink no-underline decoration-transparent";
const removed = "rounded-sm bg-bg/70 text-loss line-through decoration-loss/70";

function Change({ change }: { change: LineChange }) {
  if (change.type === "rewritten") {
    return (
      <>
        {change.parts.map((part, index) =>
          part.type === "same" ? (
            <span key={index}>{part.text}</span>
          ) : part.type === "added" ? (
            <ins key={index} className={added}>
              {part.text}
            </ins>
          ) : (
            <del key={index} className={removed}>
              {part.text}
            </del>
          ),
        )}
      </>
    );
  }
  if (change.type === "added") return <ins className={added}>{change.text}</ins>;
  if (change.type === "removed") return <del className={removed}>{change.text}</del>;
  return <>{change.text}</>;
}

/** A paragraph, sentence by sentence, so single sentences can be highlighted or marked as changed. */
function Sentences({ text, before, showChanges, flash }: { text: string; before: string | null; showChanges: boolean; flash: boolean }) {
  const sentences = splitSentences(text);
  const gap = isChinese(text) ? "" : " ";
  if (showChanges && before !== null) {
    return (
      <p className="text-sm leading-relaxed text-soft">
        {diffLines(splitSentences(before), sentences).map((change, index) => (
          <span key={index}>
            <Change change={change} />
            {gap}
          </span>
        ))}
      </p>
    );
  }
  const fresh = flash && before !== null ? newLines(splitSentences(before), sentences) : new Set<string>();
  return (
    <p className="text-sm leading-relaxed text-soft">
      {sentences.map((sentence, index) => (
        <span key={index}>
          <span className={fresh.has(sentence) ? "changed-line" : undefined}>{sentence}</span>
          {gap}
        </span>
      ))}
    </p>
  );
}

function Lines({ items, before, showChanges, flash }: { items: string[]; before: string[] | null; showChanges: boolean; flash: boolean }) {
  const list = "list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-soft marker:text-brand-tint";
  if (showChanges && before !== null) {
    return (
      <ul className={list}>
        {diffLines(before, items).map((change, index) => (
          <li key={index} className={change.type === "removed" ? "marker:text-loss" : change.type === "added" ? "marker:text-gain" : undefined}>
            <Change change={change} />
          </li>
        ))}
      </ul>
    );
  }
  const fresh = flash && before !== null ? newLines(before, items) : new Set<string>();
  return (
    <ul className={list}>
      {items.map((item, index) => (
        <li key={index}>
          <span className={fresh.has(item) ? "changed-line" : undefined}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ heading, extra, children }: { heading: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-tint uppercase">
        {heading}
        {extra}
      </h4>
      {children}
    </section>
  );
}

interface Props {
  doc: TalkingPointsDoc;
  wording: TalkingPointsWording;
  version: number;
  /** Wording of the version before this one, or null for v1. */
  previous: TalkingPointsWording | null;
  /** Mark additions and removals against the previous version. */
  showChanges: boolean;
  /** Briefly highlight the lines that changed in the latest round. */
  flash: boolean;
}

/**
 * One version of the talking points. Wording comes from the version; the header, the holdings
 * table and the disclaimer are fact fields rendered from data and look the same in every version.
 */
export function TalkingPointsView({ doc, wording, version, previous, showChanges, flash }: Props) {
  const model = talkingPointsToDoc(doc, wording);
  const labels = labelsFor(wording);
  const holdings = model.sections[1].blocks[0];
  // Remounting on a new version restarts the fade on the lines that changed.
  const pass = `${version}-${showChanges}-${flash}`;

  return (
    <article className={`rounded-lg p-6 ${agentTint}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] font-semibold tracking-widest text-muted uppercase">{model.audience}</span>
        <AgentLabel />
      </div>
      <h3 className="mt-1 flex items-baseline gap-3 font-serif text-2xl text-ink">
        {model.title}
        <span className="rounded bg-raised px-2 py-0.5 font-sans text-xs font-semibold text-brand-tint">v{version}</span>
      </h3>

      <dl className="mt-4 overflow-hidden rounded-md border border-line bg-surface text-sm">
        {model.header.map((row) => (
          <div key={row.label} className="grid grid-cols-[8.5rem_1fr] border-b border-line last:border-0">
            <dt className="bg-raised px-3 py-2 font-semibold text-muted">{row.label}</dt>
            <dd className="px-3 py-2 text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <Section heading={labels.summary}>
        <Sentences key={pass} text={wording.summary} before={previous?.summary ?? null} showChanges={showChanges} flash={flash} />
      </Section>

      <Section
        heading={labels.portfolio}
        extra={
          <Tooltip content="Figures come from portfolio data and can't be edited in chat.">
            <span className="inline-flex items-center gap-1 rounded border border-line bg-raised px-1.5 py-0.5 text-[10px] tracking-wide text-muted normal-case">
              <LockIcon className="h-3 w-3" />
              Locked
            </span>
          </Tooltip>
        }
      >
        {holdings.kind === "table" && (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-raised text-left text-xs text-muted">
                  {holdings.columns.map((column, index) => (
                    <th key={column} className={`px-3 py-2 font-semibold ${index >= 1 ? "text-right" : ""}`}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.rows.map((row, rowIndex) => {
                  const isTotal = rowIndex === holdings.rows.length - 1;
                  return (
                    <tr key={rowIndex} className={`border-b border-line last:border-0 ${isTotal ? "bg-raised font-semibold" : ""}`}>
                      {row.map((value, index) => (
                        <td key={index} className={`px-3 py-2 align-top text-soft ${index >= 1 ? "text-right whitespace-nowrap tabular-nums" : ""}`}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section heading={labels.talkingPoints}>
        <Lines key={pass} items={wording.talkingPoints} before={previous?.talkingPoints ?? null} showChanges={showChanges} flash={flash} />
      </Section>

      <Section heading={labels.nextSteps}>
        <Lines key={pass} items={wording.nextSteps} before={previous?.nextSteps ?? null} showChanges={showChanges} flash={flash} />
      </Section>

      <Section heading={labels.disclaimer}>
        <p className="text-sm leading-relaxed text-muted italic">{doc.disclaimer}</p>
      </Section>
    </article>
  );
}
