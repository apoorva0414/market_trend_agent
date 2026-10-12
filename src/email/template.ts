import { DELIVERY_TIME, SAMPLE_BANNER, SCAN_TIME } from "../data";
import { fmtDateLong, fmtDateShort, plural } from "../logic/format";
import { PALETTE } from "../theme/palette";
import type { Priority, Rm, ScanResult, ThemeType } from "../types";

// One template for the 9 AM email. The landing page renders it inside the app and
// scripts/generate-emails.ts exports it as public/email-preview-<rmId>.html.
// It uses the same dark Azimut styling as the app, written as inline styles.

export interface EmailModel {
  rmId: string;
  from: string;
  to: string;
  time: string;
  subject: string;
  firstName: string;
  dateLong: string;
  intro: string;
  themes: { title: string; type: ThemeType }[];
  /** Names and priority only. Holdings, amounts and impacts stay in the app. */
  topClients: { name: string; priority: Priority }[];
  prospectLine: string;
  footer: string;
}

/** Always built from the scheduled morning scan, which is what the 9 AM email reflects. */
export function buildEmailModel(scan: ScanResult, rm: Rm): EmailModel {
  const themeCount = plural(scan.themes.length, "theme");
  const clientCount = `${plural(scan.clients.length, "client")} to review`;
  const featured = scan.prospectThemes.find((p) => p.featured) ?? scan.prospectThemes[0];
  return {
    rmId: rm.id,
    from: "Daily Market Brief (Azimut)",
    to: rm.name,
    time: `${DELIVERY_TIME} SGT`,
    subject: `Daily Market Brief, ${fmtDateShort(scan.date)}: ${themeCount}, ${clientCount}`,
    firstName: rm.name.split(" ")[0],
    dateLong: fmtDateLong(scan.date),
    intro: `Your brief for ${fmtDateLong(scan.date)} is ready: ${themeCount} and ${clientCount}.`,
    themes: scan.themes.map((t) => ({ title: t.title, type: t.type })),
    topClients: scan.clients.slice(0, 3).map((row) => ({ name: row.client.name, priority: row.priority })),
    prospectLine: featured ? `1 prospect theme worth exploring: ${featured.theme.title}` : "No prospect theme today",
    footer: `Generated automatically at ${SCAN_TIME} SGT. Client details are only available in the app.`,
  };
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const { bg, surface, raised, line, ink, soft, muted, brand, brandTint, checkpoint, banner } = PALETTE;
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const pill = "display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.03em;white-space:nowrap;";

function typeBadge(type: ThemeType): string {
  const style =
    type === "Pulse"
      ? `${pill}background:${brand};color:#ffffff;border:1px solid ${brand};`
      : `${pill}background:transparent;color:${brandTint};border:1px solid ${brandTint};`;
  return `<span style="${style}">${type}</span>`;
}

function priorityBadge(priority: Priority): string {
  const styles: Record<Priority, string> = {
    High: `background:${brand};color:#ffffff;border:1px solid ${brand};`,
    Medium: `background:${raised};color:${brandTint};border:1px solid ${brand};`,
    Low: `background:${raised};color:${muted};border:1px solid ${line};`,
  };
  return `<span style="${pill}${styles[priority]}">${priority}</span>`;
}

const sectionLabel = `margin:26px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${muted};`;
const row = `padding:9px 0;border-bottom:1px solid ${line};`;

/**
 * The email header: the Azimut logo when a logo file has been added to public/brand/,
 * otherwise a text wordmark.
 */
function brandHeader(logoUrl: string | null): string {
  const mark = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Azimut" height="26" style="display:inline-block;height:26px;width:auto;vertical-align:middle;border:0;" />`
    : `<span style="font-size:17px;font-weight:600;letter-spacing:0.28em;color:#ffffff;vertical-align:middle;">AZIMUT</span>`;
  return `<div style="padding:0 0 18px;margin:0 0 22px;border-bottom:1px solid ${line};">${mark}<span style="margin-left:12px;padding-left:12px;border-left:1px solid ${line};font-size:13px;color:${muted};vertical-align:middle;">Daily Market Brief</span></div>`;
}

export interface EmailRenderOptions {
  /** Where the Open brief button goes. */
  briefUrl: string;
  /** Logo image URL, or null to use the text wordmark. */
  logoUrl: string | null;
}

/** The email body, with inline styles as an email client would need. */
export function renderEmailBody(model: EmailModel, { briefUrl, logoUrl }: EmailRenderOptions): string {
  const themeRows = model.themes
    .map(
      (t) =>
        `<tr><td style="${row}font-size:15px;color:${ink};">${esc(t.title)}</td><td style="${row}text-align:right;width:70px;">${typeBadge(t.type)}</td></tr>`,
    )
    .join("");
  const clientRows = model.topClients
    .map(
      (c, i) =>
        `<tr><td style="${row}width:26px;font-size:13px;color:${muted};">${i + 1}</td><td style="${row}font-size:15px;color:${ink};">${esc(c.name)}</td><td style="${row}text-align:right;width:80px;">${priorityBadge(c.priority)}</td></tr>`,
    )
    .join("");

  return `<div style="font-family:${SANS};color:${soft};font-size:15px;line-height:1.55;max-width:560px;">
  ${brandHeader(logoUrl)}
  <p style="margin:0 0 12px;color:${ink};">Good morning ${esc(model.firstName)},</p>
  <p style="margin:0;">${esc(model.intro)}</p>
  <p style="${sectionLabel}">Today's themes</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid ${line};">${themeRows}</table>
  <p style="${sectionLabel}">Clients to look at first</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid ${line};">${clientRows}</table>
  <p style="${sectionLabel}">Prospects</p>
  <p style="margin:0;">${esc(model.prospectLine)}</p>
  <p style="margin:28px 0 0;">
    <a data-open-brief href="${esc(briefUrl)}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:6px;">Open brief</a>
  </p>
  <p style="margin:28px 0 0;padding-top:14px;border-top:1px solid ${line};font-size:12px;color:${muted};">${esc(model.footer)}</p>
</div>`;
}

/** Standalone page for public/email-preview-<rmId>.html, framed like a mail client. */
export function renderEmailDocument(model: EmailModel, options: EmailRenderOptions): string {
  const meta = (label: string, value: string) =>
    `<tr><td style="padding:3px 14px 3px 0;color:${muted};font-size:13px;vertical-align:top;">${label}</td><td style="padding:3px 0;font-size:13px;color:${ink};">${esc(value)}</td></tr>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" />
<title>${esc(model.subject)}</title>
</head>
<body style="margin:0;background:${bg};font-family:${SANS};">
<div style="background:${banner};border-bottom:1px solid ${checkpoint};color:${checkpoint};font-size:13px;text-align:center;padding:8px 16px;">${esc(SAMPLE_BANNER)}</div>
<div style="max-width:680px;margin:32px auto;padding:0 16px;">
  <div style="background:${surface};border:1px solid ${line};border-radius:10px;overflow:hidden;">
    <div style="padding:20px 28px;border-bottom:1px solid ${line};background:${raised};">
      <div style="font-size:18px;font-weight:600;color:${ink};margin-bottom:10px;">${esc(model.subject)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0">
        ${meta("From", model.from)}
        ${meta("To", model.to)}
        ${meta("Sent", `${model.dateLong}, ${model.time}`)}
      </table>
    </div>
    <div style="padding:28px;">
${renderEmailBody(model, options)}
    </div>
  </div>
</div>
</body>
</html>
`;
}
