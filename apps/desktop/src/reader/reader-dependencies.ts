import {
  createDomainEventDispatcher,
  type AnyDomainEvent,
  type DomainEventDispatcher
} from "@sonelle/domain";
import {
  createNarrationSession as createManifestNarrationSession,
  createPrefetchingNarrationGateway,
  PiperCompatibilityAdapter,
  type NarrationRoutingMode,
  type NarrationSession,
  type PrefetchingNarrationGateway
} from "@sonelle/audio";
import type { EventSink } from "@sonelle/storage";
import {
  createAudioCacheRepository,
  type AudioCacheRepository
} from "../audio/audio-cache-repository";
import {
  createAudioSettingsRepository,
  type AudioSettingsRepository
} from "../audio/audio-settings-repository";
import { createHtmlAudioPlayer, type HtmlAudioPlayer } from "../audio/html-audio-player";
import { createHtmlManifestNarrationPlayer } from "../audio/html-manifest-narration-player";
import { createNarrationRepository } from "../audio/narration-repository";
import {
  createVoiceInstallationRepository,
  type VoiceInstallationRepository
} from "../audio/voice-installation-repository";
import {
  createDictionaryRepository,
  type DictionaryRepository
} from "../learning/dictionary-repository";
import {
  createBookRepository,
  listenForBookDrops,
  type BookDropEvent,
  type BookRepository
} from "../library/book-repository";
import {
  createReaderPreferencesRepository,
  type ReaderPreferencesRepository
} from "./reader-preferences-repository";
import { createDomainEventSink } from "./domain-event-sink";

export interface ReaderExperienceDependencies {
  audioCacheRepository: AudioCacheRepository;
  audioSettingsRepository: AudioSettingsRepository;
  bookRepository: BookRepository;
  dictionaryRepository: DictionaryRepository;
  eventDispatcher: DomainEventDispatcher;
  eventSink: EventSink;
  htmlAudioPlayer: HtmlAudioPlayer;
  listenForBookDrops(onEvent: (event: BookDropEvent) => void): Promise<() => void>;
  narrationSessionFactory?: (onEvent: (event: AnyDomainEvent) => void) => NarrationSession;
  narrationSessionRoutingMode?: NarrationRoutingMode;
  narrationRepository: PrefetchingNarrationGateway;
  readerPreferencesRepository: ReaderPreferencesRepository;
  voiceInstallationRepository: VoiceInstallationRepository;
}

export function createReaderExperienceDependencies(): ReaderExperienceDependencies {
  const eventDispatcher = createDomainEventDispatcher();
  const htmlAudioPlayer = createHtmlAudioPlayer();
  const narrationRepository = createPrefetchingNarrationGateway(createNarrationRepository());
  const narrationSessionRoutingMode = developmentNarrationSessionRoutingMode();

  return {
    audioCacheRepository: createAudioCacheRepository(),
    audioSettingsRepository: createAudioSettingsRepository(),
    bookRepository: createBookRepository(),
    dictionaryRepository: createDictionaryRepository(),
    eventDispatcher,
    eventSink: createDomainEventSink(),
    htmlAudioPlayer,
    listenForBookDrops,
    narrationRepository,
    narrationSessionFactory:
      narrationSessionRoutingMode == null
        ? undefined
        : (onEvent) =>
            createManifestNarrationSession({
              adapter: new PiperCompatibilityAdapter(narrationRepository),
              player: createHtmlManifestNarrationPlayer(htmlAudioPlayer),
              onEvent
            }),
    narrationSessionRoutingMode,
    readerPreferencesRepository: createReaderPreferencesRepository(),
    voiceInstallationRepository: createVoiceInstallationRepository()
  };
}

function developmentNarrationSessionRoutingMode(): NarrationRoutingMode | undefined {
  return import.meta.env.VITE_SONELLE_NARRATION_SESSION === "legacy-piper"
    ? "legacy-piper"
    : undefined;
}
