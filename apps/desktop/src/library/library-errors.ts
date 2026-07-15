export function toFriendlyLibraryError(error: unknown): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const normalized = message.toLocaleLowerCase();
  if (normalized.includes("epub") || normalized.includes("book")) {
    return "We couldn't open that book. Please check the file and try again.";
  }
  if (normalized.includes("bookmark")) {
    return "We couldn't update that bookmark. Please try again.";
  }
  if (normalized.includes("search")) return "We couldn't search your library just now.";
  return "Something got in the way. Please try again.";
}
