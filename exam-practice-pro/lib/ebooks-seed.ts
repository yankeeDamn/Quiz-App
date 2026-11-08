import data from "../../content/ebooks-starter.json";
import type { EbookTrack } from "./ebooks";

// Bundled editions are intentionally normalized here as explicit Free content.
// The API migration enforces the same rule in Postgres.
export const STARTER_EBOOKS = data.map((book) => ({
  ...book,
  id: book.slug,
  accessLevel: "free" as const,
  freePreviewPages: 2,
  allowFullPdfDownload: false,
  allowPdfDownload: false,
  fullPdfStorageKey: null,
  previewPdfStorageKey: null,
  isBundledPublicEdition: true,
})) as unknown as EbookTrack[];

export const starterEbook = (slug: string) =>
  STARTER_EBOOKS.find((book) => book.slug === slug);
