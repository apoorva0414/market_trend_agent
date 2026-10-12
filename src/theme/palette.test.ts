import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, over, PALETTE } from "./palette";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const token = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1].toLowerCase();

describe("dark Azimut theme (update 4)", () => {
  it("uses the palette from the spec, with Azimut blue #356292 as the brand colour", () => {
    expect(PALETTE.brand).toBe("#356292");
    expect(PALETTE).toMatchObject({ bg: "#0d1520", surface: "#152131", raised: "#1c2b3e", line: "#2a3b52", ink: "#e6edf5", muted: "#93a4b8" });
    expect(PALETTE).toMatchObject({ brandHover: "#4377ad", brandTint: "#8fb3dc", gain: "#4fbf8b", loss: "#e5747a", checkpoint: "#e0a24a" });
  });

  it("declares the same colours as Tailwind tokens in index.css", () => {
    const names: Record<keyof typeof PALETTE, string> = {
      bg: "bg", surface: "surface", raised: "raised", line: "line", ink: "ink", soft: "soft", muted: "muted",
      brand: "brand", brandHover: "brand-hover", brandTint: "brand-tint", gain: "gain", loss: "loss", checkpoint: "checkpoint", banner: "banner",
    };
    for (const [key, name] of Object.entries(names)) expect(token(name), name).toBe(PALETTE[key as keyof typeof PALETTE]);
  });

  it("is dark only: no light theme and no toggle", () => {
    expect(css).toMatch(/color-scheme:\s*dark/);
    expect(css).not.toMatch(/prefers-color-scheme|data-theme|\.light\b/);
  });
});

describe("WCAG AA contrast", () => {
  const { bg, surface, raised, brand, brandHover, brandTint } = PALETTE;
  // Every background that carries text: the three base layers and the "Drafted by agent" tint over each.
  const agentTint = [over(brand, bg, 0.12), over(brand, surface, 0.12)];
  const backgrounds = [bg, surface, raised, ...agentTint];

  it("meets 4.5:1 for every text colour on every background", () => {
    for (const text of ["ink", "soft", "muted", "brandTint", "gain", "loss", "checkpoint"] as const) {
      for (const background of backgrounds) {
        expect(contrastRatio(PALETTE[text], background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("meets 4.5:1 for white text on brand buttons, including the hover state", () => {
    expect(contrastRatio("#ffffff", brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", brandHover)).toBeGreaterThanOrEqual(4.5);
  });

  it("shows why links use the lighter tint: plain brand blue fails as text on dark", () => {
    expect(contrastRatio(brand, surface)).toBeLessThan(4.5);
    expect(contrastRatio(brandTint, surface)).toBeGreaterThanOrEqual(7);
  });

  it("meets 4.5:1 for coloured text on its own tinted chip or banner", () => {
    const chips: [string, string][] = [
      [PALETTE.loss, over(bg, over(brand, surface, 0.12), 0.7)], // removed text in Show changes
      [PALETTE.gain, over(PALETTE.gain, surface, 0.12)],
      [PALETTE.ink, over(PALETTE.gain, over(brand, surface, 0.12), 0.2)], // added text in Show changes
      [PALETTE.checkpoint, over(PALETTE.checkpoint, surface, 0.1)],
      [PALETTE.brandTint, over(brand, surface, 0.25)],
      [PALETTE.brandTint, over(brand, raised, 0.25)],
      [PALETTE.checkpoint, PALETTE.banner],
    ];
    for (const [text, background] of chips) expect(contrastRatio(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
  });

  it("meets 3:1 for the focus ring and the amber checkpoint outline against every base layer", () => {
    for (const background of [bg, surface, raised]) {
      expect(contrastRatio(brandTint, background)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(PALETTE.checkpoint, background)).toBeGreaterThanOrEqual(3);
    }
  });
});
