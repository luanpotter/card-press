import { describe, expect, test } from "bun:test";
import { rgbFromHex, rgbToHex, WHITE } from "@/types/color";

describe("rgbFromHex", () => {
  test("parses a hex color", () => {
    expect(rgbFromHex("#336699")).toEqual({ r: 0x33, g: 0x66, b: 0x99 });
  });

  test("accepts surrounding spaces, upper case, and a missing hash", () => {
    expect(rgbFromHex("  FFFFFF ")).toEqual(WHITE);
  });

  test("rejects malformed colors", () => {
    for (const text of ["", "#", "#fff", "#12345", "#3366990", "#336699cc", "#gggggg", "rgb(1, 2, 3)"]) {
      expect(rgbFromHex(text)).toBeUndefined();
    }
  });
});

describe("rgbToHex", () => {
  test("renders every channel", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex(WHITE)).toBe("#ffffff");
  });

  test("round trips through rgbFromHex", () => {
    for (const color of [{ r: 0, g: 0, b: 0 }, { r: 0x33, g: 0x66, b: 0x99 }, WHITE]) {
      expect(rgbFromHex(rgbToHex(color))).toEqual(color);
    }
  });
});
