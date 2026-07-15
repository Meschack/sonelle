import { convertFileSrc } from "@tauri-apps/api/core";
import type { ReaderDocumentDto } from "./library-models";

export function resolveDocumentAssets(document: ReaderDocumentDto): ReaderDocumentDto {
  return { ...document, book: resolveBookCover(document.book) };
}

export function resolveBookCover<TBook extends { coverImageSrc?: string | null }>(
  book: TBook
): TBook {
  const source = book.coverImageSrc;
  if (source == null || /^[a-z][a-z\d+.-]*:/i.test(source)) return book;
  return { ...book, coverImageSrc: convertFileSrc(source, "asset") };
}
