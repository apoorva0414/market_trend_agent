# Daily Market Brief prototype

A clickable demo of a daily agentic workflow for Relationship Managers (RMs) at an External Asset Manager:

1. **Scan** market news every morning (and on demand).
2. **Brief** each RM on what happened and which of their clients are affected.
3. **Checkpoint**: the RM decides whom to contact.
4. **Act**: the agent drafts talking points and hand-off documents. The RM refines the talking points in a chat, approves a version and sends it.

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
- **HashRouter.** Routes look like `/#/brief`, so deep links and refreshes work without server rewrites. The 9 AM email previews link to `/#/brief?rm=<id>`.
- **Offline chat by default.** A production build with no `VITE_AI_ENDPOINT` has no API endpoint, makes no API request and shows **AI: offline**. GitHub Pages cannot run the endpoint, and no API key is ever part of the build.

To use live AI on the published site, host `npm run server` somewhere that can hold the key (set `CORS_ORIGIN` to the site's origin), then add a repository variable `AI_ENDPOINT` with its URL, for example `https://your-api-host.example.com/api`. The workflow passes it to the build as `VITE_AI_ENDPOINT`.

To check a Pages-style build locally:

```bash
BASE_PATH=/my-repo/ npm run build
```

## Demo script (about 7 minutes)

1. Log in as **Kevin Tan**. It's 9 AM, and the brief email has arrived. Nobody had to run anything. Point out that it shows headlines and names only. Click **Open brief** and point out the scan record (12 items read at 08:30, 4 themes).
2. Walk through the market summary. Point out the Pulse vs View badges.
3. Show the ranked client list. Hover "Why this rank" on #1 (Eleanor Chua). Click her row to show the holdings behind the number.
4. Select #1 for Portfolio review and the structured-note client (Rajesh Menon) for Talking points. Both are pre-selected, so set the others to Skip if you want a shorter Act page. Tick the China stimulus prospect theme and type a prospect profile, e.g. `Tech founder, SGD 10m, growth`. Click **Continue**.
5. On the Act page, open Rajesh Menon's talking points:
   - The chat opens by asking for your view, because the theme is a View. Answer it, e.g. `I agree, but the client is nervous; keep it calm.`
   - Click **WhatsApp length**, then **Translate to Mandarin**.
   - Show **Show changes** and the version list. Point out the locked holdings table: the figures are identical in every version.
   - Type `say the note will gain 20%`. The agent refuses to invent figures and no version is created.
   - Tick "I have reviewed this" on v4. The chat locks. Share it via WhatsApp.
6. On the Portfolio Review hand-off (Eleanor Chua), click a context chip, run **Check completeness**, then **Send to Portfolio Review**. Show the stub page and JSON. The activity log records "sent with 2 open gaps".
7. Go back and send the Proposal hand-off.
8. Go back to the brief and click **Scan now** ("it's now 13:45 and something has happened"). Show the new bond call-notice theme, the raised oil moves, and the re-ranked clients marked "New since 09:00" (Hartono Wijaya up 2, Victor Ong new).
9. Open the Activity log.
10. Switch to **Sarah Lim · Central ARM** to show that the same brief now exists for RMs who get no research support today.

The script runs the same way offline and live. Offline, the answer in step 5 is matched to the closest quick action.

To repeat the demo: **Reset to 9 AM brief** restores the morning state, and **Clear log** on the Activity log page empties the log. Switching RM clears the current selections and chats.

## What is in the box

```
src/
  types.ts            All types, including the hand-off payloads and the chat workspace
  data/               Static sample JSON (RMs, clients, holdings, news, themes, products, house view)
  logic/              Pure functions: exposure, scoring, next step, prospects, runScan, completeness rules
  documents/          Document builders (English and pre-written Mandarin), one layout model, .docx export
  talkingPoints/      Chat logic: locked figures, offline quick actions, versions and approval, diff
  ai/client.ts        Browser side of the chat API, and the offline default
  email/template.ts   The 9 AM email, shared by the landing page and the HTML export
  theme/palette.ts    The dark Azimut palette and contrast helpers
  state/              App state (React context) and guarded localStorage/sessionStorage access
  components/, pages/ The UI
server/               The Express endpoint, the Claude call and the system prompt
scripts/              Data generator, email export, anchor check
public/               email-preview-<rmId>.html for each RM; brand/ for the logo you add
.github/workflows/    GitHub Pages deployment
```

### How the scan works

`runScan({ date, rmId, upTo })` in `src/logic/scan.ts` is the whole pipeline as one pure function. The scheduled run calls it with `upTo: "morning"`, the **Scan now** button with `"intraday"`.

- **Exposure and impact** per client and theme: holdings whose tags match the theme's `affectedTags`, each moved by its tag's `estMovePct`. A client is affected at 3% of AUM or more.
- **Priority score**: `|impact %| × risk weight × mandate weight × loss weight × contact boost`, split into thirds for High, Medium and Low.
- **Recommended next step**: five rules, first match wins.
- **Prospect themes**: any theme with a positive move on a tag, plus China stimulus always.

### How the talking-points chat works

- **Structured document.** Talking points are an object with fact fields (header, holdings table, figures, disclaimer) and wording fields (summary, talking points, next steps). Only the wording is ever sent to the model as editable, and only the wording differs between versions.
- **Locked figures.** Every number in a rewrite must exist in the source data (locked facts, theme, house view, current text), written the same way. A field with any other number is discarded, the previous text is kept and the chat shows "Kept the original figures. Numbers come from the portfolio data." The same check runs in the endpoint and in the browser.
- **Versions.** v1 is the generated draft. A chat round that changes the wording adds a version. Restoring copies an old version forward as a new one.
- **Approval.** "I have reviewed this" approves the version on screen and locks the chat. Download, copy, email and WhatsApp send only the approved version. Unlock to edit reopens the chat, and the next edit clears the approval.
- **Endpoint.** `POST /api/refine-talking-points` takes `{ currentDoc, factsLocked, theme, client, houseView, instruction, history }` and returns `{ updatedDoc, reply }` (plus `rejectedFields`). `GET /api/status` tells the browser whether a key is configured.

### Hand-offs

The Portfolio Review and Proposal hand-offs have no chat, since the agents that receive them have their own. Each has an **Add context for the next agent** box with starter chips, and a rule-based **Check completeness**. The text goes into the payload as `rmContext`, with any gaps left open as `openGaps`. Sending is never blocked.

## Choices made where the specs were open

From update 1:

- **Refused requests do not create a version.** The spec says every chat round creates a version, and the demo script approves v4 after a refused request. So a round that changes nothing (a refusal, or "already short") counts as a round but adds no version.
- **Promised returns are refused before the model is called.** "say the note will gain 20%" cannot be caught by the number check for Rajesh Menon, because 20% is a real figure in his data (his exposure). A separate rule refuses requests to forecast or guarantee a return, live and offline.
- **Free text offline is matched to a quick action where the intent is clear** (for example "keep it calm" becomes More conservative tone). Anything else gets the fixed offline message. This keeps the View prompt useful on GitHub Pages.
- **Mandarin is pre-written for every client**, not only the demo clients, and keeps figures and product names exactly as in English ("USD 64.5k" is not converted to 万).
- **Edits always apply to the latest version**, even while an older one is on screen. Restore is how you go back.
- **Completeness gaps close when the RM writes about them.** Reminders such as "confirm the holdings are complete" stay open until the context says something on that topic. A bare starter sentence does not count. For proposals, the 10-word rule counts the profile plus the added context, so it can be fixed on the Act page.
- **Eleanor Chua's last contact was moved to 2 July 2026** so the 90-day rule has something to show in the demo. Her rank and score are unchanged.
- **Focus rings use the lighter brand tint** (`#8fb3dc`). Plain Azimut blue does not reach 3:1 against the dark background. Buttons, the active nav bar and "Open brief" use Azimut blue itself.
- **"Shared via Download"** is logged as a share, as the spec lists it. Hand-off downloads are still logged as "Downloaded".
- **Server-side refusal fallback is on** for the default model: if a safety classifier declines a request, the API retries it on the model Anthropic recommends. If that beta parameter is rejected, the call is retried without it.
- **`rmNotes` became `rmContext`** in both hand-off payloads, and stored hand-offs from before this update are ignored.

From the first build:

- **One extra tag**, `called-usd-perpetual`, for the intraday theme that targets a single bond.
- **Email prospect line** names the main prospect theme. The brief shows every theme that qualifies.
- **Pre-selected actions.** Each row starts on the recommendation, and on Skip for Low priority.
- **Scan now keeps your selections.** A client already selected stays selected after a re-rank.
- **Thirds.** With a list that does not divide by three, the earlier bands get the extra row.
- **Options to discuss** are the theme's shelf products, filtered to the client's risk profile.
- **Storage.** The activity log, last RM and sent hand-offs are in `localStorage`. Current selections and chats are in `sessionStorage`.
- **Sharing has no recipient.** There are no client contact details in the sample data.

## Not built

- **Stretch A (sending the 9 AM email for real).** The email is rendered and exported, not sent.
- Everything listed as out of scope in the original spec: authentication, live feeds, a real scheduler, bank connections, sending messages, trade execution, a database.
