import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/tauri-runtime";
import type { BookmarkStore, LibraryBookmarkDto } from "./library-contracts";

const bookmarksStorageKey = "sonelle.bookmarks.v1";

export function createBookmarkStore(): BookmarkStore {
  const local = createLocalBookmarkStore();
  if (!isTauriRuntime()) return local;
  return {
    list(bookId) {
      if (bookId != null && isFixtureBookId(bookId)) return local.list(bookId);
      return invoke<LibraryBookmarkDto[]>("list_bookmarks", { bookId: bookId ?? null });
    },
    save(bookmark) {
      if (isFixtureBookId(bookmark.bookId)) return local.save(bookmark);
      return invoke<LibraryBookmarkDto>("save_bookmark", { bookmark });
    },
    delete(bookmarkId) {
      if (isLocalBookmarkId(bookmarkId)) return local.delete(bookmarkId);
      return invoke<void>("delete_bookmark", { bookmarkId });
    }
  };
}

function createLocalBookmarkStore(): BookmarkStore {
  return {
    async list(bookId) {
      const bookmarks = loadLocalBookmarks();
      return bookId == null
        ? bookmarks
        : bookmarks.filter((bookmark) => bookmark.bookId === bookId);
    },
    async save(input) {
      const bookmarks = loadLocalBookmarks();
      const id = localBookmarkId(input.bookId, input.chapterId, input.sentenceId);
      const existing = bookmarks.find((bookmark) => bookmark.id === id);
      const next: LibraryBookmarkDto = {
        id,
        ...input,
        createdAt: existing?.createdAt ?? new Date().toISOString()
      };
      saveLocalBookmarks([next, ...bookmarks.filter((bookmark) => bookmark.id !== id)]);
      return next;
    },
    async delete(bookmarkId) {
      saveLocalBookmarks(loadLocalBookmarks().filter((bookmark) => bookmark.id !== bookmarkId));
    }
  };
}

function loadLocalBookmarks(): LibraryBookmarkDto[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(bookmarksStorageKey) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isBookmarkDto) : [];
  } catch {
    return [];
  }
}

function saveLocalBookmarks(bookmarks: LibraryBookmarkDto[]) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(bookmarksStorageKey, JSON.stringify(bookmarks));
  }
}

function isBookmarkDto(value: unknown): value is LibraryBookmarkDto {
  if (value == null || typeof value !== "object") return false;
  const bookmark = value as Partial<LibraryBookmarkDto>;
  return (
    typeof bookmark.id === "string" &&
    typeof bookmark.bookId === "string" &&
    typeof bookmark.bookTitle === "string" &&
    typeof bookmark.chapterId === "string" &&
    typeof bookmark.chapterTitle === "string" &&
    typeof bookmark.sentenceId === "string" &&
    typeof bookmark.sentenceIndex === "number" &&
    typeof bookmark.text === "string" &&
    typeof bookmark.createdAt === "string"
  );
}

function localBookmarkId(bookId: string, chapterId: string, sentenceId: string): string {
  return `local-bookmark-${hashText(`${bookId}:${chapterId}:${sentenceId}`)}`;
}

function hashText(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function isFixtureBookId(bookId: string): boolean {
  return bookId.startsWith("fixture-");
}

function isLocalBookmarkId(bookmarkId: string): boolean {
  return bookmarkId.startsWith("local-bookmark-");
}
