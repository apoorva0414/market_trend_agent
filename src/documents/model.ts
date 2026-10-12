import { fmtDateMedium, fmtMove, fmtPct, fmtUsd, joinList, slugify } from "../logic/format";
import { isChinese } from "../logic/text";
import type {
  DocBlock,
  DocHeader,
  DocModel,
  DocProductLine,
  PortfolioReviewHandoff,
  ProposalHandoff,
  TalkingPointsDoc,
  TalkingPointsWording,
} from "../types";
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

function productTable(products: DocProductLine[]): DocBlock {
  return {
    kind: "table",
    columns: ["Product", "Asset class", "Risk level", "Description"],
    rows: products.map((p) => [p.name, p.assetClass, `${p.riskLevel} of 5`, p.oneLiner]),
  };
}

/** "RM context" section of a hand-off: what the RM added for the next agent, plus any gaps left open. */
function contextBlocks(rmContext: string, openGaps: string[]): DocBlock[] {
  const blocks: DocBlock[] = [{ kind: "paragraph", text: rmContext.trim() || "No context added." }];
  if (openGaps.length > 0) blocks.push({ kind: "note", text: `Open gaps when this was sent: ${openGaps.join(" ")}` });
  return blocks;
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
    audience: "Client-shareable",
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

export function portfolioReviewToDoc(handoff: PortfolioReviewHandoff): DocModel {
  const { client, theme, exposure } = handoff;
  const details: DocBlock[] = [
    {
      kind: "table",
      columns: ["Mandate", "Risk profile", "Banks", "AUM", "Last contact"],
      rows: [[client.mandate, client.riskProfile, joinList(client.banks), fmtUsd(client.aumUsd), fmtDateMedium(client.lastContactDate)]],
    },
    {
      kind: "paragraph",
      text: `Agent recommendation: ${handoff.recommendation.action} (${handoff.recommendation.reason.toLowerCase()}). ${theme.whatHappened}`,
    },
  ];
  if (client.notes) details.push({ kind: "note", text: `Client note: ${client.notes}` });
  if (theme.stressTest) details.push({ kind: "note", text: `This theme is a View (opinion). ${theme.stressTest}` });

  return {
    title: "Portfolio Review hand-off",
    audience: "Internal",
    header: headerRows(handoff.header),
    fileName: `Portfolio-Review-handoff_${slugify(client.name)}_${handoff.header.date}.docx`,
    sections: [
      { heading: "Client details", blocks: details },
      {
        heading: "Affected holdings",
        blocks: [
          {
            kind: "table",
            columns: ["Instrument", "Bank", "Value", "% of AUM", "Est. impact"],
            rows: [
              ...handoff.affectedHoldings.map((h) => [
                h.instrument,
                h.bank,
                fmtUsd(h.marketValueUsd),
                fmtPct(h.pctOfAum),
                fmtUsd(h.estImpactUsd, true),
              ]),
              ["Total", "", fmtUsd(exposure.exposureUsd), fmtPct(exposure.exposurePct), fmtUsd(exposure.estImpactUsd, true)],
            ],
            numericFrom: 2,
            totalRow: true,
          },
        ],
      },
      { heading: "Points to cover in the review", blocks: [{ kind: "bullets", items: handoff.pointsToCover }] },
      { heading: "Likely client questions", blocks: [{ kind: "bullets", items: handoff.likelyClientQuestions }] },
      {
        heading: "Options to discuss",
        blocks:
          handoff.optionsToDiscuss.length > 0
            ? [
                {
                  kind: "paragraph",
                  text: "Shelf products linked to this theme that fit the client's risk profile. These are options for the review, not recommendations.",
                },
                productTable(handoff.optionsToDiscuss),
              ]
            : [
                {
                  kind: "paragraph",
                  text: `No shelf product linked to this theme fits a ${client.riskProfile.toLowerCase()} risk profile.`,
                },
              ],
      },
      { heading: "RM context", blocks: contextBlocks(handoff.rmContext, handoff.openGaps) },
    ],
  };
}

export function proposalToDoc(handoff: ProposalHandoff): DocModel {
  const { theme, prospectFit } = handoff;
  const themeBlocks: DocBlock[] = [
    { kind: "paragraph", text: theme.whatHappened },
    { kind: "paragraph", text: theme.whyItMatters },
  ];
  if (theme.stressTest) themeBlocks.push({ kind: "note", text: `This theme is a View (opinion). ${theme.stressTest}` });

  return {
    title: "Portfolio Proposal hand-off",
    audience: "Internal",
    header: headerRows(handoff.header),
    fileName: `Proposal-handoff_${slugify(theme.title)}_${handoff.header.date}.docx`,
    sections: [
      { heading: "Theme and why it matters", blocks: themeBlocks },
      {
        heading: "Prospect fit",
        blocks: [
          {
            kind: "bullets",
            items: [
              `Prospect profile, as described by the RM: ${prospectFit.profile}`,
              `Who this theme suits: ${prospectFit.suits}`,
              `Angle for the conversation: ${prospectFit.angle}`,
            ],
          },
        ],
      },
      {
        heading: "Relevant shelf products",
        blocks: [
          { kind: "paragraph", text: "Starting points for the proposal, to be checked against the prospect's risk profile once known." },
          productTable(handoff.products),
        ],
      },
      { heading: "Key risks", blocks: [{ kind: "bullets", items: handoff.keyRisks }] },
      { heading: "RM context", blocks: contextBlocks(handoff.rmContext, handoff.openGaps) },
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
