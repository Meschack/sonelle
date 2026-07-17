import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./tauri-runtime";

export interface AppWindowController {
  toggleFullscreen(): Promise<void>;
}

export function createAppWindowController(): AppWindowController {
  return {
    async toggleFullscreen() {
      if (isTauriRuntime()) {
        const window = getCurrentWindow();
        await window.setFullscreen(!(await window.isFullscreen()));
        return;
      }

      if (document.fullscreenElement == null) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    }
  };
}
