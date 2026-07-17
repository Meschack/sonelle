import { describe, expect, it, vi } from "vitest";
import { createDomainEventDispatcher, type AnyDomainEvent } from "@sonelle/domain";
import { createReaderPreferences } from "@sonelle/reader";
import { createReaderTypographyWorkflow } from "./reader-typography-workflow";

describe("reader typography workflow", () => {
  it("turns one change into independent projection and preference persistence reactions", async () => {
    const eventDispatcher = createDomainEventDispatcher();
    const events: AnyDomainEvent[] = [];
    eventDispatcher.subscribe("ReaderTypographyChanged", (event) => {
      events.push(event);
    });
    let preferences = createReaderPreferences();
    const save = vi.fn();
    const workflow = createReaderTypographyWorkflow(
      {
        eventDispatcher,
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
    expect(events.map((event) => event.name)).toEqual([
      "ReaderTypographyChanged",
      "ReaderTypographyChanged"
    ]);

    stop();
  });
});
