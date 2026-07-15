import { describe, expect, it } from "vitest";
import { cssFontFamilyStack } from "./reader-formatting";

describe("reader formatting", () => {
  it("quotes selected system fonts before composing a CSS fallback stack", () => {
    expect(cssFontFamilyStack('Reader "Serif"', "serif")).toBe('"Reader \\"Serif\\"", serif');
    expect(cssFontFamilyStack(null, "sans-serif")).toBe("sans-serif");
  });
});
