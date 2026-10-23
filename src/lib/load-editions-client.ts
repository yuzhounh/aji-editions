import type { DataAsset, EditionMetadata, EditionShard, EditionsCollection, EditionsManifest, JournalDataset } from "../data/types";
import { EDITION_DEFINITIONS } from "../data/edition-config";
import { dataBucket, HISTORY_BUCKET_COUNT } from "./data-buckets";
import { getPrimaryIssn } from "./issn";

const editionDefinitionById = new Map(
  EDITION_DEFINITIONS.map((definition) => [definition.id, definition])
);

export type EditionCatalog = Omit<EditionsCollection, "editions"> & { editions: EditionMetadata[] };

function normalize<T extends EditionMetadata>(edition: T): T {
  const definition = editionDefinitionById.get(edition.id);
  if (!definition) return edition;
  return { ...edition, label: definition.label, shortLabel: definition.shortLabel,
    partitionType: definition.partitionType, pendingPartitionType: definition.pendingPartitionType,
    partitionYear: definition.partitionYear, partitionReleaseDate: definition.partitionReleaseDate,
    impactFactorYear: definition.impactFactorYear, impactFactorReleaseDate: definition.impactFactorReleaseDate };
}

function validAsset(asset: DataAsset, prefix: string) {
  return asset && /^[a-f0-9]{64}$/.test(asset.sha256) && asset.url === `/data/${prefix}.${asset.sha256}.json.gz`;
}

/** Pending work remains shared even when the bounded decoded cache evicts old results. */
function memoized<T>(capacity: number) {
  const pending = new Map<string, Promise<T>>(), cached = new Map<string, T>();
  return (key: string, work: () => Promise<T>): Promise<T> => {
    if (cached.has(key)) {
      const value = cached.get(key)!; cached.delete(key); cached.set(key, value);
      return Promise.resolve(value);
    }
    const existing = pending.get(key);
    if (existing) return existing;
    const job = work().then(value => {
      cached.set(key, value);
      while (cached.size > capacity) cached.delete(cached.keys().next().value!);
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  };
}

/** Small catalog first; annual data on selection; history only when requested. */
export function createEditionsLoader(fetcher: typeof fetch) {
  let manifestPromise: Promise<EditionsManifest> | null = null;
  let legacyPromise: Promise<EditionsCollection> | null = null;
  let collectionPromise: Promise<EditionsCollection> | null = null;
  let catalogPromise: Promise<EditionCatalog> | null = null;
  const annual = memoized<EditionShard>(6), history = memoized<JournalDataset[]>(4);

  function manifest() {
    if (!manifestPromise) manifestPromise = (async () => {
      const response = await fetcher("/data/editions-manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Failed to load edition manifest (${response.status})`);
      const value = await response.json() as EditionsManifest;
      if (!value || value.schemaVersion !== 1 || !validAsset(value, "editions")) throw new Error("Invalid edition manifest");
      if (value.editions && (!value.collection || !value.editions.length ||
          new Set(value.editions.map(entry => entry.metadata?.id)).size !== value.editions.length ||
          value.editions.some(entry => !/^[a-z0-9-]+$/.test(entry.metadata?.id) || !validAsset(entry, `edition.${entry.metadata.id}`)))) {
        throw new Error("Invalid annual edition manifest");
      }
      return value;
    })().catch(error => { manifestPromise = null; throw error; });
    return manifestPromise;
  }

  async function readAsset<T>(asset: DataAsset): Promise<T> {
    const response = await fetcher(asset.url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Failed to load edition data (${response.status})`);
    const stream = new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text()) as T;
  }

  function legacy(value: EditionsManifest) {
    if (!legacyPromise) legacyPromise = readAsset<EditionsCollection>(value).then(collection => {
      if (!collection?.editions?.length) throw new Error("No editions available in dataset");
      return { ...collection, editions: collection.editions.map(edition => ({ ...normalize(edition),
        journals: edition.journals.filter(journal => journal.journalName) })) };
    }).catch(error => { legacyPromise = null; throw error; });
    return legacyPromise;
  }

  function catalog(): Promise<EditionCatalog> {
    if (!catalogPromise) catalogPromise = manifest().then(async value => {
      if (!value.editions) return legacy(value);
      return { ...value.collection!, editions: value.editions.map(entry => normalize(entry.metadata)) };
    }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }

  function edition(id: string): Promise<EditionShard> {
    return annual(id, async () => {
      const value = await manifest();
      if (!value.editions) {
        const collection = await legacy(value);
        const selected = collection.editions.find(item => item.id === id);
        if (!selected) throw new Error("Unknown edition");
        const historyIssns = [...new Set(selected.journals.map(journal => getPrimaryIssn(journal.issn)))].filter(issn =>
          collection.editions.filter(item => item.journals.some(journal => getPrimaryIssn(journal.issn) === issn)).length > 1);
        return { edition: selected, historyIssns };
      }
      const asset = value.editions.find(item => item.metadata.id === id);
      if (!asset) throw new Error("Unknown edition");
      const shard = await readAsset<EditionShard>(asset);
      if (shard?.edition?.id !== id || !Array.isArray(shard.edition.journals) || !Array.isArray(shard.historyIssns)) throw new Error("Invalid annual edition data");
      return { ...shard, edition: { ...normalize(shard.edition), journals: shard.edition.journals.filter(journal => journal.journalName) } };
    });
  }

  async function loadHistory(issn: string): Promise<JournalDataset[]> {
    const value = await manifest();
    if (!value.editions) return (await legacy(value)).editions;
    if (value.history?.bucketCount !== HISTORY_BUCKET_COUNT) throw new Error("Invalid history manifest");
    const bucket = dataBucket(issn, HISTORY_BUCKET_COUNT), asset = value.history.assets[bucket];
    if (!asset) return [];
    if (!validAsset(asset, `history.${bucket}`)) throw new Error("Invalid history asset");
    return history(bucket, async () => {
      const collection = await readAsset<EditionsCollection>(asset);
      if (!Array.isArray(collection?.editions)) throw new Error("Invalid history data");
      return collection.editions.map(item => ({ ...normalize(item), journals: item.journals.filter(journal => journal.journalName) }));
    });
  }

  // Preserve the explicit full-collection API, without using it for first paint.
  function load(): Promise<EditionsCollection> {
    if (!collectionPromise) collectionPromise = manifest().then(async value => {
      if (!value.editions) return legacy(value);
      const result = await catalog(), editions: JournalDataset[] = [];
      for (let i = 0; i < result.editions.length; i += 2) {
        editions.push(...(await Promise.all(result.editions.slice(i, i + 2).map(item => edition(item.id)))).map(item => item.edition));
      }
      return { ...result, editions };
    }).catch(error => { collectionPromise = null; throw error; });
    return collectionPromise;
  }
  return Object.assign(load, { catalog, edition, loadHistory });
}

export const editionsClient = createEditionsLoader((input, init) => fetch(input, init));
export const loadEditionsCollectionClient = editionsClient;
