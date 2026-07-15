import { describe, expect, it, vi } from "vitest";
import { createDomainEventDispatcher } from "@sonelle/domain";
import { createReaderPreferences } from "@sonelle/reader";
import { createMemoryEventJournal } from "@sonelle/storage";
import { createReaderTypographyWorkflow } from "./reader-typography-workflow";

describe("reader typography workflow", () => {
  it("turns one change into independent projection, persistence, and journal reactions", async () => {
    const eventDispatcher = createDomainEventDispatcher();
    const eventSink = createMemoryEventJournal();
    let preferences = createReaderPreferences();
    const save = vi.fn();
    const workflow = createReaderTypographyWorkflow(
      {
        eventDispatcher,
        eventSink,
        repository: { save },
        reportEventError: vi.fn()
      },
      {
        currentPreferences: () => preferences,
        projectTypography(typography) {
          preferences = createReaderPreferences({ ...preferences, ...typography });
        }
      }
    );
    const stop = workflow.start();

    workflow.change({ contentFontFamily: "Literata" });
    workflow.change({ uiFontFamily: "Inter" });

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(preferences).toMatchObject({
      contentFontFamily: "Literata",
      uiFontFamily: "Inter"
    });
    expect((await eventSink.readAll()).map((event) => event.name)).toEqual([
      "ReaderTypographyChanged",
      "ReaderTypographyChanged"
    ]);

    stop();
  });
});
