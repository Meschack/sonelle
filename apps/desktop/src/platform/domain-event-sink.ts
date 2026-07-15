import { invoke } from "@tauri-apps/api/core";
import { createMemoryEventJournal, type EventSink } from "@sonelle/storage";
import { isTauriRuntime } from "./tauri-runtime";

export function createDomainEventSink(): EventSink {
  if (!isTauriRuntime()) return createMemoryEventJournal();

  return {
    append(event) {
      return invoke<void>("record_domain_event", { event });
    }
  };
}
