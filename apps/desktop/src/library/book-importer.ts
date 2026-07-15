import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ReaderDocumentDto } from "./library-models";
import { isTauriRuntime } from "../platform/tauri-runtime";
import { resolveDocumentAssets } from "./book-assets";
import type { BookImporter } from "./library-contracts";

export function createBookImporter(): BookImporter {
  if (!isTauriRuntime()) return unavailableBookImporter;

  const importFromPath = (path: string) =>
    invoke<ReaderDocumentDto>("import_epub", { path }).then(resolveDocumentAssets);
  return {
    async importFromDialog() {
      const selected = await open({
        multiple: false,
        filters: [{ name: "EPUB books", extensions: ["epub"] }]
      });
      if (selected == null || Array.isArray(selected)) return null;
      return importFromPath(selected);
    },
    importFromPath
  };
}

const unavailableBookImporter: BookImporter = {
  async importFromDialog() {
    throw new Error("EPUB import is available in the desktop app.");
  },
  async importFromPath() {
    throw new Error("EPUB import is available in the desktop app.");
  }
};
