import { invoke } from "@tauri-apps/api/core";

export interface AudioCacheStatsDto {
  sentenceCount: number;
  sizeBytes: number;
}

export interface AudioCacheRepository {
  getStats(): Promise<AudioCacheStatsDto>;
  clear(): Promise<AudioCacheStatsDto>;
}

export function createAudioCacheRepository(): AudioCacheRepository {
  return isTauriRuntime() ? nativeAudioCacheRepository : browserAudioCacheRepository;
}

const emptyStats: AudioCacheStatsDto = {
  sentenceCount: 0,
  sizeBytes: 0
};

const nativeAudioCacheRepository: AudioCacheRepository = {
  getStats() {
    return invoke<AudioCacheStatsDto>("get_audio_cache_stats");
  },

  clear() {
    return invoke<AudioCacheStatsDto>("clear_prepared_audio_cache");
  }
};

const browserAudioCacheRepository: AudioCacheRepository = {
  async getStats() {
    return emptyStats;
  },

  async clear() {
    return emptyStats;
  }
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
