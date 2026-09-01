/** A color, with channels from 0 to 255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };

export const RGB_HEX_PLACEHOLDER = "#rrggbb";

/** The `#rrggbb` form of the color. */
export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Parse a `#rrggbb` color; undefined if malformed. */
export function rgbFromHex(text: string): Rgb | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  const digits = match?.[1];
  if (!digits) return undefined;

  const value = parseInt(digits, 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}
