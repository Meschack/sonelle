import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/tauri-runtime";
import type { ReadingPositionStore } from "./library-contracts";

export function createReadingPositionStore(): ReadingPositionStore {
  return isTauriRuntime()
    ? { save: (position) => invoke<void>("save_reading_position", { position }) }
    : { async save() {} };
}
