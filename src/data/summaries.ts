/**
 * Loads pre-generated journal summaries on the server side.
 */
import path from "path";
import { createSummaryStore } from "./summary-store";

export type SummaryContentBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] };

export type RelatedJournalRef = {
  journalName: string;
  issn: string;
};

export type StaticJournalSummary = {
  summary: SummaryContentBlock[];
  relatedJournals: RelatedJournalRef[];
};

type PackedEntry = {
  en: { summary: SummaryContentBlock[] };
  zh: { summary: SummaryContentBlock[] };
  related: RelatedJournalRef[];
};

export type PackedSummaries = {
  version: string;
  model: string;
  updatedAt: string;
  total: number;
  entries: Record<string, PackedEntry>;
};

const getSummary = createSummaryStore(path.resolve(process.cwd(), "src/data/summaries"));

export function getStaticJournalSummary(
  primaryIssn: string,
  locale: "en" | "zh"
): StaticJournalSummary | undefined {
  return getSummary(primaryIssn, locale);
}
