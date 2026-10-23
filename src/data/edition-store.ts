import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EditionShard, EditionsManifest, JournalDataset } from "./types";
import { createGzipShardCache } from "../lib/gzip-shard-cache";
import { sortEditionsByYearDesc } from "./edition-utils";

export function createEditionStore(directory: string, capacity = 2, read: (file: string) => Buffer = readFileSync) {
  let manifest: EditionsManifest | null = null;
  const load = createGzipShardCache<EditionShard>(capacity, read);
  const filtered = new WeakSet<JournalDataset>();
  const metadata = () => {
    if (!manifest) {
      const value = JSON.parse(read(join(directory, "editions-manifest.json")).toString("utf8")) as EditionsManifest;
      if (value.schemaVersion !== 1 || !value.editions?.length) throw new Error("Missing annual edition manifest; run pack:editions");
      manifest = value;
    }
    return manifest;
  };
  const get = (id: string): JournalDataset | undefined => {
    const asset = metadata().editions!.find(entry => entry.metadata.id === id);
    if (!asset) return undefined;
    if (!/^[a-z0-9-]+$/.test(id) || !/^[a-f0-9]{64}$/.test(asset.sha256) || asset.url !== `/data/edition.${id}.${asset.sha256}.json.gz`) throw new Error("Invalid annual edition asset");
    const shard = load(join(directory, asset.url.slice("/data/".length)));
    if (shard.edition?.id !== id) throw new Error("Wrong annual edition data");
    // Cache the filtered dataset itself; don't build a second copy on every request.
    if (!filtered.has(shard.edition)) {
      shard.edition.journals = shard.edition.journals.filter(journal => journal.journalName);
      filtered.add(shard.edition);
    }
    return shard.edition;
  };
  return { get, default: (): JournalDataset => {
    const latest = sortEditionsByYearDesc(metadata().editions!.map(entry => entry.metadata)
      .filter(edition => edition.partitionType !== "jcr-only"))[0];
    if (!latest) throw new Error("No partition-backed editions");
    return get(latest.id)!;
  } };
}
