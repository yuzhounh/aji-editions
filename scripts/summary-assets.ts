import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { PackedSummaries } from "../src/data/summaries";
import type { SummaryManifest } from "../src/data/summary-store";
import { dataBucket } from "../src/lib/data-buckets";

/** Repackage existing bilingual text; never regenerate or change summary content. */
export function packSummaryAssets(root: string, compressed?: Buffer): SummaryManifest {
  const source = compressed || readFileSync(join(root, "src/data/summaries/summaries.json.gz"));
  const collection = JSON.parse(gunzipSync(source).toString("utf8")) as PackedSummaries;
  const directory = join(root, "src/data/summaries");
  mkdirSync(join(directory, "shards"), { recursive: true });
  const manifest: SummaryManifest = { schemaVersion: 1, bucketCount: 256,
    version: collection.version, model: collection.model, updatedAt: collection.updatedAt, total: collection.total,
    sourceSha256: createHash("sha256").update(source).digest("hex"), assets: {} };
  const buckets = new Map<string, PackedSummaries["entries"]>();
  for (const [issn, entry] of Object.entries(collection.entries)) {
    const bucket = dataBucket(issn), entries = buckets.get(bucket) || {};
    entries[issn] = entry; buckets.set(bucket, entries);
  }
  for (const [bucket, entries] of buckets) {
    const bytes = gzipSync(JSON.stringify({ entries }));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const file = `summary.${bucket}.${sha256}.json.gz`;
    writeFileSync(join(directory, "shards", file), bytes);
    manifest.assets[bucket] = { file, sha256, entries: Object.keys(entries).length };
  }
  writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest) + "\n");
  return manifest;
}
