// @vitest-environment happy-dom

import { expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { SavedPassageCard } from "./saved-passage-card";

it("keeps a saved passage compact until the reader expands it", () => {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(
    () => (
      <SavedPassageCard
        bookmark={{
          id: "bookmark-1",
          bookId: "book-1",
          bookTitle: "The Prince",
          chapterId: "chapter-1",
          chapterTitle: "Chapter 1",
          sentenceId: "sentence-9",
          sentenceIndex: 8,
          text: "A deliberately long saved passage that should begin compact and expand only when requested.",
          note: null,
          createdAt: "2026-07-17T00:00:00.000Z"
        }}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    ),
    container
  );

  const passage = container.querySelector(".bookmark-passage-copy");
  const toggle = container.querySelector<HTMLButtonElement>(
    '[aria-label="Expand saved passage from sentence 9"]'
  );
  expect(passage?.classList.contains("expanded")).toBe(false);
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");

  toggle?.click();
  expect(passage?.classList.contains("expanded")).toBe(true);
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  expect(toggle?.getAttribute("aria-label")).toBe("Collapse saved passage from sentence 9");
  expect(onOpen).not.toHaveBeenCalled();

  toggle?.click();
  expect(passage?.classList.contains("expanded")).toBe(false);
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");

  container.querySelector<HTMLButtonElement>(".bookmark-card-button")?.click();
  expect(onOpen).toHaveBeenCalledOnce();

  container.querySelector<HTMLButtonElement>(".bookmark-delete-button")?.click();
  expect(onDelete).toHaveBeenCalledWith("bookmark-1");

  dispose();
  container.remove();
});
