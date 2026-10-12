// Prints the ranked list for every RM, at 9 AM and after the ad hoc scan.
// Use it to eyeball the section 5.9 demo anchors: `npm run check:anchors`.
import { data, DEMO_DATE } from "../src/data";
import { runScan } from "../src/logic/scan";

for (const rm of data.rms) {
  for (const upTo of ["morning", "intraday"] as const) {
    const scan = runScan({ date: DEMO_DATE, rmId: rm.id, upTo });
    console.log(`\n${rm.name} (${rm.arm_model}) · ${upTo} · ${scan.clients.length} of ${scan.clientCount} clients affected · ${scan.themes.length} themes`);
    for (const row of scan.clients) {
      const { exposure, factors, nextStep, theme } = row.primary;
      const change = row.change ? (row.change.isNew ? " [new]" : ` [rank ${row.change.rankDelta >= 0 ? "+" : ""}${row.change.rankDelta}${row.change.impactChanged ? ", impact changed" : ""}]`) : "";
      console.log(
        `  #${row.rank} ${row.client.name.padEnd(24)} ${row.client.mandate.padEnd(13)} ${row.client.riskProfile.padEnd(12)} ` +
          `${theme.shortTitle.padEnd(22)} exp ${(exposure.exposurePct * 100).toFixed(1).padStart(5)}%  ` +
          `impact ${(exposure.estImpactUsd / 1000).toFixed(1).padStart(7)}k (${(exposure.estImpactPct * 100).toFixed(2)}%)  ` +
          `score ${factors.score.toFixed(3)}  ${row.priority.padEnd(6)} ${nextStep.action} (rule ${nextStep.rule})` +
          `${row.others.length ? `  +${row.others.map((o) => o.theme.shortTitle).join(", ")}` : ""}${change}`,
      );
    }
  }
}
