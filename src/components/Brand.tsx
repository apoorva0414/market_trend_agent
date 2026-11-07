import { useEffect, useState } from "react";

// The logo is loaded from public/brand/azimut-logo.svg (or .png). The file is supplied by the
// client, not shipped with the prototype, so everything falls back to a text wordmark without it.

const CANDIDATES = ["brand/azimut-logo.svg", "brand/azimut-logo.png"];

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

let found: Promise<string | null> | null = null;

function findLogo(): Promise<string | null> {
  found ??= (async () => {
    for (const candidate of CANDIDATES) {
      const url = `${import.meta.env.BASE_URL}${candidate}`;
      if (await probe(url)) return url;
    }
    return null;
  })();
  return found;
}

/** URL of the logo file if one has been added to public/brand/, otherwise null. */
export function useBrandLogo(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void findLogo().then((result) => {
      if (active) setUrl(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return url;
}

/** The MarketPulse mark: four rounded, slightly slanted bars, like a pulse. */
export function MarketPulseMark({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <g transform="skewX(-6) translate(3 0)" strokeLinecap="round" strokeWidth="5">
        <line x1="4" y1="16" x2="4" y2="24" stroke="#4f9fe6" />
        <line x1="12" y1="11" x2="12" y2="30" stroke="#4f9fe6" />
        <line x1="20" y1="4" x2="20" y2="24" stroke="#4f9fe6" />
        <line x1="28" y1="9" x2="28" y2="18" stroke="#3a7fc9" />
      </g>
    </svg>
  );
}

/** Azimut logo (or the "AZIMUT" wordmark when no logo file is present), a divider, then the MarketPulse logo. */
export function BrandMark() {
  const logo = useBrandLogo();
  return (
    <span className="flex items-center gap-3">
      <span className="hidden items-center sm:flex">
        {logo ? (
          <img src={logo} alt="Azimut" className="h-7 w-auto" />
        ) : (
          <span className="text-lg font-semibold tracking-[0.28em] text-strong">AZIMUT</span>
        )}
      </span>
      <span className="hidden h-6 border-l border-line sm:block" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        <MarketPulseMark />
        <span className="text-lg font-semibold tracking-tight text-strong">MarketPulse</span>
      </span>
    </span>
  );
}
