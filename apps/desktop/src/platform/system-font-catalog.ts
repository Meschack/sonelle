import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./tauri-runtime";

export interface SystemFontCatalog {
  listFamilies(): Promise<readonly string[]>;
}

export function createSystemFontCatalog(): SystemFontCatalog {
  return isTauriRuntime() ? nativeSystemFontCatalog : emptySystemFontCatalog;
}

const nativeSystemFontCatalog: SystemFontCatalog = {
  async listFamilies() {
    return normalizeSystemFontFamilies(await invoke<string[]>("list_system_fonts"));
  }
};

const emptySystemFontCatalog: SystemFontCatalog = {
  async listFamilies() {
    return [];
  }
};

export function normalizeSystemFontFamilies(families: readonly string[]): readonly string[] {
  return [...new Set(families.map((family) => family.trim()).filter(isUsableFontFamily))].sort(
    (left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function isUsableFontFamily(family: string): boolean {
  return (
    family.length > 0 &&
    family.length <= 160 &&
    ![...family].some((character) => /[\u0000-\u001f\u007f]/u.test(character))
  );
}
