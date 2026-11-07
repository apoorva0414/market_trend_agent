import { Link, NavLink } from "react-router-dom";
import { SAMPLE_BANNER } from "../data";
import { useApp } from "../state/AppContext";
import { useTheme } from "../state/theme";
import { BrandMark } from "./Brand";
import { eyebrow } from "./ui";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors lg:py-5 ${
    isActive ? "border-brand-hover text-strong" : "border-transparent text-muted hover:text-ink"
  }`;

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-soft transition-colors hover:border-brand-tint hover:text-strong"
    >
      <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? (
          // Sun: shown in dark mode, switches to light.
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" />
          </>
        ) : (
          // Moon: shown in light mode, switches to dark.
          <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z" />
        )}
      </svg>
    </button>
  );
}

export function Header() {
  const { rms, rm, setRmId } = useApp();
  return (
    <header className="z-30 sm:sticky sm:top-0">
      <div role="note" className="border-b border-checkpoint/40 bg-banner px-4 py-1.5 text-center text-xs tracking-wide text-checkpoint">
        {SAMPLE_BANNER}
      </div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 px-4 sm:px-6 lg:flex-nowrap lg:gap-x-8">
          <Link to="/" className="py-3 lg:py-4" aria-label="Azimut MarketPulse, home">
            <BrandMark />
          </Link>
          {/* On phones the nav gets its own row and scrolls sideways if it does not fit. */}
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto border-t border-line px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:order-none lg:mx-0 lg:w-auto lg:gap-6 lg:overflow-visible lg:border-0 lg:px-0" aria-label="Main">
            <NavLink to="/" end className={navLink}>
              Inbox
            </NavLink>
            <NavLink to="/alerts" className={navLink}>
              Alerts
            </NavLink>
            <NavLink to="/reviews" className={navLink}>
              Upcoming reviews
            </NavLink>
            <NavLink to="/log" className={navLink}>
              Activity log
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 py-2 text-sm sm:gap-4">
            <label className="flex min-w-0 items-center gap-2.5">
              <span className={`${eyebrow} hidden md:inline`}>Logged in as</span>
              {/* RMs only. Each name carries its ARM support model, e.g. "Sarah Lim · Central ARM". */}
              <select
                value={rm.id}
                onChange={(event) => setRmId(event.target.value)}
                aria-label="Logged in as"
                className="max-w-[9.5rem] truncate rounded-md border border-line bg-raised py-1.5 pr-8 pl-3 text-sm font-medium text-ink focus:border-brand-tint sm:max-w-none"
              >
                {rms.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {option.arm_model}
                  </option>
                ))}
              </select>
            </label>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
