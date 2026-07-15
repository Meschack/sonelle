import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/tauri-runtime";

export interface AudioCacheStatsDto {
  sentenceCount: number;
  sizeBytes: number;
}

export interface AudioCacheRepository {
  getStats(bookId: string): Promise<AudioCacheStatsDto>;
  clear(bookId: string): Promise<AudioCacheStatsDto>;
}

export function createAudioCacheRepository(): AudioCacheRepository {
  return isTauriRuntime() ? nativeAudioCacheRepository : browserAudioCacheRepository;
}

const emptyStats: AudioCacheStatsDto = {
  sentenceCount: 0,
  sizeBytes: 0
};

const nativeAudioCacheRepository: AudioCacheRepository = {
  getStats(bookId) {
    return invoke<AudioCacheStatsDto>("get_audio_cache_stats", { bookId });
  },

  clear(bookId) {
    return invoke<AudioCacheStatsDto>("clear_prepared_audio_cache", { bookId });
  }
};

const browserAudioCacheRepository: AudioCacheRepository = {
  async getStats(_bookId) {
    return emptyStats;
  },

  async clear(_bookId) {
    return emptyStats;
  }
};
