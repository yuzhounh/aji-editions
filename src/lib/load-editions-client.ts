import type { EditionsCollection } from "@/data/types";
import { EDITION_DEFINITIONS } from "@/data/edition-config";

const editionDefinitionById = new Map(
  EDITION_DEFINITIONS.map((definition) => [definition.id, definition])
);

export async function loadEditionsCollectionClient(): Promise<EditionsCollection> {
  const response = await fetch("/data/editions.json.gz", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load edition data (${response.status})`);
  }

  const compressed = await response.arrayBuffer();
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  const collection = JSON.parse(json) as EditionsCollection;

  collection.editions = collection.editions.map((edition) => {
    const definition = editionDefinitionById.get(edition.id);

    return {
      ...(definition
        ? {
            ...edition,
            label: definition.label,
            shortLabel: definition.shortLabel,
            partitionType: definition.partitionType,
            pendingPartitionType: definition.pendingPartitionType,
            partitionYear: definition.partitionYear,
            partitionReleaseDate: definition.partitionReleaseDate,
            impactFactorYear: definition.impactFactorYear,
            impactFactorReleaseDate: definition.impactFactorReleaseDate,
          }
        : edition),
      journals: edition.journals.filter((journal) => journal.journalName),
    };
  });

  return collection;
}
