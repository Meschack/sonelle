import {
  createLearningNotebook,
  parseLearningNotebook,
  serializeLearningNotebook,
  type LearningNotebook
} from "@readex/learning";

const learningNotebookKey = "readex.learning.notebook.v1";

export interface LearningRepository {
  loadNotebook(): LearningNotebook;
  saveNotebook(notebook: LearningNotebook): void;
}

export function createLearningRepository(): LearningRepository {
  if (typeof window === "undefined") return memoryLearningRepository();

  return {
    loadNotebook() {
      try {
        return parseLearningNotebook(window.localStorage.getItem(learningNotebookKey));
      } catch {
        return createLearningNotebook();
      }
    },

    saveNotebook(notebook) {
      try {
        window.localStorage.setItem(learningNotebookKey, serializeLearningNotebook(notebook));
      } catch {
        return;
      }
    }
  };
}

function memoryLearningRepository(): LearningRepository {
  let notebook = createLearningNotebook();

  return {
    loadNotebook() {
      return notebook;
    },

    saveNotebook(nextNotebook) {
      notebook = nextNotebook;
    }
  };
}
