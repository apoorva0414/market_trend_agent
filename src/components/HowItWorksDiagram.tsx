// "How it works" diagram on the visitor intro (update 4, section 4.2). Plain SVG with theme tokens,
// so it follows light and dark mode. Coordinates are in the 1000 x 440 viewBox.

const INPUTS = [
  { title: "News feed", line: "Overnight and intraday" },
  { title: "House view", line: "Stance by asset class" },
  { title: "Client book", line: "Holdings per client" },
  { title: "Position events", line: "Calls, downgrades, barriers" },
];

const AGENT_STEPS = [
  { title: "Group into themes", line: "Fact (Pulse) or opinion (View)" },
  { title: "Match to client books", line: "Who holds what is affected" },
  { title: "Estimate impact", line: "Figures stay in the portal" },
];

type Accent = "none" | "tint" | "amber";
const PORTAL: { title: string; line: string; accent: Accent }[] = [
  { title: "Client workspace", line: "Why this client, and the figures", accent: "none" },
  { title: "Talking points", line: "Drafted by the agent", accent: "tint" },
  { title: "RM decision", line: "Edit, approve, share or skip", accent: "amber" },
  { title: "Portfolio Review log", line: "Listed for the next review", accent: "none" },
];

export const DIAGRAM_LABEL =
  "How it works. Inputs: news feed, house view, client book and position events go into the agent. The agent groups news into themes, matches them to client books and estimates impact. The RM gets a Daily Brief at 09:00 SGT, read only, and a Client Alert as news arrives, only when a client is materially affected. The alert opens the portal: client workspace, talking points drafted by the agent, the RM's decision, and the Portfolio Review log.";

const titleClass = "fill-ink text-[13px] font-medium";
const lineClass = "fill-muted text-[11.5px]";
const labelClass = "fill-muted text-[10.5px] uppercase";

function Arrow({ d, amber = false }: { d: string; amber?: boolean }) {
  return <path d={d} fill="none" strokeWidth={1.25} className={amber ? "stroke-checkpoint" : "stroke-line"} markerEnd={`url(#${amber ? "hiw-head-amber" : "hiw-head"})`} />;
}

function Box({ x, y, w, h, title, line, border = "stroke-line", strokeWidth = 1, titleTone = titleClass }: {
  x: number; y: number; w: number; h: number; title: string; line: string; border?: string; strokeWidth?: number; titleTone?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} className={`fill-surface ${border}`} strokeWidth={strokeWidth} />
      <text x={x + 14} y={y + h / 2 - 3} className={titleTone}>
        {title}
      </text>
      <text x={x + 14} y={y + h / 2 + 15} className={lineClass}>
        {line}
      </text>
    </g>
  );
}

function Pill({ x, y, w, text, tone }: { x: number; y: number; w: number; text: string; tone: "tint" | "amber" }) {
  const stroke = tone === "tint" ? "stroke-brand-tint" : "stroke-checkpoint";
  const fill = tone === "tint" ? "fill-brand-tint" : "fill-checkpoint";
  return (
    <g>
      <rect x={x} y={y} width={w} height={18} rx={9} fill="none" strokeWidth={1} className={stroke} />
      <text x={x + w / 2} y={y + 12.5} textAnchor="middle" className={`${fill} text-[10.5px] font-medium`}>
        {text}
      </text>
    </g>
  );
}

export function HowItWorksDiagram() {
  return (
    <svg viewBox="0 0 1000 440" role="img" aria-label={DIAGRAM_LABEL} className="block w-full min-w-[820px] font-sans">
      <defs>
        <marker id="hiw-head" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto" markerUnits="userSpaceOnUse">
          <path d="M1 1 L7 4 L1 7" fill="none" strokeWidth={1.25} className="stroke-line" />
        </marker>
        <marker id="hiw-head-amber" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto" markerUnits="userSpaceOnUse">
          <path d="M1 1 L7 4 L1 7" fill="none" strokeWidth={1.25} className="stroke-checkpoint" />
        </marker>
      </defs>

      {/* Column labels */}
      <text x={20} y={22} letterSpacing={1} className={labelClass}>Inputs</text>
      <text x={290} y={22} letterSpacing={1} className={labelClass}>The agent</text>
      <text x={640} y={22} letterSpacing={1} className={labelClass}>What the RM gets</text>

      {/* Inputs, each feeding the agent */}
      {INPUTS.map((input, i) => {
        const y = 44 + i * 64;
        return (
          <g key={input.title}>
            <Box x={20} y={y} w={210} h={52} {...input} />
            <Arrow d={`M230 ${y + 26} H289`} />
          </g>
        );
      })}

      {/* The agent: a dashed container with three stacked steps */}
      <rect x={290} y={44} width={250} height={244} rx={8} fill="none" strokeWidth={1} strokeDasharray="5 4" className="stroke-line" />
      {AGENT_STEPS.map((step, i) => {
        const y = 60 + i * 78;
        return (
          <g key={step.title}>
            <rect x={306} y={y} width={218} height={56} rx={8} className="fill-raised" />
            <text x={320} y={y + 25} className={titleClass}>{step.title}</text>
            <text x={320} y={y + 43} className={lineClass}>{step.line}</text>
            {i < AGENT_STEPS.length - 1 && <Arrow d={`M415 ${y + 56} V${y + 77}`} />}
          </g>
        );
      })}

      {/* What the RM gets */}
      <Arrow d="M540 99 H639" />
      <Arrow d="M540 233 H639" />

      <rect x={640} y={44} width={340} height={110} rx={8} strokeWidth={1} className="fill-surface stroke-brand-tint" />
      <text x={656} y={68} className={titleClass}>Daily Brief</text>
      <Pill x={656} y={80} w={100} text="Sent 09:00 SGT" tone="tint" />
      <text x={656} y={118} className={lineClass}>Read only, no client names</text>
      <text x={656} y={136} className={lineClass}>Nothing to open or act on</text>

      <rect x={640} y={178} width={340} height={110} rx={8} strokeWidth={1} className="fill-surface stroke-checkpoint" />
      <text x={656} y={202} className={titleClass}>Client Alert</text>
      <Pill x={656} y={214} w={104} text="As news arrives" tone="amber" />
      <text x={656} y={252} className={lineClass}>Only when a client is materially affected</text>
      <text x={656} y={272} className="fill-checkpoint text-[11.5px] font-medium">Open in portal →</text>

      {/* In the portal: the alert leads into the client workspace */}
      <text x={20} y={338} letterSpacing={1} className={labelClass}>In the portal</text>
      <Arrow d="M810 288 V320 H180 V349" amber />
      {PORTAL.map((box, i) => {
        const x = 20 + i * 250;
        return (
          <g key={box.title}>
            <Box
              x={x}
              y={350}
              w={210}
              h={64}
              title={box.title}
              line={box.line}
              border={box.accent === "tint" ? "stroke-brand-tint" : box.accent === "amber" ? "stroke-checkpoint" : "stroke-line"}
              strokeWidth={box.accent === "amber" ? 1.5 : 1}
              titleTone={box.accent === "amber" ? "fill-checkpoint text-[13px] font-medium" : titleClass}
            />
            {i < PORTAL.length - 1 && <Arrow d={`M${x + 210} 382 H${x + 249}`} />}
          </g>
        );
      })}
    </svg>
  );
}
