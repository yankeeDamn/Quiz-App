import data from "../../content/ebooks-starter.json";
import type { EbookTrack } from "./ebooks";
export const STARTER_EBOOKS = data as EbookTrack[];
export const starterEbook = (slug: string) =>
  STARTER_EBOOKS.find((book) => book.slug === slug);
