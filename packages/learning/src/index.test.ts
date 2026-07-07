import { describe, expect, it } from "vitest";
import { createWordInsight } from "./index";

describe("word insight", () => {
  it("returns fixture insight for known learner words", () => {
    expect(createWordInsight("Cadence").translation).toBe("cadence");
  });

  it("falls back without pretending to know a word", () => {
    expect(createWordInsight("rainfall")).toMatchObject({
      surface: "rainfall",
      definition: "No saved meaning yet.",
      state: "unknown"
    });
  });
});
