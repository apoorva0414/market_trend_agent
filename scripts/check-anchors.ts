// Prints the monitor's day for every RM: each item evaluated and every Client Alert sent.
// Use it to eyeball the update 3 demo anchors: `npm run check:anchors`.
import { data, DEMO_DATE } from "../src/data";
import { runDailyBrief } from "../src/logic/brief";
import { simulateMonitor } from "../src/logic/monitor";

const name = (id: string) => data.clients.find((c) => c.id === id)?.name;
for (const rm of data.rms) {
  const brief = runDailyBrief({ date: DEMO_DATE, rmId: rm.id });
  const { evaluations, alerts } = simulateMonitor({ date: DEMO_DATE, rmId: rm.id, until: "23:59" });
  console.log(`\n${rm.name} · brief: ${brief.themes.map((t) => `${t.theme.shortTitle} (${t.clientsExposed})`).join(", ")}`);
  for (const e of evaluations) console.log(`  ${e.evaluatedAt.slice(11, 16)} ${e.alertId ? "ALERT" : "  -  "} ${e.headline.slice(0, 70)}`);
  for (const a of alerts) {
    console.log(`  >> ${a.id} at ${a.time}`);
    for (const t of a.triggers) console.log(`     ${name(t.clientId)}: ${t.whyClient}  |  ${t.reason}`);
  }
}
