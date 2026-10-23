import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { EditionShard, EditionsCollection, EditionsManifest, JournalDataset } from "../src/data/types";
import type { PackedSummaries } from "../src/data/summaries";
import type { SummaryManifest } from "../src/data/summary-store";
import { getPrimaryIssn } from "../src/lib/issn";
import { dataBucket, HISTORY_BUCKET_COUNT } from "../src/lib/data-buckets";

const root = resolve(__dirname, ".."), publicData = join(root, "public/data");
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
function verifyEditions() {
  const bytes = readFileSync(join(root, "src/data/editions/editions.json.gz"));
  const original = JSON.parse(gunzipSync(bytes).toString("utf8")) as EditionsCollection;
  const manifestBytes = readFileSync(join(publicData, "editions-manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as EditionsManifest;
  assert.equal(digest(bytes), manifest.sha256);
  assert.deepEqual(readFileSync(join(root, "public", manifest.url)), bytes);
  const sizes: Record<string, number> = {}, expectedHistory = new Map<string, JournalDataset[]>();
  const { editions, ...metadata } = original;
  for (const edition of editions) {
    const asset = manifest.editions!.find(item => item.metadata.id === edition.id)!;
    const compressed = readFileSync(join(root, "public", asset.url));
    assert.equal(digest(compressed), asset.sha256);
    const shard = JSON.parse(gunzipSync(compressed).toString("utf8")) as EditionShard;
    assert.deepEqual(shard.edition, edition, `All metadata and records in ${edition.id}`);
    sizes[edition.id] = compressed.length;
    const { journals, ...editionMetadata } = edition;
    const buckets = new Map<string, typeof journals>();
    for (const journal of journals) {
      const bucket = dataBucket(getPrimaryIssn(journal.issn), HISTORY_BUCKET_COUNT);
      const rows = buckets.get(bucket) || []; rows.push(journal); buckets.set(bucket, rows);
    }
    for (const [bucket, rows] of buckets) {
      const years = expectedHistory.get(bucket) || [];
      years.push({ ...editionMetadata, journals: rows }); expectedHistory.set(bucket, years);
    }
  }
  const historySizes: number[] = [];
  for (const [bucket, years] of expectedHistory) {
    const asset = manifest.history!.assets[bucket], compressed = readFileSync(join(root, "public", asset.url));
    assert.equal(digest(compressed), asset.sha256);
    assert.deepEqual(JSON.parse(gunzipSync(compressed).toString("utf8")), { ...metadata, editions: years }, `All history records in bucket ${bucket}`);
    historySizes.push(compressed.length);
  }
  return { sourceSha256: digest(bytes), sourceCompressedBytes: bytes.length,
    sourceJsonBytes: gunzipSync(bytes).length, catalogBytes: manifestBytes.length, editions: sizes,
    defaultEdition: original.defaultEditionId, defaultFirstLoadBytes: manifestBytes.length + sizes[original.defaultEditionId],
    journalRecords: editions.reduce((count, edition) => count + edition.journals.length, 0),
    historyBuckets: historySizes.length, largestHistoryBucketBytes: Math.max(...historySizes),
    allAnnualAndHistoryFieldsEqual: true };
}

function verifySummaries() {
  const source = readFileSync(join(root, "src/data/summaries/summaries.json.gz"));
  const original = JSON.parse(gunzipSync(source).toString("utf8")) as PackedSummaries;
  const manifest = JSON.parse(readFileSync(join(root, "src/data/summaries/manifest.json"), "utf8")) as SummaryManifest;
  assert.equal(manifest.sourceSha256, digest(source));
  assert.deepEqual(source, readFileSync(join(publicData, "summaries.json.gz")));
  const expected = new Map<string, PackedSummaries["entries"]>();
  for (const [issn, entry] of Object.entries(original.entries)) {
    const bucket = dataBucket(issn), entries = expected.get(bucket) || {};
    entries[issn] = entry; expected.set(bucket, entries);
  }
  const sizes: number[] = [], expanded: number[] = [];
  let total = 0;
  for (const [bucket, entries] of expected) {
    const asset = manifest.assets[bucket], compressed = readFileSync(join(root, "src/data/summaries/shards", asset.file));
    assert.equal(digest(compressed), asset.sha256);
    const json = gunzipSync(compressed);
    assert.deepEqual(JSON.parse(json.toString("utf8")).entries, entries, `Both languages and related journals in ${bucket}`);
    total += Object.keys(entries).length; sizes.push(compressed.length); expanded.push(json.length);
  }
  assert.equal(total, Object.keys(original.entries).length);
  return { sourceSha256: digest(source), sourceCompressedBytes: source.length, sourceJsonBytes: gunzipSync(source).length,
    entries: total, buckets: sizes.length, largestBucketBytes: Math.max(...sizes),
    largestBucketJsonBytes: Math.max(...expanded), decodedCacheBuckets: 8, allSummaryFieldsEqual: true };
}

const receipt = { editions: verifyEditions(), summaries: verifySummaries(), verifiedAt: new Date().toISOString(), modelCalls: 0 };
mkdirSync(join(root, "results"), { recursive: true });
writeFileSync(join(root, "results/data-shards-verification.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt));
