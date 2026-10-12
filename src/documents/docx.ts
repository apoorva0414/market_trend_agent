import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { SAMPLE_BANNER } from "../data";
import type { DocBlock, DocModel } from "../types";

const FONT = "Calibri";
const INK = "1F2937";
const MUTED = "6B7280";
/** Azimut blue. The .docx stays light (white page, dark text) for printing and sharing. */
export const DOCX_HEADING_COLOR = "356292";
const ACCENT = DOCX_HEADING_COLOR;
const RULE = "D5DBE1";
const SHADE = "F1F5F9";

// A4 with 2.2 cm margins, in twentieths of a point.
const PAGE_MARGIN = 1247;
const CONTENT_WIDTH = 11906 - 2 * PAGE_MARGIN;

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 70, bottom: 70, left: 110, right: 110 };

function run(text: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): TextRun {
  return new TextRun({ text, font: FONT, size: options.size ?? 21, color: options.color ?? INK, bold: options.bold, italics: options.italics });
}

function cell(text: string, width: number, options: { bold?: boolean; shaded?: boolean; right?: boolean } = {}): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: cellMargins,
    shading: options.shaded ? { type: ShadingType.CLEAR, color: "auto", fill: SHADE } : undefined,
    children: [
      new Paragraph({
        alignment: options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [run(text, { bold: options.bold, size: 19 })],
      }),
    ],
  });
}

/** The first column gets twice the share of the others, since it holds names. */
function columnWidths(count: number): number[] {
  const unit = Math.floor(CONTENT_WIDTH / (count + 1));
  return [CONTENT_WIDTH - unit * (count - 1), ...Array<number>(count - 1).fill(unit)];
}

function headerTable(model: DocModel): Table {
  const widths = [2100, CONTENT_WIDTH - 2100];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: model.header.map(
      (row) =>
        new TableRow({
          children: [cell(row.label, widths[0], { bold: true, shaded: true }), cell(row.value, widths[1])],
        }),
    ),
  });
}

function blockToDocx(block: DocBlock): (Paragraph | Table)[] {
  switch (block.kind) {
    case "paragraph":
      return [new Paragraph({ spacing: { after: 120 }, children: [run(block.text)] })];
    case "note":
      return [new Paragraph({ spacing: { after: 120 }, children: [run(block.text, { italics: true, color: MUTED })] })];
    case "bullets":
      return block.items.map((item) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [run(item)] }));
    case "table": {
      const widths = columnWidths(block.columns.length);
      const numericFrom = block.numericFrom ?? Number.POSITIVE_INFINITY;
      const headerRow = new TableRow({
        tableHeader: true,
        children: block.columns.map((c, i) => cell(c, widths[i], { bold: true, shaded: true, right: i >= numericFrom })),
      });
      const bodyRows = block.rows.map(
        (row, rowIndex) =>
          new TableRow({
            children: row.map((value, i) =>
              cell(value, widths[i], {
                right: i >= numericFrom,
                bold: !!block.totalRow && rowIndex === block.rows.length - 1,
              }),
            ),
          }),
      );
      return [
        new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...bodyRows] }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
      ];
    }
  }
}

export function buildDocx(model: DocModel): Document {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [run(`${model.audience.toUpperCase()} · AZIMUT INVESTMENT MANAGEMENT SINGAPORE`, { bold: true, size: 16, color: MUTED })] }),
    new Paragraph({ spacing: { after: 200 }, children: [run(model.title, { bold: true, size: 40, color: ACCENT })] }),
    headerTable(model),
  ];
  for (const section of model.sections) {
    children.push(
      new Paragraph({ spacing: { before: 320, after: 120 }, keepNext: true, children: [run(section.heading, { bold: true, size: 26, color: ACCENT })] }),
    );
    for (const block of section.blocks) children.push(...blockToDocx(block));
  }
  children.push(
    new Paragraph({ spacing: { before: 360 }, children: [run(`Drafted by the Daily Market Brief agent. ${SAMPLE_BANNER}`, { italics: true, size: 16, color: MUTED })] }),
  );

  return new Document({
    creator: "Daily Market Brief (prototype)",
    title: model.title,
    description: SAMPLE_BANNER,
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
          },
        },
        children,
      },
    ],
  });
}

export function docxBuffer(model: DocModel): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(model));
}

/** Browser only: builds the .docx and triggers a download. */
export async function downloadDocx(model: DocModel): Promise<void> {
  const blob = await Packer.toBlob(buildDocx(model));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = model.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
