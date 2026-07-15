import { describe, expect, it, vi } from "vitest";
import { createDomainEventDispatcher, type AnyDomainEvent } from "@sonelle/domain";
import { createReaderOpeningWorkflow } from "./reader-opening-workflow";
import { buildFixtureReaderView } from "./reader-view";

describe("reader opening workflow", () => {
  it("publishes one fact and lets opening consequences react independently", async () => {
    const dispatcher = createDomainEventDispatcher();
    const events: AnyDomainEvent[] = [];
    const activate = vi.fn();
    const projectReaderSurface = vi.fn();
    const projectLibraryRail = vi.fn();
    const projectLibraryNotice = vi.fn();
    const workflow = createReaderOpeningWorkflow(
      {
        eventDispatcher: dispatcher,
        eventSink: { append: async (event) => void events.push(event as AnyDomainEvent) },
        playback: { activate },
        reportEventError: vi.fn()
      },
      { projectReaderSurface, projectLibraryRail, projectLibraryNotice }
    );
    const stop = workflow.start();
    const reader = buildFixtureReaderView();

    await workflow.open(reader, 1, "playing");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "ReaderOpened",
      payload: {
        bookId: reader.book.id,
        chapterId: reader.chapter.id,
        sentenceIndex: 1,
        playbackStatus: "playing"
      }
    });
    expect(activate).toHaveBeenCalledWith(reader, 1, "playing");
    expect(projectReaderSurface).toHaveBeenCalledOnce();
    expect(projectLibraryRail).toHaveBeenCalledWith(reader.book.id);
    expect(projectLibraryNotice).toHaveBeenCalledWith(null);
    stop();
  });
});
