import { parseAudioSettings, serializeAudioSettings, type AudioSettings } from "@readex/audio";

const audioSettingsStorageKey = "readex.audio.settings.v1";

export interface AudioSettingsRepository {
  load(): AudioSettings;
  save(settings: AudioSettings): void;
}

export function createAudioSettingsRepository(): AudioSettingsRepository {
  return {
    load() {
      if (typeof localStorage === "undefined") return parseAudioSettings(null);
      return parseAudioSettings(localStorage.getItem(audioSettingsStorageKey));
    },

    save(settings) {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(audioSettingsStorageKey, serializeAudioSettings(settings));
    }
  };
}
