import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DELIVERY_TIME } from "../data";
import type { Priority, ThemeType } from "../types";

/**
 * Hover and focus tooltip. Rendered in a portal with fixed positioning so that
 * scrolling table containers cannot clip it.
 */
export function Tooltip({ content, children, className = "" }: { content: ReactNode; children: ReactNode; className?: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);

  const show = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.bottom + 230 > window.innerHeight;
    setPosition({
      left: Math.min(Math.max(rect.left + rect.width / 2, 160), window.innerWidth - 160),
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  };
  const hide = () => setPosition(null);

  return (
    <span ref={anchor} tabIndex={0} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} className={`inline-flex rounded-sm ${className}`}>
      {children}
      {position &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: "fixed", left: position.left, top: position.top, transform: `translate(-50%, ${position.above ? "-100%" : "0"})` }}
            className="pointer-events-none z-50 w-72 rounded-md border border-line bg-raised px-3 py-2.5 text-left text-xs leading-relaxed font-normal text-soft shadow-xl shadow-black/40"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap";

/** Pulse = fact, can be shared directly. View = opinion, the RM must stress-test it. */
export function TypeBadge({ type }: { type: ThemeType }) {
  return (
    <Tooltip content={type === "View" ? "Opinion: stress-test before sharing" : "Fact: can be shared directly"}>
      <span className={`${pill} border ${type === "Pulse" ? "border-brand bg-brand text-white" : "border-brand-tint/70 bg-transparent text-brand-tint"}`}>{type}</span>
    </Tooltip>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    High: "border-brand bg-brand text-white",
    Medium: "border-brand/60 bg-brand/25 text-brand-tint",
    Low: "border-line bg-raised text-muted",
  };
  return <span className={`${pill} border ${styles[priority]}`}>{priority}</span>;
}

export function NewBadge({ label = `New since ${DELIVERY_TIME}` }: { label?: string }) {
  return (
    <span className={`${pill} gap-1.5 border border-brand-tint/70 bg-brand/25 text-brand-tint`}>
      <span className="h-1.5 w-1.5 rounded-full bg-brand-tint" />
      {label}
    </span>
  );
}

/** Marks AI-generated content. Pair it with the agentTint classes on the container. */
export function AgentLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest whitespace-nowrap text-brand-tint uppercase">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M6 0l1.6 4.4L12 6l-4.4 1.6L6 12 4.4 7.6 0 6l4.4-1.6z" fill="currentColor" />
      </svg>
      Drafted by agent
    </span>
  );
}

/** "Drafted by agent" tint: brand blue at about 12% opacity. */
export const agentTint = "border border-brand/35 bg-brand/12";

/** Marks a human decision point: the amber outline. */
export const decisionOutline = "border-2 border-checkpoint";

export function DecisionLabel({ children = "RM decision" }: { children?: ReactNode }) {
  return <span className="text-[10px] font-semibold tracking-widest whitespace-nowrap text-checkpoint uppercase">{children}</span>;
}

export function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const buttonBase = "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors";

export const buttonPrimary = `${buttonBase} bg-brand text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted/60`;
export const buttonSecondary = `${buttonBase} border border-line bg-raised text-ink hover:border-brand-tint hover:text-white disabled:cursor-not-allowed disabled:border-line/60 disabled:bg-surface disabled:text-muted/50 disabled:hover:border-line/60`;
export const buttonDisabledLink = `${buttonBase} cursor-not-allowed border border-line/60 bg-surface text-muted/50`;
export const textLink = "font-medium text-brand-tint underline underline-offset-2 hover:text-white";
export const fieldInput =
  "rounded-md border border-line bg-bg text-ink placeholder:text-muted/80 focus:border-brand-tint focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
export const card = "rounded-lg border border-line bg-surface";
export const eyebrow = "text-[10px] font-semibold tracking-widest text-muted uppercase";

export function SectionHeading({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}
