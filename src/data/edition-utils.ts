import type { EditionsCollection, JournalDataset } from "./types";

export function editionHasPartition(
  edition: Pick<JournalDataset, "partitionType">
): boolean {
  return edition.partitionType !== "jcr-only";
}

export function sortEditionsByYearDesc(
  editions: JournalDataset[]
): JournalDataset[] {
  return [...editions].sort((a, b) => {
    if (b.partitionYear !== a.partitionYear) {
      return b.partitionYear - a.partitionYear;
    }
    return b.impactFactorYear - a.impactFactorYear;
  });
}

export function getLatestPartitionEditionFromCollection(
  collection: EditionsCollection
): JournalDataset {
  const latest = sortEditionsByYearDesc(
    collection.editions.filter(editionHasPartition)
  )[0];

  if (!latest) {
    throw new Error("No partition-backed editions found in collection.");
  }

  return latest;
}

/** @deprecated Prefer getDefaultEditionIdFromCollection */
export function getLatestEditionFromCollection(
  collection: EditionsCollection
): JournalDataset {
  return getLatestPartitionEditionFromCollection(collection);
}

export function getDefaultEditionIdFromCollection(
  collection: EditionsCollection
): string {
  if (
    collection.defaultEditionId &&
    collection.editions.some((edition) => edition.id === collection.defaultEditionId)
  ) {
    return collection.defaultEditionId;
  }

  return getLatestPartitionEditionFromCollection(collection).id;
}

export function getLatestEditionIdFromCollection(
  collection: EditionsCollection
): string {
  return getDefaultEditionIdFromCollection(collection);
}
