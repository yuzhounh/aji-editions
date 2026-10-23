import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataBucket } from "../lib/data-buckets";
import { createGzipShardCache } from "../lib/gzip-shard-cache";
import type { PackedSummaries, StaticJournalSummary } from "./summaries";

export type SummaryManifest = {
  schemaVersion: 1; bucketCount: 256; version: string; model: string; updatedAt: string;
  total: number; sourceSha256: string;
  assets: Record<string, { file: string; sha256: string; entries: number }>;
};

export function createSummaryStore(directory: string, capacity = 8, read: (file: string) => Buffer = readFileSync) {
  let manifest: SummaryManifest | null = null;
  const load = createGzipShardCache<Pick<PackedSummaries, "entries">>(capacity, read);
  return (primaryIssn: string, locale: "en" | "zh"): StaticJournalSummary | undefined => {
    if (!manifest) {
      const value = JSON.parse(read(join(directory, "manifest.json")).toString("utf8")) as SummaryManifest;
      if (value.schemaVersion !== 1 || value.bucketCount !== 256 || !value.assets) throw new Error("Invalid summary manifest");
      manifest = value;
    }
    const bucket = dataBucket(primaryIssn), asset = manifest.assets[bucket];
    if (!asset) return undefined;
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || asset.file !== `summary.${bucket}.${asset.sha256}.json.gz`) throw new Error("Invalid summary asset");
    const entry = load(join(directory, "shards", asset.file)).entries[primaryIssn];
    if (!entry) return undefined;
    return { summary: (locale === "zh" ? entry.zh : entry.en).summary, relatedJournals: entry.related };
  };
}
