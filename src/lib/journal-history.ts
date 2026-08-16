import type { Journal, JournalDataset } from "@/data/types";
import { editionHasPartition } from "@/data/edition-utils";
import { getJcrReleaseYear } from "@/lib/edition-label";
import { getPrimaryIssn } from "@/lib/issn";

export type JournalIfHistoryPoint = {
  jcrReleaseYear: number;
  jcrLabel: string;
  impactFactor: number | null;
  impactFactorDisplay: string;
  editionId: string;
};

export type JournalPartitionHistoryRow = {
  jcrReleaseYear: number;
  jcrLabel: string;
  partitionYear: number;
  partitionType: "cas" | "xr";
  partitionLabel: string;
  majorCategory: string;
  majorCategoryPartition: string;
  authorityJournal: string;
  minorCategories: Journal["minorCategories"];
  editionId: string;
};

export function parseImpactFactorNumeric(
  factor: number | string
): number | null {
  const num = Number(factor);
  if (
    !Number.isNaN(num) &&
    String(factor).trim() !== "" &&
    !String(factor).includes("<")
  ) {
    return num;
  }
  return null;
}

export function formatImpactFactorDisplay(factor: number | string): string {
  const num = parseImpactFactorNumeric(factor);
  if (num !== null) return num.toFixed(1);
  return String(factor);
}

export function buildJournalHistory(
  editions: JournalDataset[],
  primaryIssn: string
): {
  ifHistory: JournalIfHistoryPoint[];
  partitionHistory: JournalPartitionHistoryRow[];
} {
  const sorted = [...editions].sort(
    (a, b) =>
      getJcrReleaseYear(a.impactFactorYear) -
      getJcrReleaseYear(b.impactFactorYear)
  );

  const ifHistory: JournalIfHistoryPoint[] = [];
  const partitionHistory: JournalPartitionHistoryRow[] = [];

  for (const edition of sorted) {
    const journal = edition.journals.find(
      (entry) => getPrimaryIssn(entry.issn) === primaryIssn
    );
    if (!journal) continue;

    const jcrReleaseYear = getJcrReleaseYear(edition.impactFactorYear);
    const jcrLabel = `JCR ${jcrReleaseYear}`;

    ifHistory.push({
      jcrReleaseYear,
      jcrLabel,
      impactFactor: parseImpactFactorNumeric(journal.impactFactor),
      impactFactorDisplay: formatImpactFactorDisplay(journal.impactFactor),
      editionId: edition.id,
    });

    if (editionHasPartition(edition) && edition.partitionType !== "jcr-only") {
      const tag = edition.partitionType === "xr" ? "XR" : "CAS";
      partitionHistory.push({
        jcrReleaseYear,
        jcrLabel,
        partitionYear: edition.partitionYear,
        partitionType: edition.partitionType,
        partitionLabel: `${tag} ${edition.partitionYear}`,
        majorCategory: journal.majorCategory,
        majorCategoryPartition: journal.majorCategoryPartition,
        authorityJournal: journal.authorityJournal,
        minorCategories: journal.minorCategories,
        editionId: edition.id,
      });
    }
  }

  return { ifHistory, partitionHistory };
}

export function journalHasMultiEditionHistory(
  editions: JournalDataset[],
  primaryIssn: string
): boolean {
  const { ifHistory, partitionHistory } = buildJournalHistory(
    editions,
    primaryIssn
  );
  return ifHistory.length > 1 || partitionHistory.length > 1;
}
