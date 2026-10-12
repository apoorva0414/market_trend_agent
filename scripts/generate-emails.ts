// Exports the 9 AM email for each RM as public/email-preview-<rmId>.html, from the same
// template the landing page uses. Runs automatically before `npm run dev` and `npm run build`.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { data, DEMO_DATE } from "../src/data";
import { buildEmailModel, renderEmailDocument } from "../src/email/template";
import { runScan } from "../src/logic/scan";

// The Open brief button needs an absolute address so the file also works when opened from disk.
// Locally that is the dev server; the GitHub Pages workflow sets APP_URL to the published site.
const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
mkdirSync(publicDir, { recursive: true });

// The logo is supplied by the client as public/brand/azimut-logo.svg or .png. The previews sit
// next to that folder, so a relative path works wherever they are served from. Without the file
// the template falls back to the text wordmark.
const logoUrl = ["brand/azimut-logo.svg", "brand/azimut-logo.png"].find((file) => existsSync(resolve(publicDir, file))) ?? null;

for (const rm of data.rms) {
  const scan = runScan({ date: DEMO_DATE, rmId: rm.id, upTo: "morning" });
  const model = buildEmailModel(scan, rm);
  // The app uses hash routing, so the route and the RM both sit after the #.
  const briefUrl = `${appUrl}/#/brief?rm=${rm.id}`;
  writeFileSync(resolve(publicDir, `email-preview-${rm.id}.html`), renderEmailDocument(model, { briefUrl, logoUrl }));
  console.log(`Wrote public/email-preview-${rm.id}.html · ${model.subject}`);
}
console.log(logoUrl ? `Logo: public/${logoUrl}` : "Logo: none found in public/brand/, using the text wordmark");
