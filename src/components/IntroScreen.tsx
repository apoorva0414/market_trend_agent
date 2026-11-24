import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HowItWorksDiagram } from "./HowItWorksDiagram";
import { buttonPrimary, card, eyebrow } from "./ui";

// Visitor intro (update 4). For people outside Azimut who open the shared link: what the problem is,
// how the agent works, and what to click. Copy is kept here so it is easy to edit.

const EYEBROW = "Working prototype · Agentic workflow in wealth management";
const HEADLINE = "An AI agent that tells relationship managers which clients today's news affects";
const CONTEXT =
  "Relationship managers (RMs) at a wealth manager look after dozens of clients each. Every morning brings market news, and working out which of it matters for which client is slow and manual. MarketPulse reads the news against each client's holdings, sends the RM a short daily brief, alerts them only when a specific client is materially affected, and drafts the talking points. The RM makes every client decision.";
const ENTER = "Enter the demo →";
const SAMPLE_NOTE = "Sample data only. No real clients or market news.";

const NOTES = [
  {
    title: "Daily Brief",
    accent: "border-l-brand-tint",
    body: "One email each business day at 09:00 SGT, tailored to the RM's book. A morning read with nothing to act on.",
  },
  {
    title: "Client Alerts",
    accent: "border-l-checkpoint",
    body: "No fixed schedule. Each news item is checked as it arrives, and the RM is emailed only when a client crosses the alert threshold.",
  },
  {
    title: "Talking points",
    accent: "border-l-gain",
    body: "The agent drafts what to say to each affected client and flags opinions to stress-test. The RM edits, approves and shares, and the outcome is logged.",
  },
];

// Times match the seeded demo: the 09:00 brief and Kevin Tan's 06:41 alert. The demo controls were
// removed after update 3, so step 4 points to Monitor activity on the Alerts page instead.
const STEPS = [
  "Open the MarketPulse Daily Brief in the inbox: the RM's morning read.",
  "Open the Client Alert from 06:41, then click Open in portal.",
  "Pick a client, refine the drafted talking points and approve them.",
  "Go to Alerts and look at Monitor activity to see the agent check each news item as it arrives.",
];

function EnterButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className={`${buttonPrimary} px-5 py-2.5`} onClick={onClose}>
      {ENTER}
    </button>
  );
}

/** Full-screen layer over the app. Escape or either Enter button closes it. */
export function IntroScreen({ onClose }: { onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    // The app behind is hidden from keyboard and screen readers while the intro is open.
    root?.setAttribute("inert", "");
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    heading.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root?.removeAttribute("inert");
      document.documentElement.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="intro-headline" className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[1100px] space-y-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <p className={eyebrow}>{EYEBROW}</p>
          <h1 id="intro-headline" ref={heading} tabIndex={-1} className="mt-3 font-serif text-[1.75rem] leading-tight tracking-tight text-ink outline-none sm:text-[1.95rem]">
            {HEADLINE}
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-soft">{CONTEXT}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <EnterButton onClose={onClose} />
            <span className="text-xs text-muted">{SAMPLE_NOTE}</span>
          </div>
        </header>

        <section aria-labelledby="intro-how">
          <h2 id="intro-how" className="font-serif text-2xl text-ink">
            How it works
          </h2>
          <div className={`${card} mt-4 overflow-x-auto p-4 sm:p-5`}>
            <HowItWorksDiagram />
          </div>
        </section>

        <section aria-label="What the agent does" className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {NOTES.map((note) => (
            <div key={note.title} className={`border-l-[3px] bg-surface px-4 py-3.5 ${note.accent}`}>
              <h3 className="text-sm font-medium text-ink">{note.title}</h3>
              <p className="mt-1 text-sm text-muted">{note.body}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="intro-try" className={`${card} p-5 sm:p-6`}>
          <h2 id="intro-try" className="font-serif text-2xl text-ink">
            Try it in two minutes
          </h2>
          <ol className="mt-4 space-y-2.5 text-sm text-soft">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="w-4 shrink-0 font-semibold text-brand-tint tabular-nums">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <EnterButton onClose={onClose} />
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
