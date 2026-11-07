import { fmtDateMedium, fmtMove, fmtUsd, slugify } from "../logic/format";
import { isChinese } from "../logic/text";
import type { DocBlock, DocHeader, DocModel, TalkingPointsDoc, TalkingPointsWording } from "../types";
import { LABELS } from "./mandarin";

// Each document is turned into a neutral DocModel. The on-screen view, the .docx export
// and the plain text for copy and share all render from that one model.

function headerRows(header: DocHeader): DocModel["header"] {
  return [
    { label: header.subjectKind, value: header.subject },
    { label: "Theme", value: `${header.themeTitle} (${header.themeType})` },
    { label: "Why now", value: header.whyNow },
    { label: "Data as of", value: header.dataAsOf },
    { label: "Prepared for", value: `${header.preparedFor} · ${fmtDateMedium(header.date)}` },
  ];
}

/** Section headings and message scaffolding follow the language of the wording. */
export function labelsFor(wording: TalkingPointsWording) {
  return isChinese(wording.summary + wording.talkingPoints.join("")) ? LABELS.zh : LABELS.en;
}

/**
 * Renders one version of the talking points. Facts (header, holdings table, disclaimer) always come
 * from `doc`; only `wording` differs between versions.
 */
export function talkingPointsToDoc(doc: TalkingPointsDoc, wording: TalkingPointsWording = doc.wording, version?: number): DocModel {
  const labels = labelsFor(wording);
  return {
    title: "Client talking points",
    audience: "For your conversation · shareable after approval",
    header: headerRows(doc.header),
    fileName: `Talking-points_${slugify(doc.header.subject)}_${doc.header.date}${version ? `_v${version}` : ""}.docx`,
    sections: [
      { heading: labels.summary, blocks: [{ kind: "paragraph", text: wording.summary }] },
      {
        heading: labels.portfolio,
        blocks: [
          {
            kind: "table",
            columns: ["Holding", "Value", "Est. move", "Est. impact"],
            rows: [
              ...doc.holdings.map((h) => [
                h.instrument,
                fmtUsd(h.marketValueUsd),
                fmtMove(h.estMovePct),
                fmtUsd(h.estImpactUsd, true),
              ]),
              ["Total", fmtUsd(doc.totalExposureUsd), "", fmtUsd(doc.totalImpactUsd, true)],
            ],
            numericFrom: 1,
            totalRow: true,
          },
        ],
      },
      { heading: labels.talkingPoints, blocks: [{ kind: "bullets", items: wording.talkingPoints }] },
      { heading: labels.nextSteps, blocks: [{ kind: "bullets", items: wording.nextSteps }] },
      { heading: labels.disclaimer, blocks: [{ kind: "note", text: doc.disclaimer }] },
    ],
  };
}

/** Plain text of a whole document, for Copy text. */
export function docToText(model: DocModel): string {
  const lines: string[] = [model.title.toUpperCase(), ""];
  for (const row of model.header) lines.push(`${row.label}: ${row.value}`);
  for (const section of model.sections) {
    lines.push("", section.heading.toUpperCase());
    for (const block of section.blocks) lines.push(...blockToText(block));
  }
  return lines.join("\n");
}

function blockToText(block: DocBlock): string[] {
  switch (block.kind) {
    case "paragraph":
    case "note":
      return [block.text];
    case "bullets":
      return block.items.map((item) => `- ${item}`);
    case "table":
      return block.rows.map((row) => `- ${row.filter((cell) => cell !== "").join(" | ")}`);
  }
}

/** Message for email and WhatsApp: the client-facing content of one version, without the internal header. */
export function talkingPointsMessage(
  doc: TalkingPointsDoc,
  wording: TalkingPointsWording,
  rmName: string,
): { subject: string; body: string } {
  const labels = labelsFor(wording);
  const lines = [
    labels.greeting(doc.header.subject),
    "",
    wording.summary,
    "",
    labels.portfolioLine,
    ...doc.holdings.map(
      (h) => `- ${h.instrument}: ${fmtUsd(h.marketValueUsd)}, ${labels.estimated} ${fmtMove(h.estMovePct)} (${fmtUsd(h.estImpactUsd, true)})`,
    ),
    "",
    labels.keyPoints,
    ...wording.talkingPoints.map((point) => `- ${point}`),
    "",
    labels.nextStepsLine,
    ...wording.nextSteps.map((step) => `- ${step}`),
    "",
    labels.signOff,
    rmName,
    "Azimut Investment Management Singapore",
    "",
    doc.header.dataAsOf,
    doc.disclaimer,
  ];
  return { subject: `Market update: ${doc.header.themeTitle}`, body: lines.join("\n") };
}
