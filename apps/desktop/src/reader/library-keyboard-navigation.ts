export type LibraryGridNavigationDirection = "up" | "down" | "left" | "right";

interface LibraryGridNavigationInput {
  currentIndex: number;
  direction: LibraryGridNavigationDirection;
  columnCount: number;
  itemCount: number;
}

export function resolveLibraryGridNavigationIndex(input: LibraryGridNavigationInput): number {
  if (input.itemCount <= 0) return -1;
  if (input.currentIndex < 0 || input.currentIndex >= input.itemCount) return 0;

  const columns = Math.max(1, Math.floor(input.columnCount));
  switch (input.direction) {
    case "left":
      return Math.max(0, input.currentIndex - 1);
    case "right":
      return Math.min(input.itemCount - 1, input.currentIndex + 1);
    case "up":
      return Math.max(0, input.currentIndex - columns);
    case "down":
      return Math.min(input.itemCount - 1, input.currentIndex + columns);
  }
}

export function renderedLibraryGridColumnCount(items: readonly HTMLElement[]): number {
  if (items.length <= 1) return Math.max(1, items.length);
  const firstTop = items[0].getBoundingClientRect().top;
  const nextRowIndex = items.findIndex(
    (item) => Math.abs(item.getBoundingClientRect().top - firstTop) > 1
  );
  return nextRowIndex < 0 ? items.length : nextRowIndex;
}
