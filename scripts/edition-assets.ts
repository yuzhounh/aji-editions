import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { EditionsCollection, EditionsManifest, JournalDataset } from "../src/data/types";
import { getPrimaryIssn } from "../src/lib/issn";
import { dataBucket, HISTORY_BUCKET_COUNT } from "../src/lib/data-buckets";

/** Package the existing dataset without downloading or rebuilding raw data. */
export function packEditionAssets(root: string, compressed?: Buffer): EditionsManifest {
  const data = compressed ?? readFileSync(join(root, "src/data/editions/editions.json.gz"));
  const sha256 = createHash("sha256").update(data).digest("hex");
  const filename = `editions.${sha256}.json.gz`;
  const publicDir = join(root, "public/data");
  mkdirSync(publicDir, { recursive: true });
  // Write the immutable payload before the manifest that refers to it.
  writeFileSync(join(publicDir, filename), data);
  const manifest: EditionsManifest = { schemaVersion: 1, sha256, url: `/data/${filename}` };
  const collection = JSON.parse(gunzipSync(data).toString("utf8")) as EditionsCollection;
  if (!collection.editions?.length) throw new Error("No edition data to package");
  const { editions, ...metadata } = collection;
  manifest.collection = metadata;
  manifest.editions = [];
  manifest.history = { bucketCount: HISTORY_BUCKET_COUNT, assets: {} };
  const occurrences = new Map<string, Set<string>>();
  for (const edition of editions) for (const journal of edition.journals) {
    if (!journal.journalName) continue;
    const issn = getPrimaryIssn(journal.issn);
    const years = occurrences.get(issn) || new Set<string>();
    years.add(edition.id); occurrences.set(issn, years);
  }
  const histories = new Map<string, JournalDataset[]>();
  const writeAsset = (prefix: string, value: unknown) => {
    const bytes = gzipSync(JSON.stringify(value));
    const hash = createHash("sha256").update(bytes).digest("hex");
    const name = `${prefix}.${hash}.json.gz`;
    writeFileSync(join(publicDir, name), bytes);
    return { sha256: hash, url: `/data/${name}` };
  };
  for (const edition of editions) {
    if (!/^[a-z0-9-]+$/.test(edition.id)) throw new Error("Invalid edition identifier");
    const { journals, ...editionMetadata } = edition;
    const historyIssns = [...new Set(journals.map(j => getPrimaryIssn(j.issn)))]
      .filter(issn => (occurrences.get(issn)?.size || 0) > 1);
    manifest.editions.push({ metadata: editionMetadata,
      ...writeAsset(`edition.${edition.id}`, { edition, historyIssns }) });
    const byBucket = new Map<string, JournalDataset["journals"]>();
    for (const journal of journals) {
      const bucket = dataBucket(getPrimaryIssn(journal.issn), HISTORY_BUCKET_COUNT);
      const rows = byBucket.get(bucket) || [];
      rows.push(journal); byBucket.set(bucket, rows);
    }
    for (const [bucket, rows] of byBucket) {
      const years = histories.get(bucket) || [];
      years.push({ ...editionMetadata, journals: rows }); histories.set(bucket, years);
    }
  }
  for (const [bucket, history] of histories) {
    manifest.history.assets[bucket] = writeAsset(`history.${bucket}`, { ...metadata, editions: history });
  }
  // Publish only after all annual/history assets exist. Original gzip bytes stay intact.
  writeFileSync(join(publicDir, "editions-manifest.json"), JSON.stringify(manifest) + "\n");
  return manifest;
}
