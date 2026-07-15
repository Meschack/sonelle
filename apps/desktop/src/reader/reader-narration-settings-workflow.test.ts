import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "@sonelle/audio";
import { createDomainEventDispatcher, type AnyDomainEvent } from "@sonelle/domain";
import { createReaderNarrationSettingsWorkflow } from "./reader-narration-settings-workflow";

describe("reader narration settings workflow", () => {
  it("lets projection, persistence, and output react independently", async () => {
    const dispatcher = createDomainEventDispatcher();
    const events: AnyDomainEvent[] = [];
    let settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
    const save = vi.fn();
    const setOutput = vi.fn();
    dispatcher.subscribe("NarrationSettingsChanged", (event) => {
      events.push(event);
    });
    const workflow = createReaderNarrationSettingsWorkflow(
      {
        eventDispatcher: dispatcher,
        repository: { save },
        narration: { setOutput },
        activateSettings: (current, language) => ({
          ...current,
          voiceId: language === "fr" ? "supertonic:F1" : current.voiceId
        }),
        reportEventError: vi.fn()
      },
      {
        currentSettings: () => settings,
        currentLanguage: () => "en",
        projectSettings: (next) => {
          settings = next;
        }
      }
    );
    const stop = workflow.start();

    workflow.change({ volume: 0.7 });
    await vi.waitFor(() => expect(events).toHaveLength(1));
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(settings.volume).toBe(0.7);
    expect(save).toHaveBeenCalledWith(settings);
    expect(setOutput).toHaveBeenCalledWith(settings);
    expect(events[0]).toMatchObject({
      name: "NarrationSettingsChanged",
      payload: { source: "user" }
    });

    workflow.activate("fr");
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(settings.voiceId).toBe("supertonic:F1");
    expect(events[1]).toMatchObject({
      name: "NarrationSettingsChanged",
      payload: { source: "book" }
    });

    workflow.reset();
    await vi.waitFor(() => expect(events).toHaveLength(3));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(setOutput).toHaveBeenCalledTimes(3));
    expect(settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(save).toHaveBeenLastCalledWith(DEFAULT_AUDIO_SETTINGS);
    expect(setOutput).toHaveBeenLastCalledWith(DEFAULT_AUDIO_SETTINGS);
    stop();
  });
});
