# MarketPulse prototype

A clickable demo of a daily agentic workflow for Relationship Managers (RMs) at an External Asset Manager:

Two separate products, run by two separate processes:

1. **MarketPulse Daily Brief**: one scheduled job at 08:30 SGT, delivered by email at 09:00. The email is the whole brief: read only, tailored to the RM's book with counts and asset types, and with nothing to open or act on.
2. **Client Alerts**: an event-driven monitor with no schedule. It checks each news item or holding event as soon as it arrives, at any time of day, and emails the RM only when a client is materially affected. That email leads to the **portal**: for each client, talking points for the RM (refined in a chat and approved) and an entry logged automatically for the client's next scheduled portfolio review.

The agent never contacts clients. The RM decides what, if anything, to share.

The app runs in the browser on sample data. There is no real news feed and no real client data, and nothing is ever sent to a client. The only server-side piece is a small optional endpoint that calls the Claude API for the talking-points chat. Without it, the chat runs offline.

## Run it

Requires Node.js 20.19 or newer (built and tested on Node 22).

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

On the machine this was built on, Node lives in a conda environment, so activate it first in each new terminal:

```bash
conda activate node
```

| Command | What it does |
|---|---|
| `npm test` | Runs the Vitest suite |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm run server` | Runs the talking-points API on its own (port 8787). Not needed for `npm run dev` |
| `npm run check:anchors` | Prints the ranked client list for every RM, at 9 AM and after the ad hoc scan |
| `npm run emails` | Regenerates `public/email-preview-<rmId>.html` (also runs before `dev` and `build`) |
| `npm run data` | Regenerates `src/data/clients.json` and `holdings.json` from `scripts/generate-data.ts` |

### Turn on live AI (optional)

The chat's status dot shows **AI: live** or **AI: offline**.

1. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.
2. Restart `npm run dev`.

The dev server serves the API itself at `/api`, reads the key in Node and never sends it to the browser. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`. `.env` is git-ignored. Never put the key in a `VITE_` variable: those are compiled into the browser bundle.

**The live path has not been run against the real API.** No key was available when this was built. It is covered by tests with a stand-in client and follows the current SDK, but treat the first live run as a test.

With no key, or if a call fails, the chat is offline: the six quick actions give prepared rewrites and other free text gets "AI is offline in this demo. Try a quick action."

### Add the logo

Put the logo at `public/brand/azimut-logo.svg` (or `.png`). It then appears top-left in the header and in the 9 AM email. Without the file, both show a text wordmark "AZIMUT". Run `npm run emails` (or restart the dev server) after adding it so the exported emails pick it up.

## Deploy to GitHub Pages

The repository is set up to build and publish on every push to `main` (`.github/workflows/deploy.yml`).

One-time setup:

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, go to **Settings > Pages > Build and deployment** and set **Source** to **GitHub Actions**.

The site is then served at `https://<owner>.github.io/<repo-name>/`. What makes that work:

- **Base path.** `vite.config.ts` reads `BASE_PATH`, and the workflow sets it to `/<repo-name>/` from the repository name, so nothing needs editing if the repository is renamed. Local runs use `/`.
- **HashRouter.** Routes look like `/#/alerts`, so deep links and refreshes work without server rewrites. Exported Client Alerts link to `/#/alerts/<alertId>?rm=<id>`; the brief has no links.
- **Offline chat by default.** A production build with no `VITE_AI_ENDPOINT` has no API endpoint, makes no API request and shows **AI: offline**. GitHub Pages cannot run the endpoint, and no API key is ever part of the build.

To use live AI on the published site, host `npm run server` somewhere that can hold the key (set `CORS_ORIGIN` to the site's origin), then add a repository variable `AI_ENDPOINT` with its URL, for example `https://your-api-host.example.com/api`. The workflow passes it to the build as `VITE_AI_ENDPOINT`.

To check a Pages-style build locally:

```bash
BASE_PATH=/my-repo/ npm run build
```

## Demo script (about 6 minutes)

Two RMs: **Kevin Tan** (Dedicated ARM) and **Sarah Lim** (Central ARM). The demo is set at 14:00 on Mon 12 Oct 2026, so all of the day's emails are already in.

1. Log in as **Kevin Tan**. The inbox has three emails, newest first: a Client Alert at 13:21 (bond call notice), the MarketPulse Daily Brief at 09:00, and a Client Alert at 06:41, sent as soon as the US rates news broke.
2. Open the Daily Brief. It's the full brief, read only, with nothing to click: "this is your morning read."
3. Open the 06:41 Client Alert. Walk through what happened, why each client and what's ready. Click **Open in portal**.
4. In the portal, open the bond/REIT client (Eleanor Chua). Refine and approve the talking points, choose "Contacted: concerns raised", add a note, then click **Log for next portfolio review**. Later edits stay unsaved until you click **Update log**.
5. Open **Upcoming reviews**: clients by next review date on the left; Eleanor's period on the right, with the "To discuss" list, a plain-language timeline and, folded away, what the Portfolio Review agent will receive.
6. Go to **Alerts** and show Monitor activity: every news item is checked as it arrives, and most send nothing. The oil-sanctions item at 13:05 needed no alert; the call notice at 13:20 sent the 13:21 alert for 1 new client (Victor Ong). Nobody is alerted twice.
7. Switch to **Sarah Lim**: only the brief, and every item says "No alert needed". "You only hear from Client Alerts when it matters, whenever that is."

To repeat the demo: **Reset demo** on the Activity log page clears the chats, the activity log and today's review entries (the two seeded Eleanor Chua entries stay). **Clear log** empties only the activity log. Both ask for confirmation on the page.

## What is in the box

```
src/
  types.ts            All types, including alerts, the review log entry and the chat workspace
  data/               Static sample JSON (RMs, clients, holdings, news, themes, products, house view)
  config/alertRules.ts  Alert thresholds (demo values, firm-wide)
  logic/              Pure functions: exposure, scoring, runScan, evaluateAlerts, review log helpers
  documents/          Talking-points builder (English and pre-written Mandarin), layout model, .docx export
  talkingPoints/      Chat logic: locked figures, offline quick actions, versions and approval, diff
  ai/client.ts        Browser side of the chat API, and the offline default
  email/template.ts   The 9 AM brief and the CTA alert email, shared by the inbox and the HTML export
  theme/palette.ts    The dark Azimut palette and contrast helpers
  state/              App state (React context) and guarded localStorage/sessionStorage access
  components/, pages/ The UI
server/               The Express endpoint, the Claude call and the system prompt
scripts/              Data generator, email export, anchor check
public/               email-preview-<rmId>.html and alert-preview-<rmId>-<alertId>.html; brand/ for the logo you add
.github/workflows/    GitHub Pages deployment
```

### The two processes

- **`runDailyBrief({ date, rmId })`** (`src/logic/brief.ts`) is the 08:30 job. It reads the morning batch only, orders themes by how many of the RM's clients they touch, and returns counts and asset types, never client names or figures. It never creates alerts.
- **`evaluateIncomingItem({ date, rmId, item, alreadyAlerted })`** (`src/logic/monitor.ts`) is the alert monitor. It is called for each incoming news item or position event (or several that arrive at the same moment), applies the alert rule with deduplication, and returns a Client Alert timed a minute after the item, or `null`. `simulateMonitor` replays it over the day for the inbox and Monitor activity.
- Both use the shared helpers in `src/logic/book.ts` (items received so far, themes, exposure, impact and priority). The old `runScan()` is gone, and `alertRules.ts` holds thresholds only, with no schedule.
- The prototype has no real scheduler: the app replays the monitor up to 14:00 (`DEMO_NOW` in `src/data/index.ts`), so the inbox and Monitor activity show the whole day so far.

### How the talking-points chat works

- **Structured document.** Talking points are an object with fact fields (header, holdings table, figures, disclaimer) and wording fields (summary, talking points, next steps). Only the wording is ever sent to the model as editable, and only the wording differs between versions.
- **Locked figures.** Every number in a rewrite must exist in the source data (locked facts, theme, house view, current text), written the same way. A field with any other number is discarded, the previous text is kept and the chat shows "Kept the original figures. Numbers come from the portfolio data." The same check runs in the endpoint and in the browser.
- **Versions.** v1 is the generated draft. A chat round that changes the wording adds a version. Restoring copies an old version forward as a new one.
- **Approval.** "I have reviewed this" approves the version on screen and locks the chat. Download, copy, email and WhatsApp send only the approved version. Unlock to edit reopens the chat, and the next edit clears the approval.
- **Endpoint.** `POST /api/refine-talking-points` takes `{ currentDoc, factsLocked, theme, client, houseView, instruction, history }` and returns `{ updatedDoc, reply }` (plus `rejectedFields`). `GET /api/status` tells the browser whether a key is configured.

### How alerts work

`evaluateAlerts({ scanResult, rmId, alreadyAlerted })` in `src/logic/alerts.ts` returns one trigger per client who meets the rule, with thresholds from `src/config/alertRules.ts`:

- **Position event**: the client holds an instrument named in a position event (`src/data/positionEvents.json`): call notice, downgrade, barrier proximity or default. Always alerts.
- **A, material impact**: estimated impact at or below −1.0% of AUM from one theme.
- **B, concentrated exposure to a sharp move**: 10% of AUM or more in holdings that a theme moves by −3% or more.

Gains never alert while `includeGains` is false. When several conditions hold, the reason shown follows that order. A client already alerted today is not alerted again for anything that met the rule at the time. Alerts have no fixed time: each goes out a minute after the item that caused it, with at most one email per arrival.

### Log to Portfolio Review

Opening a client from an alert drafts one `ReviewLogEntry` (in `localStorage`, next to the activity log). It updates itself when talking points are approved and shared. The RM can add an outcome, a one-line note and "Discuss at next review"; nothing is required. Outcome, note and the discuss flag are edited in the panel and saved only when the RM clicks **Log for next portfolio review** (or chooses "No contact needed"), which sets `loggedAt`. After that, **Update log** is enabled only when something has changed, and saves the change. **Upcoming reviews** (`/reviews`, `/reviews/:clientId`) lists the RM's clients by next review date and shows, for the selected client, the "To discuss" list, the period timeline and the JSON payload the Portfolio Review agent will receive. `/review-log` and `/portfolio-review/:clientId` redirect there.

## Choices made where the specs were open

After update 3 (demo feedback):

- **Two RMs**, one per ARM model. Daniel Wong and his clients were removed, so rule B (concentrated exposure) no longer fires in the demo; it stays in `alertRules.ts`, in "How alerts work" and in the tests.
- **No demo controls or demo date.** The app is fixed at 14:00, with the 13:21 alert already in the inbox. **Reset demo** moved to the Activity log page.
- **Review log became "Upcoming reviews"**: one master-detail screen replaces the Review log list and the separate Portfolio Review page, so the back button stays within one tab. Timeline entries are plain sentences with a small icon per step.
- **"Log for next portfolio review"** is an explicit button in the client workspace. Drafted entries that were never logged are not sent to the Portfolio Review agent. Edits are saved with that button, and later with **Update log**.
- **Renamed to MarketPulse.** The emails are the MarketPulse Daily Brief (from "MarketPulse (Azimut)") and MarketPulse Alerts (from "MarketPulse Alerts (Azimut)"); alert subjects still start "Client Alert:". The alert email's ready line is now just "Talking points drafted", since nothing is logged until the RM logs it.

From update 3:

- **Several items at the same moment are one arrival.** The US rates item and the barrier event on Kevin's note both arrive at 06:40, so they produce one Client Alert at 06:41. The call notice is also both a news item and a position event at 13:20, so it produces one alert.
- **Position events count when they arrive.** An event alerts its holders at its arrival time; later items do not re-evaluate it.
- **Sample data was retimed and adjusted for the section 5 anchors**: morning items now run from 05:50 to 08:10 (the rates item at 06:40), the intraday items at 13:05 and 13:20, and Rajesh Menon's note was reduced so that it alerts only through the barrier event, not again when the AI capex news arrives.
- **Relevance in the brief counts any holding** of an asset type the theme moves, so it is broader than the 3% exposure used for the alert rule.
- **Market facts may contain percentages** in the brief (for example "Brent rose about 6%"). The no-figures rule applies to anything about the RM's clients.
- **Priority in a Client Alert** is the client's rank among those exposed at the time the alert went out.
- **Removed**: the brief page and its nav link (`/brief` and `/act` redirect to the inbox), Scan now, Reset to 9 AM brief, the "Your book today" table, the "Ad hoc scan" log type and `runScan()`.

From update 2:

- **Rule B is judged tag by tag.** "10% exposure with a −3% move" counts only the holdings the theme moves by −3% or more. Otherwise a family account with mostly short-dated bonds (−0.5%) and a little in long bonds (−3.5%) would alert, which is not what the rule means.
- **Deduplication covers every condition that held at alert time.** Rajesh Menon was alerted at 09:00 for the barrier event; his tech exposure also met rule B then, so the 13:45 scan does not alert him again for it.
- **Position events can carry a narrative** (title, summary, estimated move), so talking points can be drafted for a client whose only link to today's news is the event, like Victor Ong and the called bond. This is an addition to the 4.2 schema.
- **The call notice news item stays in the feed** as a market-moving item (it is one of the "2 new items"), but it no longer forms a theme.
- **Sample data was adjusted for the 9.1 anchors**: a second worst-of note for Sarah's and Daniel's clients (so the barrier event hits only Kevin's client), Dr Amanda Yeo no longer holds the called bond, and Sophie Laurent, Isabelle Fontaine, Grace Halim and Nguyen Thanh Hai were resized around the thresholds.
- **"Your book today" keeps the rank and "Why this rank"**, since the priority score still orders it, but drops the Priority pill.
- **Status "In progress"** means the RM has opened the workspace. "Not started" means not yet opened.
- **Review log entries are dated on the demo day** (12 Oct 2026) at the real time of day, so they sit correctly in the timeline. The activity log keeps real timestamps.
- **System events** (Brief delivered, Alert sent at 09:00) are logged once per RM, the first time the RM is shown.
- **Talking points are labelled "For your conversation · shareable after approval"** instead of "Client-shareable".
- **Removed**: the Act page, checkpoint bar and Action select, the Portfolio Review and Proposal hand-offs and their stub pages, everything prospect-related, the next-step rules, the completeness check and `products.json`. `/act` redirects to `/brief`. Stored data from earlier versions is ignored (the storage keys changed).

From update 1 (still current):

- **Refused requests do not create a version**, and promised returns are refused before the model is called.
- **Free text offline is matched to a quick action** where the intent is clear; anything else gets the fixed offline message.
- **Mandarin is pre-written for every client** and keeps figures and product names exactly as in English.
- **Edits always apply to the latest version**; Restore is how you go back.
- **Focus rings use the lighter brand tint** (`#8fb3dc`) for contrast.
- **Server-side refusal fallback is on** for the default model, with a retry without it if the beta parameter is rejected.

From the first build:

- **One extra tag**, `called-usd-perpetual`, for the called bond.
- **Thirds** for priority bands put the extra row in the earlier bands.
- **Storage.** The activity log, last RM and review log are in `localStorage`; current chats are in `sessionStorage`.
- **Sharing has no recipient.** There are no client contact details in the sample data.

## Not built

- Everything listed as out of scope in update 2: per-RM or per-client thresholds and alerts on gains, talking points for clients without an alert, prospect themes and proposals, off-cycle reviews started from the brief, and a real integration with the Portfolio Review Studio (the JSON payload is the contract for now).
- **Sending emails for real** (original stretch A). Emails are rendered and exported, not sent.
- Everything out of scope in the original spec: authentication, live feeds, a real scheduler, bank connections, trade execution, a database.
