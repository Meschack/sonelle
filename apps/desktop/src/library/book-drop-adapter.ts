import { isTauriRuntime } from "../platform/tauri-runtime";
import type { BookDropAdapter } from "./library-contracts";

export function createBookDropAdapter(): BookDropAdapter {
  return {
    async listen(onEvent) {
      if (!isTauriRuntime()) return () => undefined;
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      return getCurrentWebview().onDragDropEvent(({ payload }) => onEvent(payload));
    }
  };
}

export function resolveDroppedEpubPath(paths: readonly string[]): string | null {
  return paths.find((path) => path.trim().toLocaleLowerCase().endsWith(".epub")) ?? null;
}
