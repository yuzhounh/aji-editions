/**
 * Loads pre-generated journal summaries on the server side.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";

export type SummaryContentBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] };

export type RelatedJournalRef = {
  journalName: string;
  issn: string;
};

export type StaticJournalSummary = {
  summary: SummaryContentBlock[];
  relatedJournals: RelatedJournalRef[];
};

type PackedEntry = {
  en: { summary: SummaryContentBlock[] };
  zh: { summary: SummaryContentBlock[] };
  related: RelatedJournalRef[];
};

type PackedSummaries = {
  version: string;
  model: string;
  updatedAt: string;
  total: number;
  entries: Record<string, PackedEntry>;
};

const SUMMARIES_GZ_CANDIDATES = [
  "src/data/summaries/summaries.json.gz",
  "public/data/summaries.json.gz",
];

let cachedCollection: PackedSummaries | null = null;

function resolveSummariesGzPath(): string {
  for (const relativePath of SUMMARIES_GZ_CANDIDATES) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  throw new Error(
    "Missing summaries.json.gz. Run `npm run pack:summaries` after `npm run build:summaries`."
  );
}

function loadSummariesCollection(): PackedSummaries {
  const gzPath = resolveSummariesGzPath();
  const compressed = fs.readFileSync(gzPath);
  const json = zlib.gunzipSync(compressed).toString("utf8");
  return JSON.parse(json) as PackedSummaries;
}

function getSummariesCollection(): PackedSummaries {
  if (!cachedCollection) {
    cachedCollection = loadSummariesCollection();
  }
  return cachedCollection;
}

export function getStaticJournalSummary(
  primaryIssn: string,
  locale: "en" | "zh"
): StaticJournalSummary | undefined {
  const entry = getSummariesCollection().entries[primaryIssn];
  if (!entry) return undefined;

  const localized = locale === "zh" ? entry.zh : entry.en;
  return {
    summary: localized.summary,
    relatedJournals: entry.related,
  };
}
