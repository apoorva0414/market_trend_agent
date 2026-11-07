// The Azimut palettes: dark (default) and light. src/index.css declares the same values as Tailwind theme tokens
// (a test keeps the two in step); this module is for places that need the raw colours:
// the email template, which uses inline styles, and the contrast checks.

export const PALETTE = {
  bg: "#0d1520",
  surface: "#152131",
  raised: "#1c2b3e",
  line: "#2a3b52",
  ink: "#e6edf5",
  soft: "#c3cedb",
  muted: "#93a4b8",
  /** Strongest text: active nav and hover states. */
  strong: "#ffffff",
  /** Azimut blue, from azimut.sg. For filled controls, not for text on dark. */
  brand: "#356292",
  brandHover: "#4377ad",
  /** Lighter brand tint for text and links on dark surfaces. */
  brandTint: "#8fb3dc",
  gain: "#4fbf8b",
  loss: "#e5747a",
  /** Human checkpoint: the amber outline. */
  checkpoint: "#e0a24a",
  /** Background of the amber sample-data banner. */
  banner: "#2a2010",
} as const;

/** The light theme. Same keys as PALETTE; declared under :root[data-theme="light"] in index.css. */
export const LIGHT_PALETTE: Record<keyof typeof PALETTE, string> = {
  bg: "#f3f5f8",
  surface: "#ffffff",
  raised: "#e9eef4",
  line: "#cfd8e3",
  ink: "#13223a",
  soft: "#2e3f57",
  muted: "#536378",
  strong: "#0a1626",
  brand: "#356292",
  brandHover: "#2b5079",
  brandTint: "#2a5687",
  gain: "#16734a",
  loss: "#b3303b",
  checkpoint: "#8a560b",
  banner: "#fbefd9",
};

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colours. AA needs 4.5 for normal text and 3 for large text and UI parts. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The opaque colour seen when `foreground` is painted at `alpha` over `background`, e.g. brand at 12%. */
export function over(foreground: string, background: string, alpha: number): string {
  const fg = channels(foreground);
  const bg = channels(background);
  return `#${fg.map((channel, index) => Math.round(channel * alpha + bg[index] * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}
