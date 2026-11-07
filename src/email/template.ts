import { alertReasonLine } from "../config/alertRules";
import { data as defaultData, type DataSet, DELIVERY_TIME, SAMPLE_BANNER } from "../data";
import { EVENT_CAUSE } from "../logic/book";
import { fmtDateLong, fmtDateShort, joinList, plural } from "../logic/format";
import { splitSentences } from "../logic/text";
import { PALETTE } from "../theme/palette";
import type { Alert, BookState, DailyBrief, Priority, Rm, ThemeType } from "../types";

// Two separate products, two separate emails (update 3). Both are rendered in the inbox and exported
// as standalone HTML by scripts/generate-emails.ts, with the dark Azimut styling as inline styles.
//   - The MarketPulse Daily Brief: the whole brief, read only, with no button or link.
//   - The Client Alert: event-driven, amber identity, the RM's way into the portal.

export interface EmailMeta {
  from: string;
  to: string;
  /** "09:00 SGT" */
  time: string;
  subject: string;
  dateLong: string;
}

export interface BriefEmailModel extends EmailMeta {
  kind: "brief";
  firstName: string;
  summary: string;
  themes: { title: string; type: ThemeType; whatHappened: string; why: string; relevance: string; sources: string }[];
  events: string[];
  houseView: string;
  footer: string;
}

export interface AlertEmailModel extends EmailMeta {
  kind: "alert";
  alertId: string;
  opening: string;
  causes: { headline: string; text: string; badge: { label: string; type: ThemeType | "event" } }[];
  clients: { name: string; priority: Priority; why: string }[];
  ready: string;
  reason: string;
  footer: string;
}

export type EmailModel = BriefEmailModel | AlertEmailModel;

export const BRIEF_FROM = "MarketPulse (Azimut)";
export const ALERT_FROM = "MarketPulse Alerts (Azimut)";
export const BRIEF_FOOTER = "For information only. No action needed. If something materially affects a specific client, you'll receive a separate Client Alert.";
export const ALERT_FOOTER = "Figures and holdings are only available in the portal. We check news as it arrives and only email you when a client is materially affected.";
export const READY_LINE = "Talking points drafted";
export const VIEW_NOTE = "Opinion: stress-test before sharing";

/** The 9 AM MarketPulse Daily Brief, from the output of the 08:30 brief job. Counts and asset types only. */
export function buildBriefEmail(brief: DailyBrief, rm: Rm): BriefEmailModel {
  const [lead, ...rest] = brief.themes.map((t) => t.theme);
  const summary = lead
    ? `A ${lead.briefTone} morning: ${lead.briefHeadline}${rest.length ? `, with ${joinList(rest.map((t) => t.briefMention))} also in focus` : ""}.`
    : "A quiet morning, with nothing market-moving overnight.";
  return {
    kind: "brief",
    from: BRIEF_FROM,
    to: rm.name,
    time: `${DELIVERY_TIME} SGT`,
    subject: `MarketPulse Daily Brief, ${fmtDateShort(brief.date)}: ${plural(brief.themes.length, "theme")}`,
    dateLong: fmtDateLong(brief.date),
    firstName: rm.name.split(" ")[0],
    summary,
    themes: brief.themes.map(({ theme, clientsExposed, assetTypes }) => ({
      title: theme.title,
      type: theme.type,
      whatHappened: theme.whatHappened,
      why: splitSentences(theme.whyItMatters)[0],
      relevance:
        clientsExposed > 0
          ? `${clientsExposed} of your clients ${clientsExposed === 1 ? "holds" : "hold"} ${assetTypes}.`
          : "No direct exposure in your book.",
      sources: theme.sources.join(", "),
    })),
    events: brief.events.map(({ event, holders }) => `${event.eventType} on ${event.instrument}: held by ${holders} of your clients.`),
    houseView: brief.houseView.map((h) => `${h.assetClass}: ${h.stance.charAt(0).toLowerCase()}${h.stance.slice(1)}`).join(". ") + ".",
    footer: BRIEF_FOOTER,
  };
}

/** A Client Alert, built from the alert and the book as it stood when the alert was detected. */
export function buildAlertEmail(alert: Alert, rm: Rm, state: BookState, dataSet: DataSet = defaultData): AlertEmailModel {
  const count = alert.triggers.length;
  const keys = [...new Set(alert.triggers.map((t) => t.key))];
  const causes = keys.map((key) => {
    const theme = state.themes.find((t) => t.id === key);
    if (theme) {
      return {
        cause: theme.alertCause,
        headline: theme.title,
        text: `${splitSentences(theme.whatHappened)[0]} ${splitSentences(theme.whyItMatters)[0]}`,
        badge: { label: theme.type, type: theme.type },
      };
    }
    const event = dataSet.positionEvents.find((e) => e.id === key);
    return {
      cause: event ? EVENT_CAUSE[event.eventType] : key,
      headline: event?.headline ?? key,
      text: event?.description ?? "",
      badge: { label: event?.eventType ?? "Event", type: "event" as const },
    };
  });
  const priority = new Map(state.clients.map((row) => [row.client.id, row.priority]));
  const name = (id: string) => dataSet.clients.find((c) => c.id === id)?.name ?? id;
  return {
    kind: "alert",
    alertId: alert.id,
    from: ALERT_FROM,
    to: rm.name,
    time: `${alert.time} SGT`,
    subject: `Client Alert: ${plural(count, "client")} affected by ${joinList(causes.map((c) => c.cause))}`,
    dateLong: fmtDateLong(alert.date),
    opening: `New developments at ${alert.time} SGT materially affect ${count} of your clients.`,
    causes: causes.map(({ cause: _cause, ...rest }) => rest),
    clients: alert.triggers.map((t) => ({ name: name(t.clientId), priority: priority.get(t.clientId) ?? "Low", why: t.whyClient })),
    ready: READY_LINE,
    reason: alertReasonLine(),
    footer: ALERT_FOOTER,
  };
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const { bg, surface, raised, line, ink, soft, muted, brand, brandTint, checkpoint, banner } = PALETTE;
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const pill = "display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.03em;white-space:nowrap;";
const sectionLabel = `margin:28px 0 10px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${muted};`;
const fieldLabel = `font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${muted};`;

function typeBadge(type: ThemeType): string {
  const style =
    type === "Pulse"
      ? `${pill}background:${brand};color:#ffffff;border:1px solid ${brand};`
      : `${pill}background:transparent;color:${brandTint};border:1px solid ${brandTint};`;
  return `<span style="${style}">${type}</span>`;
}

function eventBadge(label: string): string {
  return `<span style="${pill}background:transparent;color:${checkpoint};border:1px solid ${checkpoint};">${esc(label)}</span>`;
}

function priorityBadge(priority: Priority): string {
  const styles: Record<Priority, string> = {
    High: `background:${brand};color:#ffffff;border:1px solid ${brand};`,
    Medium: `background:${raised};color:${brandTint};border:1px solid ${brand};`,
    Low: `background:${raised};color:${muted};border:1px solid ${line};`,
  };
  return `<span style="${pill}${styles[priority]}">${priority}</span>`;
}

/** Logo (or "AZIMUT" wordmark) and the product name. The Client Alert never names the brief. */
function brandHeader(logoUrl: string | null, product: string): string {
  const mark = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Azimut" height="26" style="display:inline-block;height:26px;width:auto;vertical-align:middle;border:0;" />`
    : `<span style="font-size:17px;font-weight:600;letter-spacing:0.28em;color:#ffffff;vertical-align:middle;">AZIMUT</span>`;
  return `<div style="padding:0 0 18px;margin:0 0 22px;border-bottom:1px solid ${line};">${mark}<span style="margin-left:12px;padding-left:12px;border-left:1px solid ${line};font-size:13px;color:${muted};vertical-align:middle;">${esc(product)}</span></div>`;
}

function footer(text: string): string {
  return `<p style="margin:28px 0 0;padding-top:14px;border-top:1px solid ${line};font-size:12px;color:${muted};">${esc(text)}</p>`;
}

export interface EmailRenderOptions {
  /** Where the Client Alert's button goes. The brief has no links. */
  href?: string;
  /** Logo image URL, or null to use the text wordmark. */
  logoUrl: string | null;
}

/** The email body, with inline styles as an email client would need. */
export function renderEmailBody(model: EmailModel, { href = "#", logoUrl }: EmailRenderOptions): string {
  const wrap = (inner: string) => `<div style="font-family:${SANS};color:${soft};font-size:15px;line-height:1.55;max-width:600px;">${inner}</div>`;

  if (model.kind === "brief") {
    const themes = model.themes
      .map(
        (t) => `<div style="padding:16px 0;border-top:1px solid ${line};">
    <div style="margin-bottom:8px;">${typeBadge(t.type)}${t.type === "View" ? `<span style="margin-left:8px;font-size:12px;color:${muted};">${VIEW_NOTE}</span>` : ""}</div>
    <div style="font-size:17px;font-weight:600;color:${ink};">${esc(t.title)}</div>
    <p style="margin:8px 0 0;"><span style="${fieldLabel}">What happened</span><br />${esc(t.whatHappened)}</p>
    <p style="margin:8px 0 0;"><span style="${fieldLabel}">Why it matters</span><br />${esc(t.why)}</p>
    <p style="margin:8px 0 0;color:${ink};"><span style="${fieldLabel}">Relevance to your book</span><br />${esc(t.relevance)}</p>
    <p style="margin:8px 0 0;font-size:12px;color:${muted};">Sources: ${esc(t.sources)}</p>
  </div>`,
      )
      .join("");
    const events = model.events.length
      ? `<p style="${sectionLabel}">Events on holdings in your book</p>${model.events.map((e) => `<p style="margin:0 0 6px;color:${ink};">${esc(e)}</p>`).join("")}`
      : "";
    return wrap(`${brandHeader(logoUrl, "MarketPulse Daily Brief")}
  <p style="margin:0 0 12px;color:${ink};">Good morning ${esc(model.firstName)},</p>
  <p style="margin:0;">${esc(model.summary)}</p>
  <p style="${sectionLabel}">Market summary</p>
  ${themes}
  ${events}
  <p style="${sectionLabel}">House view</p>
  <p style="margin:0;">${esc(model.houseView)}</p>
  ${footer(model.footer)}`);
  }

  const causes = model.causes
    .map(
      (c) => `<div style="padding:14px 0;border-top:1px solid ${line};">
    <div style="margin-bottom:6px;">${c.badge.type === "event" ? eventBadge(c.badge.label) : typeBadge(c.badge.type)}</div>
    <div style="font-size:16px;font-weight:600;color:${ink};">${esc(c.headline)}</div>
    <p style="margin:6px 0 0;">${esc(c.text)}</p>
  </div>`,
    )
    .join("");
  const clients = model.clients
    .map(
      (c) => `<div style="padding:14px 0;border-top:1px solid ${line};">
    <div><span style="font-size:16px;font-weight:600;color:${ink};margin-right:10px;">${esc(c.name)}</span>${priorityBadge(c.priority)}</div>
    <p style="margin:6px 0 0;"><span style="${fieldLabel}">Why this client</span><br />${esc(c.why)}</p>
    <p style="margin:6px 0 0;font-size:13px;color:${checkpoint};"><span style="${fieldLabel}">Ready for you</span><br />${esc(model.ready)}</p>
  </div>`,
    )
    .join("");
  return `<div style="background:${checkpoint};color:#1a1305;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;padding:8px 14px;border-radius:6px 6px 0 0;margin:0 0 22px;max-width:600px;">CLIENT ALERT</div>${wrap(`${brandHeader(logoUrl, "MarketPulse Alerts")}
  <p style="margin:0;color:${ink};">${esc(model.opening)}</p>
  <p style="${sectionLabel}">What happened</p>
  ${causes}
  <p style="${sectionLabel}">Clients affected</p>
  ${clients}
  <p style="margin:28px 0 0;"><a data-open-link href="${esc(href)}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:6px;">Open in portal</a></p>
  <p style="margin:24px 0 0;font-size:13px;"><span style="${fieldLabel}">Why you received this</span><br />${esc(model.reason)}</p>
  ${footer(model.footer)}`)}`;
}

/** Standalone page for the exported previews, framed like a mail client. */
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
<div style="max-width:700px;margin:32px auto;padding:0 16px;">
  <div style="background:${surface};border:1px solid ${model.kind === "alert" ? checkpoint : line};border-radius:10px;overflow:hidden;">
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
