import type { EditionsCollection, JournalDataset } from "./types";

export function getLatestEditionFromCollection(
  collection: EditionsCollection
): JournalDataset {
  const latest = [...collection.editions].sort((a, b) => {
    if (b.partitionYear !== a.partitionYear) {
      return b.partitionYear - a.partitionYear;
    }
    return b.impactFactorYear - a.impactFactorYear;
  })[0];

  if (!latest) {
    throw new Error("No editions found in collection.");
  }

  return latest;
}

export function getLatestEditionIdFromCollection(
  collection: EditionsCollection
): string {
  return getLatestEditionFromCollection(collection).id;
}
