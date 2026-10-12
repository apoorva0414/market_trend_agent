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

/** Logo top-left, or the "AZIMUT" wordmark when no logo file is present, followed by the app name. */
export function BrandMark() {
  const logo = useBrandLogo();
  return (
    <span className="flex items-center gap-3">
      {logo ? (
        <img src={logo} alt="Azimut" className="h-7 w-auto" />
      ) : (
        <span className="text-lg font-semibold tracking-[0.28em] text-white">AZIMUT</span>
      )}
      <span className="border-l border-line pl-3 text-sm text-muted">Daily Market Brief</span>
    </span>
  );
}
