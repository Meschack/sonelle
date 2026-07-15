import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/tauri-runtime";
import type { LibrarySearch, LibrarySearchResultDto } from "./library-contracts";

export function createLibrarySearch(): LibrarySearch {
  if (!isTauriRuntime())
    return {
      async search() {
        return [];
      }
    };
  return {
    search(input) {
      return invoke<LibrarySearchResultDto[]>("search_library", {
        request: { query: input.query, bookId: input.bookId ?? null, limit: input.limit ?? null }
      });
    }
  };
}
