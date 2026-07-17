import { createSignal, createUniqueId } from "solid-js";
import type { LibraryBookmarkDto } from "../library/library-contracts";
import { ChevronDownIcon, TrashIcon } from "./reader-icons";

interface SavedPassageCardProps {
  bookmark: LibraryBookmarkDto;
  onOpen: (bookmark: LibraryBookmarkDto) => void;
  onDelete: (bookmarkId: string) => void;
}

export function SavedPassageCard(props: SavedPassageCardProps) {
  const [expanded, setExpanded] = createSignal(false);
  const passageId = `saved-passage-${createUniqueId()}`;
  const sentenceNumber = () => props.bookmark.sentenceIndex + 1;

  return (
    <div class="bookmark-row">
      <button
        class="bookmark-card-button"
        type="button"
        onClick={() => props.onOpen(props.bookmark)}
      >
        <span>Sentence {sentenceNumber()}</span>
        <small id={passageId} classList={{ "bookmark-passage-copy": true, expanded: expanded() }}>
          {props.bookmark.text}
        </small>
      </button>
      <button
        classList={{ "bookmark-expand-button": true, expanded: expanded() }}
        type="button"
        aria-label={`${
          expanded() ? "Collapse" : "Expand"
        } saved passage from sentence ${sentenceNumber()}`}
        aria-controls={passageId}
        aria-expanded={expanded()}
        title={`${expanded() ? "Collapse" : "Expand"} passage`}
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronDownIcon />
      </button>
      <button
        class="bookmark-delete-button"
        type="button"
        aria-label={`Delete sentence ${sentenceNumber()} bookmark`}
        onClick={() => props.onDelete(props.bookmark.id)}
        title="Delete bookmark"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
