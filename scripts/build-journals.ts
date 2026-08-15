/**
 * Build journal dataset from ShowJCR raw CSV files.
 *
 * Usage:
 *   npm run build:journals              # use data/raw if present, else download
 *   npm run build:journals -- --download
 *   npm run build:journals -- --from-merged path/to/merged.csv
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import Papa from "papaparse";
import type { Journal, JournalDataset } from "../src/data/types";

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUTPUT_JSON = path.join(ROOT, "src", "data", "journals.json");
const OUTPUT_GZ = path.join(ROOT, "src", "data", "journals.json.gz");

const SHOWJCR_RAW_BASE =
  "https://raw.githubusercontent.com/hitfyd/ShowJCR/master/%E4%B8%AD%E7%A7%91%E9%99%A2%E5%88%86%E5%8C%BA%E8%A1%A8%E5%8F%8AJCR%E5%8E%9F%E5%A7%8B%E6%95%B0%E6%8D%AE%E6%96%87%E4%BB%B6";

const RAW_FILES = {
  partition: "FQBJCR2025-UTF8.csv",
  impactFactor: "JCR2024-UTF8.csv",
} as const;

type CsvRow = Record<string, string>;

function parseCsv(content: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row})`);
  }

  return result.data;
}

function extractRank(partition: string): number | null {
  const match = partition.match(/\[(\d+)\/\d+\]/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractZone(partition: string): number | null {
  const match = partition.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function calculateAuthorityLevel(
  rank: number | null,
  zoneCounts: Record<1 | 2 | 3 | 4, number>
): string {
  if (rank == null) return "";

  const { 1: x1, 2: x2, 3: x3 } = zoneCounts;

  if (rank <= x1 + x2 / 2) return "一级";
  if (rank <= x1 + x2 + x3) return "二级";
  return "三级";
}

function splitIssn(value: string): { issn: string; eissn: string } {
  const [issn = "", eissn = ""] = value.split("/");
  return { issn: issn.trim(), eissn: eissn.trim() };
}

function collectMinorCategories(row: CsvRow): Journal["minorCategories"] {
  const categories: Journal["minorCategories"] = [];

  for (let i = 1; i <= 6; i += 1) {
    const name = row[`小类${i}`]?.trim();
    const partition = row[`小类${i}分区`]?.trim();
    if (name && partition) {
      categories.push({ name, partition });
    }
  }

  return categories;
}

function parseImpactFactor(value: unknown): number | string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (raw.startsWith("<")) return raw;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : "";
}

function rowToJournal(row: CsvRow): Journal | null {
  const journalName = row.Journal?.trim();
  if (!journalName) return null;

  return {
    journalName,
    year: Number.parseInt(row["年份"] ?? "", 10) || 0,
    issn: row["ISSN/EISSN"]?.trim() ?? "",
    review: row.Review?.trim() || "否",
    oaj: row["OA Journal Index（OAJ）"]?.trim() || "否",
    openAccess: row["Open Access"]?.trim() || "否",
    webOfScience: row["Web of Science"]?.trim() ?? "",
    impactFactor: parseImpactFactor(row["影响因子"]),
    annotation: row["标注"]?.trim() ?? "",
    majorCategory: row["大类"]?.trim() ?? "",
    majorCategoryPartition: row["大类分区"]?.trim() ?? "",
    top: row.Top?.trim() || "否",
    authorityJournal: row["权威期刊"]?.trim() ?? "",
    minorCategories: collectMinorCategories(row),
  };
}

function buildImpactFactorMap(jcrRows: CsvRow[]): Map<string, number | string> {
  const map = new Map<string, number | string>();
  const ifColumn =
    jcrRows[0] && "IF(2025)" in jcrRows[0]
      ? "IF(2025)"
      : jcrRows[0] && "IF(2024)" in jcrRows[0]
        ? "IF(2024)"
        : null;

  if (!ifColumn) {
    throw new Error("Could not find IF(2025) or IF(2024) column in JCR CSV.");
  }

  for (const row of jcrRows) {
    const impactFactor = parseImpactFactor(row[ifColumn]);
    if (impactFactor === "") continue;

    const issn = row.ISSN?.trim();
    const eissn = row.eISSN?.trim();

    if (issn) map.set(issn, impactFactor);
    if (eissn) map.set(eissn, impactFactor);
  }

  return map;
}

function getImpactFactorYear(jcrRows: CsvRow[]): number {
  if (jcrRows[0] && "IF(2025)" in jcrRows[0]) return 2025;
  if (jcrRows[0] && "IF(2024)" in jcrRows[0]) return 2024;
  return 0;
}

function buildFromRaw(partitionRows: CsvRow[], jcrRows: CsvRow[]): Journal[] {
  const impactFactorMap = buildImpactFactorMap(jcrRows);
  const grouped = new Map<string, CsvRow[]>();

  for (const row of partitionRows) {
    const discipline = row["大类"]?.trim();
    if (!discipline) continue;

    const list = grouped.get(discipline) ?? [];
    list.push(row);
    grouped.set(discipline, list);
  }

  const journals: Journal[] = [];

  for (const [, rows] of grouped) {
    const zoneCounts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    const enriched = rows.map((row) => {
      const { issn, eissn } = splitIssn(row["ISSN/EISSN"] ?? "");
      const zone = extractZone(row["大类分区"] ?? "");
      const rank = extractRank(row["大类分区"] ?? "");

      if (zone === 1 || zone === 2 || zone === 3 || zone === 4) {
        zoneCounts[zone] += 1;
      }

      const impactFactor =
        impactFactorMap.get(issn) ??
        impactFactorMap.get(eissn) ??
        "";

      return {
        row: {
          ...row,
          影响因子: impactFactor === "" ? "" : String(impactFactor),
        },
        rank,
      };
    });

    for (const item of enriched) {
      const authorityJournal = calculateAuthorityLevel(item.rank, zoneCounts);
      const journal = rowToJournal({
        ...item.row,
        权威期刊: authorityJournal,
      });
      if (journal) journals.push(journal);
    }
  }

  journals.sort((a, b) => {
    const rankA = extractRank(a.majorCategoryPartition) ?? Number.MAX_SAFE_INTEGER;
    const rankB = extractRank(b.majorCategoryPartition) ?? Number.MAX_SAFE_INTEGER;
    if (a.majorCategory !== b.majorCategory) {
      return a.majorCategory.localeCompare(b.majorCategory, "zh-CN");
    }
    return rankA - rankB;
  });

  return journals;
}

function buildFromMerged(mergedRows: CsvRow[]): Journal[] {
  return mergedRows
    .map((row) => rowToJournal(row))
    .filter((journal): journal is Journal => journal != null);
}

async function downloadRawFile(filename: string): Promise<void> {
  const target = path.join(RAW_DIR, filename);
  const url = `${SHOWJCR_RAW_BASE}/${encodeURIComponent(filename)}`;

  console.log(`Downloading ${filename}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(target, buffer);
  console.log(`Saved ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

async function ensureRawFiles(forceDownload: boolean): Promise<void> {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  for (const filename of Object.values(RAW_FILES)) {
    const target = path.join(RAW_DIR, filename);
    if (forceDownload || !fs.existsSync(target)) {
      await downloadRawFile(filename);
    }
  }
}

function writeDataset(dataset: JournalDataset): void {
  const json = JSON.stringify(dataset);
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, json, "utf8");
  fs.writeFileSync(OUTPUT_GZ, zlib.gzipSync(json));

  console.log(
    `Wrote ${OUTPUT_GZ} (${(fs.statSync(OUTPUT_GZ).size / 1024 / 1024).toFixed(2)} MB, ${dataset.journalCount} journals)`
  );
  console.log(
    `Wrote ${OUTPUT_JSON} (${(fs.statSync(OUTPUT_JSON).size / 1024 / 1024).toFixed(2)} MB, gitignored)`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceDownload = args.includes("--download");
  const fromMergedIndex = args.indexOf("--from-merged");
  const fromMergedPath =
    fromMergedIndex >= 0 ? args[fromMergedIndex + 1] : undefined;

  let journals: Journal[] = [];
  const partitionYear = 2025;
  let impactFactorYear = 2024;
  let source = {
    partition: RAW_FILES.partition,
    impactFactor: RAW_FILES.impactFactor,
  };

  if (fromMergedPath) {
    const mergedPath = path.resolve(fromMergedPath);
    console.log(`Building from merged CSV: ${mergedPath}`);
    const content = fs.readFileSync(mergedPath, "utf8");
    journals = buildFromMerged(parseCsv(content));
    source = {
      partition: path.basename(fromMergedPath),
      impactFactor: "embedded",
    };
  } else {
    await ensureRawFiles(forceDownload);

    const partitionPath = path.join(RAW_DIR, RAW_FILES.partition);
    const jcrPath = path.join(RAW_DIR, RAW_FILES.impactFactor);

    console.log("Reading raw CSV files...");
    const partitionRows = parseCsv(fs.readFileSync(partitionPath, "utf8"));
    const jcrRows = parseCsv(fs.readFileSync(jcrPath, "utf8"));
    impactFactorYear = getImpactFactorYear(jcrRows);

    console.log(`Partition rows: ${partitionRows.length}`);
    console.log(`JCR rows: ${jcrRows.length}`);

    journals = buildFromRaw(partitionRows, jcrRows);

    const matched = journals.filter((journal) => journal.impactFactor !== "").length;
    console.log(`Matched impact factors: ${matched}/${journals.length}`);
  }

  const dataset: JournalDataset = {
    version: "1.0",
    partitionYear,
    impactFactorYear,
    source,
    generatedAt: new Date().toISOString(),
    journalCount: journals.length,
    journals,
  };

  writeDataset(dataset);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
