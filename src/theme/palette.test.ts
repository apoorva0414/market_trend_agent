import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, LIGHT_PALETTE, over, PALETTE } from "./palette";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const themeBlock = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));
const lightBlock = css.slice(css.indexOf(':root[data-theme="light"]'), css.indexOf("}", css.indexOf(':root[data-theme="light"]')));
const token = (block: string, name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block)?.[1].toLowerCase();

const NAMES: Record<keyof typeof PALETTE, string> = {
  bg: "bg", surface: "surface", raised: "raised", line: "line", ink: "ink", soft: "soft", muted: "muted", strong: "strong",
  brand: "brand", brandHover: "brand-hover", brandTint: "brand-tint", gain: "gain", loss: "loss", checkpoint: "checkpoint", banner: "banner",
};

describe("Azimut themes", () => {
  it("keeps the dark palette from the spec as the default, with Azimut blue #356292 as the brand colour", () => {
    expect(PALETTE.brand).toBe("#356292");
    expect(PALETTE).toMatchObject({ bg: "#0d1520", surface: "#152131", raised: "#1c2b3e", line: "#2a3b52", ink: "#e6edf5", muted: "#93a4b8" });
    expect(PALETTE).toMatchObject({ brandHover: "#4377ad", brandTint: "#8fb3dc", gain: "#4fbf8b", loss: "#e5747a", checkpoint: "#e0a24a" });
    expect(css).toMatch(/html \{\s*color-scheme: dark;/);
  });

  it("declares both palettes as tokens in index.css: dark in @theme, light under data-theme=light", () => {
    for (const [key, name] of Object.entries(NAMES)) {
      expect(token(themeBlock, name), `dark ${name}`).toBe(PALETTE[key as keyof typeof PALETTE]);
      expect(token(lightBlock, name), `light ${name}`).toBe(LIGHT_PALETTE[key as keyof typeof PALETTE]);
    }
  });

  it("uses the same Azimut blue for filled controls in both themes", () => {
    expect(LIGHT_PALETTE.brand).toBe(PALETTE.brand);
  });
});

for (const [themeName, P] of [["dark", PALETTE], ["light", LIGHT_PALETTE]] as const) {
  describe(`WCAG AA contrast (${themeName})`, () => {
    const { bg, surface, raised, brand, brandHover, brandTint } = P;
    // Every background that carries text: the three base layers and the "Drafted by agent" tint over each.
    const backgrounds = [bg, surface, raised, over(brand, bg, 0.12), over(brand, surface, 0.12)];

    it("meets 4.5:1 for every text colour on every background", () => {
      for (const text of ["ink", "soft", "muted", "strong", "brandTint", "gain", "loss", "checkpoint"] as const) {
        for (const background of backgrounds) {
          expect(contrastRatio(P[text], background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it("meets 4.5:1 for white text on brand buttons, including the hover state", () => {
      expect(contrastRatio("#ffffff", brand)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio("#ffffff", brandHover)).toBeGreaterThanOrEqual(4.5);
    });

    it("meets 4.5:1 for coloured text on its own tinted chip or banner", () => {
      const chips: [string, string][] = [
        [P.loss, over(bg, over(brand, surface, 0.12), 0.7)], // removed text in Show changes
        [P.gain, over(P.gain, surface, 0.12)],
        [P.ink, over(P.gain, over(brand, surface, 0.12), 0.2)], // added text in Show changes
        [P.checkpoint, over(P.checkpoint, surface, 0.1)],
        [brandTint, over(brand, surface, 0.25)],
        [brandTint, over(brand, raised, 0.25)],
        [P.checkpoint, P.banner],
      ];
      for (const [text, background] of chips) expect(contrastRatio(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
    });

    it("meets 3:1 for the focus ring and the amber checkpoint outline against every base layer", () => {
      for (const background of [bg, surface, raised]) {
        expect(contrastRatio(brandTint, background)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(P.checkpoint, background)).toBeGreaterThanOrEqual(3);
      }
    });
  });
}

it("shows why dark-theme links use the lighter tint: plain brand blue fails as text on dark", () => {
  expect(contrastRatio(PALETTE.brand, PALETTE.surface)).toBeLessThan(4.5);
  expect(contrastRatio(PALETTE.brandTint, PALETTE.surface)).toBeGreaterThanOrEqual(7);
});
