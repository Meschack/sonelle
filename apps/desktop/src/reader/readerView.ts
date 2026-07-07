import { createSentenceId } from "@readex/reader";
import { segmentSentences, tokenizeReaderText, type ReaderTextToken } from "@readex/text";
import { fixtureBook, type FixtureBook } from "./fixtureBook";

export interface ReaderSentenceView {
  id: string;
  index: number;
  text: string;
  tokens: ReaderTextToken[];
}

export interface ReaderView {
  book: {
    id: string;
    title: string;
    author: string;
  };
  chapter: {
    id: string;
    title: string;
  };
  sentences: ReaderSentenceView[];
}

export function buildFixtureReaderView(book: FixtureBook = fixtureBook): ReaderView {
  return {
    book: {
      id: book.id,
      title: book.title,
      author: book.author
    },
    chapter: {
      id: book.chapter.id,
      title: book.chapter.title
    },
    sentences: segmentSentences(book.chapter.body).map((sentence) => ({
      id: createSentenceId(book.id, book.chapter.id, sentence.index),
      index: sentence.index,
      text: sentence.text,
      tokens: tokenizeReaderText(sentence.text)
    }))
  };
}
