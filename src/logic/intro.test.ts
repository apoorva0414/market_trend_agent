import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABOUT_PATH, INTRO_SEEN_KEY, introVisible, markIntroSeen, pathAfterClose, shouldShowIntroOnLoad } from "./intro";

function memoryStore() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values };
}

const blockedStore = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("blocked");
  },
};

/** What the app shell does on load: open the intro unless this tab already dismissed it. */
const onLoad = (store: ReturnType<typeof memoryStore> | null, pathname = "/") => introVisible({ autoOpen: shouldShowIntroOnLoad(store), pathname });

describe("visitor intro (update 4)", () => {
  it("shows on first load in a fresh tab", () => {
    expect(onLoad(memoryStore())).toBe(true);
  });

  it("sets the session flag when dismissed, so a refresh in the same tab does not show it again", () => {
    const tab = memoryStore();
    markIntroSeen(tab);
    expect(tab.values.get(INTRO_SEEN_KEY)).toBe("1");
    expect(INTRO_SEEN_KEY).toBe("mp-intro-seen");
    expect(onLoad(tab)).toBe(false);
  });

  it("shows again in a new tab (a new sessionStorage)", () => {
    const first = memoryStore();
    markIntroSeen(first);
    expect(onLoad(memoryStore())).toBe(true);
  });

  it("shows on load and still closes when storage is unavailable", () => {
    expect(shouldShowIntroOnLoad(blockedStore)).toBe(true);
    expect(shouldShowIntroOnLoad(null)).toBe(true);
    expect(() => markIntroSeen(blockedStore)).not.toThrow();
    expect(introVisible({ autoOpen: false, pathname: "/" })).toBe(false);
  });

  it("reopens from /about, which is where the banner link goes, even after dismissal", () => {
    const tab = memoryStore();
    markIntroSeen(tab);
    expect(onLoad(tab, ABOUT_PATH)).toBe(true);
    expect(ABOUT_PATH).toBe("/about");
    const header = readFileSync(new URL("../components/Header.tsx", import.meta.url), "utf8");
    expect(header).toMatch(/<Link to=\{ABOUT_PATH\}[^>]*>\s*About this prototype\s*<\/Link>/);
  });

  it("lands on the inbox when closed from /about, and stays put otherwise", () => {
    expect(pathAfterClose(ABOUT_PATH)).toBe("/");
    expect(pathAfterClose("/alerts")).toBeNull();
  });

  it("is not reopened by Reset demo: the reset keeps the flag and goes to the inbox, where the intro stays closed", () => {
    const tab = memoryStore();
    markIntroSeen(tab);
    const context = readFileSync(new URL("../state/AppContext.tsx", import.meta.url), "utf8");
    const reset = context.slice(context.indexOf("const resetDemo"), context.indexOf("const openClientWorkspace"));
    expect(reset).not.toMatch(/sessionStorage|mp-intro-seen|INTRO_SEEN_KEY/);
    expect(tab.values.get(INTRO_SEEN_KEY)).toBe("1");
    expect(introVisible({ autoOpen: false, pathname: "/" })).toBe(false);
  });
});
