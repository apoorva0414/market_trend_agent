// When the visitor intro (update 4) is shown. Kept free of React so the rules can be tested in Node.

/** sessionStorage key set when the visitor dismisses the intro. Per tab, so a new tab or visitor sees it again. */
export const INTRO_SEEN_KEY = "mp-intro-seen";

/** The route that reopens the intro (also used by the banner link). */
export const ABOUT_PATH = "/about";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** The tab's sessionStorage, or null when the browser blocks it. */
export function sessionStore(): KeyValueStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Show the intro on load unless it was dismissed earlier in this tab. If storage fails, show it. */
export function shouldShowIntroOnLoad(store: KeyValueStore | null): boolean {
  try {
    return store?.getItem(INTRO_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

/** Remember the dismissal for this tab. A storage failure only means the intro shows again on refresh. */
export function markIntroSeen(store: KeyValueStore | null): void {
  try {
    store?.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Nothing to do: the intro still closes for this page load.
  }
}

/** The intro covers the app when it opened on load and was not dismissed yet, or on /about. */
export function introVisible({ autoOpen, pathname }: { autoOpen: boolean; pathname: string }): boolean {
  return autoOpen || pathname === ABOUT_PATH;
}

/** Where to go after closing: closing from /about lands on the inbox, otherwise stay put. */
export function pathAfterClose(pathname: string): string | null {
  return pathname === ABOUT_PATH ? "/" : null;
}
