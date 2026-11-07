// Exports today's emails for each RM from the same templates the inbox uses:
//   public/email-preview-<rmId>.html            the MarketPulse Daily Brief (no links)
//   public/alert-preview-<rmId>-<alertId>.html  each Client Alert the monitor sends during the day
// Runs automatically before `npm run dev` and `npm run build`.
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { data, DEMO_DATE } from "../src/data";
import { buildAlertEmail, buildBriefEmail, renderEmailDocument } from "../src/email/template";
import { bookStateAt } from "../src/logic/book";
import { runDailyBrief } from "../src/logic/brief";
import { simulateMonitor } from "../src/logic/monitor";

// The Client Alert's button needs an absolute address so the file also works when opened from disk.
// Locally that is the dev server; the GitHub Pages workflow sets APP_URL to the published site.
const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
mkdirSync(publicDir, { recursive: true });

// The client supplies the logo as public/brand/azimut-logo.svg or .png. Without it, a text wordmark.
const logoUrl = ["brand/azimut-logo.svg", "brand/azimut-logo.png"].find((file) => existsSync(resolve(publicDir, file))) ?? null;

for (const file of readdirSync(publicDir).filter((f) => f.startsWith("alert-preview-"))) unlinkSync(resolve(publicDir, file));

for (const rm of data.rms) {
  const brief = buildBriefEmail(runDailyBrief({ date: DEMO_DATE, rmId: rm.id }), rm);
  writeFileSync(resolve(publicDir, `email-preview-${rm.id}.html`), renderEmailDocument(brief, { logoUrl }));
  console.log(`Wrote public/email-preview-${rm.id}.html · ${brief.subject}`);

  for (const alert of simulateMonitor({ date: DEMO_DATE, rmId: rm.id, until: "23:59" }).alerts) {
    const email = buildAlertEmail(alert, rm, bookStateAt({ date: DEMO_DATE, rmId: rm.id, at: alert.time }));
    const file = `alert-preview-${rm.id}-${alert.id}.html`;
    writeFileSync(resolve(publicDir, file), renderEmailDocument(email, { href: `${appUrl}/#/alerts/${alert.id}?rm=${rm.id}`, logoUrl }));
    console.log(`Wrote public/${file} · ${email.subject}`);
  }
}
console.log(logoUrl ? `Logo: public/${logoUrl}` : "Logo: none found in public/brand/, using the text wordmark");
