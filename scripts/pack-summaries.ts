/**
 * Pack checkpoint progress.json into deployable summaries.json.gz.
 *
 * Usage:
 *   npm run pack:summaries
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";

const ROOT = path.resolve(__dirname, "..");
const PROGRESS_FILE = path.join(ROOT, "data", "cache", "summaries", "progress.json");
const OUT_DIR = path.join(ROOT, "src", "data", "summaries");
const OUT_GZ = path.join(OUT_DIR, "summaries.json.gz");
const PUBLIC_GZ = path.join(ROOT, "public", "data", "summaries.json.gz");

type ProgressEntry = {
  en: { summary: unknown[]; relatedJournals: unknown[] };
  zh: { summary: unknown[]; relatedJournals: unknown[] };
};

type ProgressFile = {
  version: string;
  model: string;
  updatedAt: string;
  total: number;
  entries: Record<string, ProgressEntry>;
};

type PackedSummaries = {
  version: string;
  model: string;
  updatedAt: string;
  total: number;
  entries: Record<
    string,
    {
      en: { summary: unknown[] };
      zh: { summary: unknown[] };
      related: unknown[];
    }
  >;
};

function main() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    throw new Error(`Missing ${PROGRESS_FILE}. Run npm run build:summaries first.`);
  }

  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")) as ProgressFile;
  const sourceIds = Object.keys(progress.entries);
  const packed: PackedSummaries = {
    version: progress.version,
    model: progress.model,
    updatedAt: progress.updatedAt,
    total: progress.total,
    entries: {},
  };

  for (const primaryIssn of sourceIds) {
    const entry = progress.entries[primaryIssn];
    packed.entries[primaryIssn] = {
      en: { summary: entry.en.summary },
      zh: { summary: entry.zh.summary },
      related: entry.en.relatedJournals,
    };
  }

  if (sourceIds.length !== progress.total) {
    console.warn(
      `[pack-summaries] warning: ${sourceIds.length}/${progress.total} entries in checkpoint`
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PUBLIC_GZ), { recursive: true });

  const json = JSON.stringify(packed);
  const compressed = zlib.gzipSync(json);

  fs.writeFileSync(OUT_GZ, compressed);
  fs.writeFileSync(PUBLIC_GZ, compressed);

  console.log(
    `[pack-summaries] packed ${sourceIds.length} entries -> ${OUT_GZ} (${(compressed.length / 1024 / 1024).toFixed(2)} MB gz)`
  );
  console.log(`[pack-summaries] copied -> ${PUBLIC_GZ}`);
}

main();
