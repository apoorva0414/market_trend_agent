import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { data, DEMO_DATE, HOLDINGS_AS_OF } from "../data";
import { runScan } from "../logic/scan";
import { splitSentences } from "../logic/text";
import { buildPortfolioReviewHandoff, buildProposalHandoff, DISCLAIMER } from "./builders";
import { DOCX_HEADING_COLOR, docxBuffer } from "./docx";
import { THEME_ZH } from "./mandarin";
import { docToText, portfolioReviewToDoc, proposalToDoc, talkingPointsMessage, talkingPointsToDoc } from "./model";
import { buildTalkingPoints, draftTalkingPoints, wordingOf } from "./talkingPoints";

const rm = data.rms[0];
const ctx = { rm, date: DEMO_DATE };
const scan = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" });
const top = scan.clients[0];
const noteHolder = scan.clients.find((r) => r.primary.nextStep.flag === "Barrier risk")!;

const talkingPoints = buildTalkingPoints(noteHolder, ctx);
const review = buildPortfolioReviewHandoff(top, ctx, "Call before Thursday.", ["Client uses 2 banks."], "2026-10-12T01:30:00.000Z");
const proposal = buildProposalHandoff(scan.prospectThemes[0], "Tech founder, SGD 10m, growth", ctx, "", [], "2026-10-12T01:30:00.000Z");

const models = [talkingPointsToDoc(talkingPoints), portfolioReviewToDoc(review), proposalToDoc(proposal)];

describe("shared header (section 8)", () => {
  it("is the same five fields on all three documents", () => {
    for (const model of models) {
      expect(model.header.map((h) => h.label).slice(1)).toEqual(["Theme", "Why now", "Data as of", "Prepared for"]);
      expect(model.header[3].value).toBe(HOLDINGS_AS_OF);
      expect(model.header[4].value).toBe("Kevin Tan · 12 Oct 2026");
    }
    expect(models[0].header[0]).toEqual({ label: "Client", value: noteHolder.client.name });
    expect(models[2].header[0]).toEqual({ label: "Prospect", value: "Tech founder, SGD 10m, growth" });
  });
});

describe("client talking points (8.1)", () => {
  it("drafts 3 to 5 talking points, 2 to 3 next steps and the disclaimer placeholder", () => {
    for (const row of scan.clients) {
      const doc = buildTalkingPoints(row, ctx);
      expect(doc.wording.talkingPoints.length, row.client.name).toBeGreaterThanOrEqual(3);
      expect(doc.wording.talkingPoints.length, row.client.name).toBeLessThanOrEqual(5);
      expect(doc.wording.nextSteps.length, row.client.name).toBeGreaterThanOrEqual(2);
      expect(doc.wording.nextSteps.length, row.client.name).toBeLessThanOrEqual(3);
      expect(doc.disclaimer).toBe(DISCLAIMER);
    }
  });

  it("explains barrier scenarios for the structured note holder and grounds points in the house view", () => {
    expect(talkingPoints.flag).toBe("Barrier risk");
    expect(talkingPoints.wording.talkingPoints.join(" ")).toMatch(/above the barrier/);
    expect(talkingPoints.wording.talkingPoints.some((p) => p.startsWith("House view on"))).toBe(true);
  });

  it("renders any version from the same facts: only the wording changes", () => {
    const shorter = { ...talkingPoints.wording, talkingPoints: talkingPoints.wording.talkingPoints.slice(0, 2) };
    const v1 = talkingPointsToDoc(talkingPoints);
    const v2 = talkingPointsToDoc(talkingPoints, shorter, 2);
    expect(v2.header).toEqual(v1.header);
    expect(v2.sections[1]).toEqual(v1.sections[1]); // the holdings table
    expect(v2.sections[2].blocks[0]).toMatchObject({ kind: "bullets", items: shorter.talkingPoints });
    expect(v2.fileName).toMatch(/_v2\.docx$/);
  });

  it("produces a share message without template leftovers", () => {
    const { subject, body } = talkingPointsMessage(talkingPoints, talkingPoints.wording, rm.name);
    expect(subject).toContain("Big Tech");
    expect(body).toContain(`Dear ${noteHolder.client.name}`);
    expect(body).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe("pre-written Mandarin (1.5 offline fallback)", () => {
  it("has one Mandarin sentence for each English summary sentence of every theme", () => {
    for (const theme of data.themes) {
      expect(THEME_ZH[theme.id], theme.id).toBeDefined();
      expect(THEME_ZH[theme.id].clientSummary, theme.id).toHaveLength(splitSentences(theme.clientSummary).length);
    }
  });

  it("gives every client a Mandarin draft with the same shape and the same figures as the English one", () => {
    const digits = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).sort();
    for (const rmEntry of data.rms) {
      for (const upTo of ["morning", "intraday"] as const) {
        for (const row of runScan({ date: DEMO_DATE, rmId: rmEntry.id, upTo }).clients) {
          const draft = draftTalkingPoints(row, { rm: rmEntry, date: DEMO_DATE });
          const en = wordingOf(draft, "en");
          const zh = wordingOf(draft, "zh");
          expect(zh.talkingPoints, row.client.name).toHaveLength(en.talkingPoints.length);
          expect(zh.nextSteps, row.client.name).toHaveLength(en.nextSteps.length);
          expect(zh.summary, row.client.name).toMatch(/[一-鿿]/);
          // Amounts and percentages in the summary are carried over digit for digit.
          const impact = draft.impact[0];
          expect(digits(impact.zh), row.client.name).toEqual(digits(impact.en));
        }
      }
    }
  });

  it("frames a Mandarin version with Mandarin headings and greeting", () => {
    const zh = wordingOf(draftTalkingPoints(noteHolder, ctx), "zh");
    expect(talkingPointsToDoc(talkingPoints, zh).sections.map((s) => s.heading)).toEqual(["摘要", "对您投资组合的影响", "沟通要点", "建议的后续步骤", "免责声明"]);
    expect(talkingPointsMessage(talkingPoints, zh, rm.name).body).toContain(`尊敬的 ${noteHolder.client.name}：`);
  });
});

describe("hand-off payloads (8.2, 8.3 and update 2.1)", () => {
  it("carries the client, exposure, options and RM context for a portfolio review", () => {
    expect(review.kind).toBe("portfolio-review");
    expect(review.client).toMatchObject({ mandate: "Discretionary", riskProfile: "Conservative" });
    expect(review.affectedHoldings.length).toBeGreaterThan(0);
    expect(review.exposure.estImpactUsd).toBeLessThan(0);
    expect(review.optionsToDiscuss.every((o) => o.riskLevel <= 2)).toBe(true);
    expect(review.rmContext).toBe("Call before Thursday.");
    expect(review.openGaps).toEqual(["Client uses 2 banks."]);
    expect(JSON.parse(JSON.stringify(review))).toEqual(review);
  });

  it("shows the RM context and open gaps in the document under RM context", () => {
    const section = portfolioReviewToDoc(review).sections.at(-1)!;
    expect(section.heading).toBe("RM context");
    expect(docToText(portfolioReviewToDoc(review))).toContain("Call before Thursday.");
    expect(docToText(portfolioReviewToDoc(review))).toContain("Open gaps when this was sent: Client uses 2 banks.");
    expect(proposalToDoc(proposal).sections.at(-1)).toMatchObject({ heading: "RM context", blocks: [{ kind: "paragraph", text: "No context added." }] });
  });

  it("carries the prospect profile, products and risks for a proposal", () => {
    expect(proposal.kind).toBe("proposal");
    expect(proposal.prospectFit).toMatchObject({ profile: "Tech founder, SGD 10m, growth", suits: "Growth investors underweight Asia" });
    expect(proposal.products.length).toBeGreaterThan(0);
    expect(proposal.keyRisks.length).toBeGreaterThanOrEqual(2);
  });

  it("renders every document to text without template leftovers", () => {
    for (const model of models) expect(docToText(model)).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe(".docx export (update 4: light, with brand-blue headings)", () => {
  it("builds a Word file for each of the three document types", async () => {
    for (const model of models) {
      const buffer = await docxBuffer(model);
      expect(buffer.subarray(0, 2).toString("latin1"), model.title).toBe("PK");
      expect(buffer.length).toBeGreaterThan(3000);
      expect(model.fileName).toMatch(/\.docx$/);
    }
  });

  it("uses Azimut blue for headings and leaves the page white with dark text", async () => {
    expect(DOCX_HEADING_COLOR).toBe("356292");
    const zip = await JSZip.loadAsync(await docxBuffer(models[0]));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain('w:color w:val="356292"');
    expect(xml).toContain('w:color w:val="1F2937"'); // body text
    expect(xml).not.toContain("<w:background"); // no page background: prints white
    const fills = [...xml.matchAll(/w:fill="([0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
    for (const fill of fills) expect(Number.parseInt(fill.slice(0, 2), 16), fill).toBeGreaterThan(0xe0); // only pale shading
  });
});
