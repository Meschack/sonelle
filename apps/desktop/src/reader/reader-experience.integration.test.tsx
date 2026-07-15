// @vitest-environment happy-dom

import { beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { DEFAULT_AUDIO_SETTINGS, SUPPORTED_NARRATION_VOICES } from "@sonelle/audio";
import { createDomainEvent, createDomainEventDispatcher } from "@sonelle/domain";
import { createSavedDictionary } from "@sonelle/learning";
import { createReaderPreferences, type ReaderPreferences } from "@sonelle/reader";
import { createMemoryEventJournal } from "@sonelle/storage";
import type { ReaderExperienceDependencies } from "./reader-dependencies";
import { ReaderExperience } from "./reader-experience";
import type { ReaderNarrationWorkflow } from "./reader-narration-workflow";
import { buildFixtureReaderView } from "./reader-view";

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("ReaderExperience integration", () => {
  it("starts the application workflows, reacts to reader closure, and disposes them", async () => {
    const dispatcher = createDomainEventDispatcher();
    const reader = buildFixtureReaderView();
    const pause = vi.fn().mockResolvedValue(undefined);
    const stopNarration = vi.fn();
    const stopDrops = vi.fn();
    const stopVoiceEvents = vi.fn();
    const dependencies = createDependencies({
      dispatcher,
      pause,
      stopNarration,
      stopDrops,
      stopVoiceEvents
    });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <ReaderExperience dependencies={dependencies} />, container);

    expect(container.querySelector(".reader-surface")).not.toBeNull();
    await dispatcher.dispatch(
      createDomainEvent("ReaderClosed", {
        bookId: reader.book.id,
        chapterId: reader.chapter.id,
        sentenceId: reader.sentences[0]?.id ?? ""
      })
    );

    expect(container.querySelector(".library-workspace")).not.toBeNull();
    expect(pause).toHaveBeenCalledOnce();
    dispose();
    await vi.waitFor(() => {
      expect(stopNarration).toHaveBeenCalledOnce();
      expect(stopDrops).toHaveBeenCalledOnce();
      expect(stopVoiceEvents).toHaveBeenCalledOnce();
    });
    container.remove();
  });

  it("loads installed fonts and applies persisted book and interface selections", async () => {
    const savePreferences = vi.fn();
    const dependencies = createDependencies({
      dispatcher: createDomainEventDispatcher(),
      pause: vi.fn().mockResolvedValue(undefined),
      stopNarration: vi.fn(),
      stopDrops: vi.fn(),
      stopVoiceEvents: vi.fn(),
      savePreferences
    });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <ReaderExperience dependencies={dependencies} />, container);

    const settingsTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (button) => button.textContent?.includes("Tools")
    );
    expect(settingsTab).not.toBeUndefined();
    settingsTab?.click();

    const bookFontTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Book content font"]'
    );
    await vi.waitFor(() => expect(bookFontTrigger).not.toBeNull());
    bookFontTrigger?.click();
    await vi.waitFor(() =>
      expect(
        [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')].some((option) =>
          option.textContent?.includes("Literata")
        )
      ).toBe(true)
    );
    const literata = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
      (option) => option.textContent?.includes("Literata")
    );
    literata?.click();

    const interfaceFontTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="App interface font"]'
    );
    interfaceFontTrigger?.click();
    const inter = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
      (option) => option.textContent?.includes("Inter")
    );
    inter?.click();

    const shell = container.querySelector<HTMLElement>(".sonelle-shell");
    await vi.waitFor(() => {
      expect(shell?.style.getPropertyValue("--reader-font")).toContain('"Literata"');
      expect(shell?.style.getPropertyValue("--ui-font")).toContain('"Inter"');
      expect(savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ contentFontFamily: "Literata", uiFontFamily: "Inter" })
      );
    });

    dispose();
    container.remove();
  });
});

interface DependencySpies {
  dispatcher: ReturnType<typeof createDomainEventDispatcher>;
  pause(): Promise<void>;
  stopNarration(): void;
  stopDrops(): void;
  stopVoiceEvents(): void;
  savePreferences?: (preferences: ReaderPreferences) => void;
}

function createDependencies(spies: DependencySpies): ReaderExperienceDependencies {
  const voiceId = DEFAULT_AUDIO_SETTINGS.voiceId;
  const readyVoice = {
    voiceId,
    status: "ready" as const,
    downloadSizeBytes: 0,
    downloadedBytes: 0,
    progress: 100,
    message: "Ready"
  };
  const narrationWorkflow = {
    requestPlayback: vi.fn(),
    pause: spies.pause,
    setOutput: vi.fn(),
    prefetchUpcoming: vi.fn(),
    reset: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(() => spies.stopNarration)
  } satisfies ReaderNarrationWorkflow;

  return {
    audioCacheRepository: {
      getStats: vi.fn().mockResolvedValue({ sentenceCount: 0, sizeBytes: 0 }),
      clear: vi.fn().mockResolvedValue({ sentenceCount: 0, sizeBytes: 0 })
    },
    audioSettingsRepository: {
      load: () => DEFAULT_AUDIO_SETTINGS,
      save: vi.fn()
    },
    bookCatalog: {
      list: vi.fn().mockResolvedValue([]),
      open: vi.fn().mockRejectedValue(new Error("No library book selected"))
    },
    bookDropAdapter: { listen: vi.fn().mockResolvedValue(spies.stopDrops) },
    bookExporter: {
      exportData: vi.fn().mockRejectedValue(new Error("No library book selected"))
    },
    bookImporter: {
      importFromDialog: vi.fn().mockResolvedValue(null),
      importFromPath: vi.fn().mockRejectedValue(new Error("No import requested"))
    },
    bookmarkStore: {
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockRejectedValue(new Error("No bookmark requested")),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    dictionaryRepository: {
      lookupWord: vi.fn().mockResolvedValue(null),
      loadSavedDictionary: createSavedDictionary,
      saveSavedDictionary: vi.fn()
    },
    engineInstallationRepository: {
      getStatus: vi.fn(async (engineId) => ({
        engineId,
        status: "ready" as const,
        modelRevision: `${engineId}-test`,
        downloadSizeBytes: 0,
        downloadedBytes: 0,
        progress: 100,
        message: "Ready"
      })),
      install: vi.fn(async (engineId) => ({
        engineId,
        status: "ready" as const,
        modelRevision: `${engineId}-test`,
        downloadSizeBytes: 0,
        downloadedBytes: 0,
        progress: 100,
        message: "Ready"
      })),
      listen: vi.fn().mockResolvedValue(() => undefined)
    },
    eventDispatcher: spies.dispatcher,
    eventSink: createMemoryEventJournal(),
    fontCatalog: { listFamilies: vi.fn().mockResolvedValue(["Inter", "Literata"]) },
    librarySearch: { search: vi.fn().mockResolvedValue([]) },
    narration: {
      capabilities: { offlineLibrary: "individual-voice", preparesAcrossChapters: false },
      activateSettings: (settings) => settings,
      voices: () => SUPPORTED_NARRATION_VOICES,
      observeEngineInstallation: vi.fn(),
      createWorkflow: () => narrationWorkflow
    },
    readerPreferencesRepository: {
      load: createReaderPreferences,
      save: spies.savePreferences ?? vi.fn()
    },
    readingPositionStore: { save: vi.fn().mockResolvedValue(undefined) },
    voiceInstallationRepository: {
      getStatus: vi.fn().mockResolvedValue(readyVoice),
      install: vi.fn().mockResolvedValue(readyVoice),
      listen: vi.fn().mockResolvedValue(spies.stopVoiceEvents)
    }
  };
}
