import { invoke } from "@tauri-apps/api/core";
import type { LibraryBookSummary, ReaderDocumentDto } from "./library-models";
import { isTauriRuntime } from "../platform/tauri-runtime";
import { resolveBookCover, resolveDocumentAssets } from "./book-assets";
import type { BookCatalog } from "./library-contracts";

export function createBookCatalog(): BookCatalog {
  if (!isTauriRuntime()) return unavailableBookCatalog;
  return {
    list() {
      return invoke<LibraryBookSummary[]>("list_books").then((books) =>
        books.map(resolveBookCover)
      );
    },
    open(bookId, chapterId) {
      return invoke<ReaderDocumentDto>("open_book", { bookId, chapterId: chapterId ?? null }).then(
        resolveDocumentAssets
      );
    }
  };
}

const unavailableBookCatalog: BookCatalog = {
  async list() {
    return [];
  },
  async open() {
    throw new Error("That book is not available in this preview.");
  }
};
