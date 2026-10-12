import type { DocBlock, DocModel } from "../types";
import { AgentLabel, agentTint } from "./ui";

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className="text-sm leading-relaxed text-soft">{block.text}</p>;
    case "note":
      return <p className="text-sm leading-relaxed text-muted italic">{block.text}</p>;
    case "bullets":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-soft marker:text-brand-tint">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table": {
      const numericFrom = block.numericFrom ?? Number.POSITIVE_INFINITY;
      return (
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-raised text-left text-xs text-muted">
                {block.columns.map((column, index) => (
                  <th key={column} className={`px-3 py-2 font-semibold ${index >= numericFrom ? "text-right" : ""}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => {
                const isTotal = !!block.totalRow && rowIndex === block.rows.length - 1;
                return (
                  <tr key={rowIndex} className={`border-b border-line last:border-0 ${isTotal ? "bg-raised font-semibold" : ""}`}>
                    {row.map((value, index) => (
                      <td key={index} className={`px-3 py-2 align-top text-soft ${index >= numericFrom ? "text-right whitespace-nowrap tabular-nums" : ""}`}>
                        {value}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
  }
}

/** Renders a document exactly as the .docx export does, tinted as agent-drafted content. */
export function DocumentView({ model }: { model: DocModel }) {
  return (
    <article className={`rounded-lg p-6 ${agentTint}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] font-semibold tracking-widest text-muted uppercase">{model.audience}</span>
        <AgentLabel />
      </div>
      <h3 className="mt-1 font-serif text-2xl text-ink">{model.title}</h3>

      <dl className="mt-4 overflow-hidden rounded-md border border-line bg-surface text-sm">
        {model.header.map((row) => (
          <div key={row.label} className="grid grid-cols-[8.5rem_1fr] border-b border-line last:border-0">
            <dt className="bg-raised px-3 py-2 font-semibold text-muted">{row.label}</dt>
            <dd className="px-3 py-2 text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      {model.sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h4 className="mb-2 text-xs font-semibold tracking-widest text-brand-tint uppercase">{section.heading}</h4>
          <div className="space-y-3">
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
