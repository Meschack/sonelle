import { describe, expect, it } from "vitest";
import { resolveLibraryGridNavigationIndex } from "./library-keyboard-navigation";

describe("Library keyboard navigation", () => {
  it("enters a grid on the first book", () => {
    expect(
      resolveLibraryGridNavigationIndex({
        currentIndex: -1,
        direction: "right",
        columnCount: 3,
        itemCount: 7
      })
    ).toBe(0);
  });

  it("moves horizontally without escaping the collection", () => {
    expect(
      resolveLibraryGridNavigationIndex({
        currentIndex: 1,
        direction: "left",
        columnCount: 3,
        itemCount: 7
      })
    ).toBe(0);
    expect(
      resolveLibraryGridNavigationIndex({
        currentIndex: 6,
        direction: "right",
        columnCount: 3,
        itemCount: 7
      })
    ).toBe(6);
  });

  it("moves vertically by the rendered column count and clamps partial rows", () => {
    expect(
      resolveLibraryGridNavigationIndex({
        currentIndex: 1,
        direction: "down",
        columnCount: 3,
        itemCount: 7
      })
    ).toBe(4);
    expect(
      resolveLibraryGridNavigationIndex({
        currentIndex: 4,
        direction: "down",
        columnCount: 3,
        itemCount: 7
      })
    ).toBe(6);
    expect(
      resolveLibraryGridNavigationIndex({
        currentIndex: 6,
        direction: "up",
        columnCount: 3,
        itemCount: 7
      })
    ).toBe(3);
  });
});
