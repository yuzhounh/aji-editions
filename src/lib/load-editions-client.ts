import type { EditionsCollection, EditionsManifest } from "../data/types";
import { EDITION_DEFINITIONS } from "../data/edition-config";

const editionDefinitionById = new Map(
  EDITION_DEFINITIONS.map((definition) => [definition.id, definition])
);

async function fetchEditionsCollectionClient(fetcher: typeof fetch): Promise<EditionsCollection> {
  const manifestResponse = await fetcher("/data/editions-manifest.json", { cache: "no-cache" });
  if (!manifestResponse.ok) {
    throw new Error(`Failed to load edition manifest (${manifestResponse.status})`);
  }
  const manifest = await manifestResponse.json() as Partial<EditionsManifest> | null;
  if (!manifest || manifest.schemaVersion !== 1 ||
      typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
      manifest.url !== `/data/editions.${manifest.sha256}.json.gz`) {
    throw new Error("Invalid edition manifest");
  }

  const response = await fetcher(manifest.url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load edition data (${response.status})`);
  }

  const compressed = await response.arrayBuffer();
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  const collection = JSON.parse(json) as EditionsCollection;
  if (!collection || !Array.isArray(collection.editions) || collection.editions.length === 0) {
    throw new Error("No editions available in dataset");
  }

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

/** Reuse both in-flight requests and decoded data; failures remain retryable. */
export function createEditionsLoader(fetcher: typeof fetch) {
  let collectionPromise: Promise<EditionsCollection> | null = null;
  return function load(): Promise<EditionsCollection> {
    if (!collectionPromise) {
      collectionPromise = fetchEditionsCollectionClient(fetcher).catch((error: unknown) => {
        collectionPromise = null;
        throw error;
      });
    }
    return collectionPromise;
  };
}

export const loadEditionsCollectionClient = createEditionsLoader((input, init) => fetch(input, init));
