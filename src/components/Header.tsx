import { Link, NavLink } from "react-router-dom";
import { SAMPLE_BANNER } from "../data";
import { fmtDateLong } from "../logic/format";
import { useApp } from "../state/AppContext";
import { BrandMark } from "./Brand";
import { eyebrow } from "./ui";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 py-5 text-sm font-medium transition-colors ${
    isActive ? "border-brand-hover text-white" : "border-transparent text-muted hover:text-ink"
  }`;

export function Header() {
  const { rms, rm, setRmId, date } = useApp();
  return (
    <header className="sticky top-0 z-30">
      <div role="note" className="border-b border-checkpoint/40 bg-banner px-4 py-1.5 text-center text-xs tracking-wide text-checkpoint">
        {SAMPLE_BANNER}
      </div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-1 px-6">
          <Link to="/" className="py-4" aria-label="Azimut Daily Market Brief, home">
            <BrandMark />
          </Link>
          <nav className="flex gap-6" aria-label="Main">
            <NavLink to="/" end className={navLink}>
              9 AM email
            </NavLink>
            <NavLink to="/brief" className={navLink}>
              Brief
            </NavLink>
            <NavLink to="/log" className={navLink}>
              Activity log
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-6 py-3 text-sm">
            <div className="hidden text-right leading-tight lg:block">
              <div className={eyebrow}>Demo date</div>
              <div className="text-soft">{fmtDateLong(date)}</div>
            </div>
            <label className="flex items-center gap-2.5">
              <span className={eyebrow}>Logged in as</span>
              {/* RMs only. Each name carries its ARM support model, e.g. "Sarah Lim · Central ARM". */}
              <select
                value={rm.id}
                onChange={(event) => setRmId(event.target.value)}
                className="rounded-md border border-line bg-raised py-1.5 pr-8 pl-3 text-sm font-medium text-ink focus:border-brand-tint"
              >
                {rms.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {option.arm_model}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </header>
  );
}
