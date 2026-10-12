import { useMemo, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useBrandLogo } from "../components/Brand";
import { AgentLabel, card, eyebrow, textLink } from "../components/ui";
import { buildEmailModel, renderEmailBody } from "../email/template";
import { useApp } from "../state/AppContext";

/** Landing page: the 9 AM email as the RM receives it, in a simple mail-client frame (spec 7.2). */
export function EmailLanding() {
  const { rm, morningScan } = useApp();
  const navigate = useNavigate();
  const logoUrl = useBrandLogo();
  const model = useMemo(() => buildEmailModel(morningScan, rm), [morningScan, rm]);
  const bodyHtml = useMemo(() => renderEmailBody(model, { briefUrl: "#/brief", logoUrl }), [model, logoUrl]);

  // The body is the shared email template. Its Open brief link is routed inside the app.
  const onBodyClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a[data-open-brief]");
    if (!link) return;
    event.preventDefault();
    navigate("/brief");
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <p className="text-sm text-muted">Inbox · {rm.name}</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">Your 9 AM brief has arrived</h1>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className={`${card} overflow-hidden`}>
          <div className="flex items-center gap-1.5 border-b border-line bg-bg px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="ml-3 text-xs text-muted">Mail</span>
          </div>
          <div className="border-b border-line bg-raised px-8 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">{model.subject}</h2>
              <AgentLabel />
            </div>
            <dl className="mt-3 grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
              <dt className="text-muted">From</dt>
              <dd className="text-ink">{model.from}</dd>
              <dt className="text-muted">To</dt>
              <dd className="text-ink">{model.to}</dd>
              <dt className="text-muted">Sent</dt>
              <dd className="text-ink">
                {model.dateLong}, {model.time}
              </dd>
            </dl>
          </div>
          <div className="px-8 py-8" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>

        <aside className="space-y-4">
          <div className={`${card} p-5`}>
            <p className={eyebrow}>Schedule</p>
            <p className="mt-2 font-serif text-lg leading-snug text-ink">Next scheduled brief: tomorrow 09:00 SGT</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">You can also scan any time from the brief.</p>
          </div>
          <div className={`${card} p-5 text-sm leading-relaxed text-muted`}>
            <p className={eyebrow}>About this email</p>
            <p className="mt-2">It shows headlines and client names only. Holdings, amounts and impacts stay in the app.</p>
            <p className="mt-2">The agent never contacts clients. You decide who to contact and you send everything.</p>
            <a href={`${import.meta.env.BASE_URL}email-preview-${rm.id}.html`} target="_blank" rel="noreferrer" className={`${textLink} mt-3 inline-block`}>
              Open the exported email (HTML)
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
