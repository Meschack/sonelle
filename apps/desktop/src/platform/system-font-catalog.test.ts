import { describe, expect, it } from "vitest";
import { normalizeSystemFontFamilies } from "./system-font-catalog";

describe("system font catalog", () => {
  it("normalizes native family names without leaking invalid values", () => {
    expect(
      normalizeSystemFontFamilies([" Zed Sans ", "Alpha Serif", "Zed Sans", "", "Bad\nFont"])
    ).toEqual(["Alpha Serif", "Zed Sans"]);
  });
});
