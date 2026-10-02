import { gzipSync } from "node:zlib";
import type { EditionsCollection, Journal, JournalDataset } from "../src/data/types";

const journal: Journal = {
  journalName: "Test Journal", year: 2024, issn: "1234-5678/8765-432X",
  review: "", oaj: "", openAccess: "", webOfScience: "SCIE", impactFactor: 2.5,
  annotation: "", majorCategory: "Medicine", majorCategoryPartition: "1",
  top: "", authorityJournal: "", minorCategories: [],
};

export function makeCollection(version = "test"): EditionsCollection {
  const editions: JournalDataset[] = [2026, 2025].map((year) => ({
    id: `aji-${year}`, label: { en: "old", zh: "old" }, shortLabel: { en: "old", zh: "old" },
    version, partitionYear: year, partitionType: "cas", partitionReleaseDate: "",
    impactFactorYear: year - 2, impactFactorReleaseDate: "",
    source: { partition: "test.csv", impactFactor: "test.csv" },
    generatedAt: "2026-10-02T00:00:00Z", journalCount: 1, journals: [{ ...journal }],
  }));
  return { version, generatedAt: "2026-10-02T00:00:00Z", defaultEditionId: "aji-2026", editions };
}

export function compressedCollection(version = "test"): Uint8Array {
  return new Uint8Array(gzipSync(JSON.stringify(makeCollection(version))));
}
