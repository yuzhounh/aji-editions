import fs from "fs";
import path from "path";
import zlib from "zlib";
import Papa from "papaparse";
import type { Journal, JournalDataset, EditionsCollection } from "../src/data/types";
import {
  DEFAULT_EDITION_ID,
  EDITION_DEFINITIONS,
  type EditionDefinition,
} from "../src/data/edition-config";

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUTPUT_DIR = path.join(ROOT, "src", "data", "editions");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "editions.json");
const OUTPUT_GZ = path.join(OUTPUT_DIR, "editions.json.gz");

const SHOWJCR_RAW_BASE =
  "https://raw.githubusercontent.com/hitfyd/ShowJCR/master/%E4%B8%AD%E7%A7%91%E9%99%A2%E5%88%86%E5%8C%BA%E8%A1%A8%E5%8F%8AJCR%E5%8E%9F%E5%A7%8B%E6%95%B0%E6%8D%AE%E6%96%87%E4%BB%B6";

const OPENALEX_MAILTO = "aji-editions@build.local";
const OPENALEX_CACHE_PATH = path.join(ROOT, "data", "cache", "openalex-oa-by-issn.json");
const CAS_OA_SOURCE_EDITION_ID = "cas-2025";

type OaFields = {
  openAccess: string;
  oaj: string;
};

type OpenAccessLookup = {
  byName: Map<string, OaFields>;
  byIssn: Map<string, OaFields>;
};

type OpenAlexOaCache = Record<string, boolean>;

type CsvRow = Record<string, string>;

function issnsFromCombined(value: string): string[] {
  return [...new Set(value.split("/").map((part) => part.trim()).filter(Boolean))];
}

function buildOpenAccessLookup(rows: CsvRow[]): OpenAccessLookup {
  const byName = new Map<string, OaFields>();
  const byIssn = new Map<string, OaFields>();

  for (const row of rows) {
    const fields: OaFields = {
      openAccess: row["Open Access"]?.trim() || "否",
      oaj: row["OA Journal Index（OAJ）"]?.trim() || "否",
    };

    const name = row.Journal?.trim().toUpperCase();
    if (name) byName.set(name, fields);

    for (const issn of issnsFromCombined(row["ISSN/EISSN"] ?? "")) {
      byIssn.set(issn, fields);
    }
  }

  return { byName, byIssn };
}

function lookupOpenAccessFields(
  lookup: OpenAccessLookup,
  journalName: string,
  issnCombined: string
): OaFields | null {
  const byName = lookup.byName.get(journalName.trim().toUpperCase());
  if (byName) return byName;

  for (const issn of issnsFromCombined(issnCombined)) {
    const byIssn = lookup.byIssn.get(issn);
    if (byIssn) return byIssn;
  }

  return null;
}

function loadOpenAlexOaCache(): OpenAlexOaCache {
  if (!fs.existsSync(OPENALEX_CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(OPENALEX_CACHE_PATH, "utf8")) as OpenAlexOaCache;
  } catch {
    return {};
  }
}

function saveOpenAlexOaCache(cache: OpenAlexOaCache): void {
  fs.mkdirSync(path.dirname(OPENALEX_CACHE_PATH), { recursive: true });
  fs.writeFileSync(OPENALEX_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenAlexIsOa(issn: string): Promise<boolean | null> {
  const url = `https://api.openalex.org/sources/issn:${encodeURIComponent(issn)}?mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 404) return false;
    if (!response.ok) return null;

    const data = (await response.json()) as { is_oa?: boolean };
    return data.is_oa === true;
  } catch {
    return null;
  }
}

async function resolveOpenAlexIsOa(
  issns: string[],
  cache: OpenAlexOaCache
): Promise<boolean | null> {
  if (issns.length === 0) return null;

  let sawResolved = false;

  for (const issn of issns) {
    if (issn in cache) {
      if (cache[issn]) return true;
      sawResolved = true;
      continue;
    }

    const isOa = await fetchOpenAlexIsOa(issn);
    await sleep(80);

    if (isOa === null) continue;

    cache[issn] = isOa;
    sawResolved = true;
    if (isOa) return true;
  }

  if (sawResolved) return false;
  return null;
}

async function checkDoajListed(issn: string): Promise<boolean | null> {
  const url = `https://doaj.org/api/search/journals/issn:${encodeURIComponent(issn)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { total?: number };
    return (data.total ?? 0) > 0;
  } catch {
    return null;
  }
}

async function logDoajAuxiliaryCheck(
  journalName: string,
  issns: string[],
  openAccess: string
): Promise<void> {
  for (const issn of issns) {
    const listed = await checkDoajListed(issn);
    await sleep(100);
    if (listed === null) continue;

    const markedOa = openAccess === "是";
    if (markedOa && !listed) {
      console.warn(
        `[xr-2026][DOAJ check] ${journalName} (${issn}): openAccess=是 but not in DOAJ`
      );
    }
    if (!markedOa && listed) {
      console.warn(
        `[xr-2026][DOAJ check] ${journalName} (${issn}): openAccess=否 but listed in DOAJ`
      );
    }
    return;
  }
}

async function enrichXrOpenAccess(
  journals: Journal[],
  casLookup: OpenAccessLookup
): Promise<Journal[]> {
  const cache = loadOpenAlexOaCache();
  let inheritedFromCas = 0;
  let filledByOpenAlex = 0;
  let defaultedToClosed = 0;
  let openAlexFailures = 0;

  const enriched: Journal[] = [];

  for (const journal of journals) {
    const casFields = lookupOpenAccessFields(
      casLookup,
      journal.journalName,
      journal.issn
    );

    if (casFields) {
      inheritedFromCas += 1;
      enriched.push({
        ...journal,
        openAccess: casFields.openAccess,
        oaj: casFields.oaj,
      });
      continue;
    }

    const issns = issnsFromCombined(journal.issn);
    const isOa = await resolveOpenAlexIsOa(issns, cache);
    const openAccess = isOa === true ? "是" : "否";

    if (isOa === null) {
      openAlexFailures += 1;
      defaultedToClosed += 1;
    } else {
      filledByOpenAlex += 1;
    }

    enriched.push({
      ...journal,
      openAccess,
      oaj: "否",
    });

    if (process.env.AJI_DOAJ_CHECK === "1") {
      await logDoajAuxiliaryCheck(journal.journalName, issns, openAccess);
    }
  }

  saveOpenAlexOaCache(cache);

  console.log(
    `[xr-2026] Open access: ${inheritedFromCas} from CAS 2025, ${filledByOpenAlex} from OpenAlex, ${defaultedToClosed} defaulted to 否 (${openAlexFailures} OpenAlex lookup failures)`
  );

  return enriched;
}

function loadCas2025PartitionRows(): CsvRow[] {
  const casDefinition = EDITION_DEFINITIONS.find(
    (definition) => definition.id === CAS_OA_SOURCE_EDITION_ID
  );
  if (!casDefinition) {
    throw new Error(`Missing edition definition: ${CAS_OA_SOURCE_EDITION_ID}`);
  }

  const casPath = path.join(RAW_DIR, casDefinition.partitionFile);
  if (!fs.existsSync(casPath)) {
    throw new Error(
      `Missing ${casDefinition.partitionFile} required for XR open-access enrichment. Run a full build or download raw files first.`
    );
  }

  return parseCsv(fs.readFileSync(casPath, "utf8"));
}

async function ensureCas2025RawForXr(
  definitions: EditionDefinition[],
  forceDownload: boolean
): Promise<void> {
  const buildsXr = definitions.some((definition) => definition.partitionType === "xr");
  if (!buildsXr) return;

  const casDefinition = EDITION_DEFINITIONS.find(
    (definition) => definition.id === CAS_OA_SOURCE_EDITION_ID
  );
  if (!casDefinition) return;

  const target = path.join(RAW_DIR, casDefinition.partitionFile);
  if (forceDownload || !fs.existsSync(target)) {
    await downloadRawFile(casDefinition.partitionFile);
  }
}

function parseCsv(content: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const criticalErrors = result.errors.filter(
    (error) => error.code !== "TooFewFields" && error.code !== "TooManyFields"
  );

  if (criticalErrors.length > 0) {
    const first = criticalErrors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row})`);
  }

  return result.data.map((row) => {
    const normalized: CsvRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim()] = value ?? "";
    }
    return normalized;
  });
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

function normalizePartitionZone(value: string): string {
  return value.replace(/\s*区\s*$/u, "").trim();
}

function formatMinorCategoryName(en: string, zh: string): string {
  if (en && zh) return `${en} ${zh}`;
  return en || zh;
}

function buildXrMinorEnglishMap(rows: CsvRow[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const row of rows) {
    for (let i = 1; i <= 6; i += 1) {
      const en = row[`小类${i}英文名`]?.trim();
      const zh = row[`小类${i}中文名`]?.trim();
      if (en && zh) {
        map.set(zh, en);
      }
    }
  }

  return map;
}

function normalizeCasPartitionRows(rows: CsvRow[]): CsvRow[] {
  return rows
    .map((row) => {
      const issnCombined =
        row["ISSN/EISSN"]?.trim() || row.ISSN?.trim() || "";

      const normalized: CsvRow = {
        Journal: row.Journal?.trim() ?? "",
        年份: row.年份 ?? "",
        "ISSN/EISSN": issnCombined,
        Review: row.Review?.trim() || "否",
        "OA Journal Index（OAJ）": row["OA Journal Index（OAJ）"]?.trim() || "否",
        "Open Access": row["Open Access"]?.trim() || "否",
        "Web of Science": row["Web of Science"]?.trim() ?? "",
        标注: row.标注?.trim() ?? "",
        大类: row.大类?.trim() ?? "",
        大类分区: normalizePartitionZone(row.大类分区 ?? ""),
        Top: row.Top?.trim() || "否",
      };

      for (let i = 1; i <= 6; i += 1) {
        normalized[`小类${i}`] = row[`小类${i}`]?.trim() ?? "";
        normalized[`小类${i}分区`] = normalizePartitionZone(
          row[`小类${i}分区`] ?? ""
        );
      }

      return normalized;
    })
    .filter((row) => row.Journal && row.大类);
}

function normalizeXrPartitionRows(rows: CsvRow[]): CsvRow[] {
  const minorEnglishMap = buildXrMinorEnglishMap(rows);

  return rows
    .map((row) => {
      const issn = row.ISSN?.trim() ?? "";
      const eissn = row.EISSN?.trim() ?? "";
      const issnCombined =
        issn && eissn ? `${issn}/${eissn}` : issn || eissn;

      const normalized: CsvRow = {
        Journal: row.Journal?.trim() || row.刊名?.trim() || "",
        年份: row.年份 ?? "",
        "ISSN/EISSN": issnCombined,
        Review: row.期刊类型?.includes("Review") ? "是" : "否",
        "OA Journal Index（OAJ）": "否",
        "Open Access": "否",
        "Web of Science": row.数据库?.trim() ?? "",
        标注: row.预警标记?.trim() || row.标注?.trim() || "",
        大类: row.大类中文名?.trim() ?? "",
        大类分区: normalizePartitionZone(row.大类新锐分区 ?? ""),
        Top: row.Top?.trim() === "—" ? "否" : row.Top?.trim() || "否",
      };

      for (let i = 1; i <= 6; i += 1) {
        const zh = row[`小类${i}中文名`]?.trim() ?? "";
        let en = row[`小类${i}英文名`]?.trim() ?? "";
        if (!en && zh) {
          en = minorEnglishMap.get(zh) ?? "";
        }
        normalized[`小类${i}`] = formatMinorCategoryName(en, zh);
        normalized[`小类${i}分区`] = normalizePartitionZone(
          row[`小类${i}新锐分区`] ?? ""
        );
      }

      return normalized;
    })
    .filter((row) => row.Journal && row.大类);
}

function normalizePartitionRows(
  definition: EditionDefinition,
  rows: CsvRow[]
): CsvRow[] {
  if (definition.partitionType === "xr") {
    return normalizeXrPartitionRows(rows);
  }
  return normalizeCasPartitionRows(rows);
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

function findIfColumn(jcrRows: CsvRow[]): { column: string; year: number } {
  const headers = Object.keys(jcrRows[0] ?? {});
  const ifHeader = headers.find((header) => /IF\(\d{4}\)/.test(header));

  if (!ifHeader) {
    throw new Error("Could not find IF(YYYY) column in JCR CSV.");
  }

  const yearMatch = ifHeader.match(/\d{4}/);
  return {
    column: ifHeader,
    year: yearMatch ? Number.parseInt(yearMatch[0], 10) : 0,
  };
}

function getRowValue(row: CsvRow, column: string): string {
  return row[column] ?? row[column.trim()] ?? "";
}

function buildImpactFactorLookup(jcrRows: CsvRow[]): {
  byIssn: Map<string, number | string>;
  byName: Map<string, number | string>;
} {
  const byIssn = new Map<string, number | string>();
  const byName = new Map<string, number | string>();
  const { column: ifColumn } = findIfColumn(jcrRows);

  for (const row of jcrRows) {
    const impactFactor = parseImpactFactor(getRowValue(row, ifColumn));
    if (impactFactor === "") continue;

    const journalName = row.Journal?.trim().toUpperCase();
    if (journalName) byName.set(journalName, impactFactor);

    const issn = row.ISSN?.trim();
    const eissn = row.eISSN?.trim();
    if (issn) byIssn.set(issn, impactFactor);
    if (eissn) byIssn.set(eissn, impactFactor);
  }

  return { byIssn, byName };
}

function lookupImpactFactor(
  lookup: ReturnType<typeof buildImpactFactorLookup>,
  issn: string,
  eissn: string,
  journalName: string
): number | string {
  return (
    lookup.byIssn.get(issn) ??
    lookup.byIssn.get(eissn) ??
    lookup.byName.get(journalName.toUpperCase()) ??
    ""
  );
}

function impactFactorSortValue(value: number | string): number {
  if (typeof value === "number") return value;
  if (value.startsWith("<")) {
    const parsed = Number.parseFloat(value.slice(1));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function enrichPartitionsWithRank(rows: CsvRow[]): CsvRow[] {
  const grouped = new Map<string, CsvRow[]>();

  for (const row of rows) {
    const discipline = row.大类?.trim();
    if (!discipline) continue;
    const list = grouped.get(discipline) ?? [];
    list.push(row);
    grouped.set(discipline, list);
  }

  const enriched: CsvRow[] = [];

  for (const [, categoryRows] of grouped) {
    const sorted = [...categoryRows].sort((a, b) => {
      const ifA = impactFactorSortValue(parseImpactFactor(a.影响因子));
      const ifB = impactFactorSortValue(parseImpactFactor(b.影响因子));
      return ifB - ifA;
    });

    const total = sorted.length;

    sorted.forEach((row, index) => {
      const rank = index + 1;
      const zone = extractZone(row.大类分区 ?? "") ?? 4;
      const hasRank = extractRank(row.大类分区 ?? "") != null;

      enriched.push({
        ...row,
        大类分区: hasRank
          ? row.大类分区
          : `${zone} [${rank}/${total}]`,
      });
    });
  }

  return enriched;
}

function enrichMinorPartitionsWithRank(rows: CsvRow[]): CsvRow[] {
  type MinorEntry = {
    rowIndex: number;
    minorIndex: number;
  };

  const byMinor = new Map<string, MinorEntry[]>();

  rows.forEach((row, rowIndex) => {
    for (let i = 1; i <= 6; i += 1) {
      const name = row[`小类${i}`]?.trim();
      const partition = row[`小类${i}分区`]?.trim();
      if (!name || !partition) continue;

      const list = byMinor.get(name) ?? [];
      list.push({ rowIndex, minorIndex: i });
      byMinor.set(name, list);
    }
  });

  const result = rows.map((row) => ({ ...row }));

  for (const [, entries] of byMinor) {
    const sorted = [...entries].sort((a, b) => {
      const ifA = impactFactorSortValue(
        parseImpactFactor(result[a.rowIndex].影响因子)
      );
      const ifB = impactFactorSortValue(
        parseImpactFactor(result[b.rowIndex].影响因子)
      );
      return ifB - ifA;
    });

    const total = sorted.length;

    sorted.forEach((entry, index) => {
      const partitionKey = `小类${entry.minorIndex}分区`;
      const partition = result[entry.rowIndex][partitionKey] ?? "";
      if (extractRank(partition) != null) return;

      const zone = extractZone(partition) ?? 4;
      const rank = index + 1;
      result[entry.rowIndex][partitionKey] = `${zone} [${rank}/${total}]`;
    });
  }

  return result;
}

function buildFromRaw(partitionRows: CsvRow[], jcrRows: CsvRow[]): Journal[] {
  const impactFactorLookup = buildImpactFactorLookup(jcrRows);

  const rowsWithIf = partitionRows.map((row) => {
    const { issn, eissn } = splitIssn(row["ISSN/EISSN"] ?? "");
    const impactFactor = lookupImpactFactor(
      impactFactorLookup,
      issn,
      eissn,
      row.Journal ?? ""
    );

    return {
      ...row,
      影响因子: impactFactor === "" ? "" : String(impactFactor),
    };
  });

  const rowsWithRank = enrichMinorPartitionsWithRank(
    enrichPartitionsWithRank(rowsWithIf)
  );
  const grouped = new Map<string, CsvRow[]>();

  for (const row of rowsWithRank) {
    const discipline = row.大类?.trim();
    if (!discipline) continue;

    const list = grouped.get(discipline) ?? [];
    list.push(row);
    grouped.set(discipline, list);
  }

  const journals: Journal[] = [];

  for (const [, rows] of grouped) {
    const zoneCounts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    const enriched = rows.map((row) => {
      const zone = extractZone(row.大类分区 ?? "");
      const rank = extractRank(row.大类分区 ?? "");

      if (zone === 1 || zone === 2 || zone === 3 || zone === 4) {
        zoneCounts[zone] += 1;
      }

      return { row, rank };
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

async function ensureRawFiles(
  definitions: EditionDefinition[],
  forceDownload: boolean
): Promise<void> {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const filenames = new Set<string>();
  for (const definition of definitions) {
    filenames.add(definition.partitionFile);
    filenames.add(definition.impactFactorFile);
  }

  for (const filename of filenames) {
    const target = path.join(RAW_DIR, filename);
    if (forceDownload || !fs.existsSync(target)) {
      await downloadRawFile(filename);
    }
  }
}

async function buildEditionDataset(
  definition: EditionDefinition,
  partitionRows: CsvRow[],
  jcrRows: CsvRow[]
): Promise<JournalDataset> {
  const normalizedRows = normalizePartitionRows(definition, partitionRows);
  let journals = buildFromRaw(normalizedRows, jcrRows);

  if (definition.partitionType === "xr") {
    const casLookup = buildOpenAccessLookup(loadCas2025PartitionRows());
    journals = await enrichXrOpenAccess(journals, casLookup);
  }

  const matched = journals.filter((journal) => journal.impactFactor !== "").length;

  console.log(
    `[${definition.id}] ${journals.length} journals, ${matched} with impact factor`
  );

  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    version: "1.0",
    partitionYear: definition.partitionYear,
    partitionType: definition.partitionType,
    partitionReleaseDate: definition.partitionReleaseDate,
    impactFactorYear: definition.impactFactorYear,
    impactFactorReleaseDate: definition.impactFactorReleaseDate,
    source: {
      partition: definition.partitionFile,
      impactFactor: definition.impactFactorFile,
    },
    generatedAt: new Date().toISOString(),
    journalCount: journals.length,
    journals,
  };
}

function loadExistingCollection(): EditionsCollection | null {
  if (!fs.existsSync(OUTPUT_GZ)) return null;

  try {
    const json = zlib.gunzipSync(fs.readFileSync(OUTPUT_GZ)).toString("utf8");
    return JSON.parse(json) as EditionsCollection;
  } catch {
    return null;
  }
}

function mergeEditionBuilds(
  built: JournalDataset[],
  existing: EditionsCollection | null
): JournalDataset[] {
  if (!existing) return built;

  const builtById = new Map(built.map((edition) => [edition.id, edition]));
  const merged = existing.editions.map(
    (edition) => builtById.get(edition.id) ?? edition
  );

  for (const edition of built) {
    if (!merged.some((item) => item.id === edition.id)) {
      merged.push(edition);
    }
  }

  return merged;
}

function writeCollection(collection: EditionsCollection): void {
  const json = JSON.stringify(collection);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, json, "utf8");
  fs.writeFileSync(OUTPUT_GZ, zlib.gzipSync(json));

  const totalJournals = collection.editions.reduce(
    (sum, edition) => sum + edition.journalCount,
    0
  );

  console.log(
    `Wrote ${OUTPUT_GZ} (${(fs.statSync(OUTPUT_GZ).size / 1024 / 1024).toFixed(2)} MB, ${collection.editions.length} editions, ${totalJournals} total journal records)`
  );
}

export async function buildEditions(options: {
  forceDownload?: boolean;
  editionIds?: string[];
} = {}): Promise<EditionsCollection> {
  const { forceDownload = false, editionIds } = options;
  const definitions = editionIds
    ? EDITION_DEFINITIONS.filter((definition) => editionIds.includes(definition.id))
    : EDITION_DEFINITIONS;

  await ensureRawFiles(definitions, forceDownload);
  await ensureCas2025RawForXr(definitions, forceDownload);

  const editions: JournalDataset[] = [];

  for (const definition of definitions) {
    const partitionPath = path.join(RAW_DIR, definition.partitionFile);
    const jcrPath = path.join(RAW_DIR, definition.impactFactorFile);

    console.log(`Building ${definition.id}...`);
    const partitionRows = parseCsv(fs.readFileSync(partitionPath, "utf8"));
    const jcrRows = parseCsv(fs.readFileSync(jcrPath, "utf8"));

    editions.push(await buildEditionDataset(definition, partitionRows, jcrRows));
  }

  const collection: EditionsCollection = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    defaultEditionId: DEFAULT_EDITION_ID,
    editions: mergeEditionBuilds(editions, loadExistingCollection()),
  };

  writeCollection(collection);
  return collection;
}
