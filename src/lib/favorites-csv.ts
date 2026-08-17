import type { Journal } from "@/data/journals";
import type { Locale } from "@/i18n/categories";
import { getPrimaryIssn } from "@/lib/issn";

export const LIST_NAME_COLUMN = "List Name";

export function sanitizeCsvFilename(name: string): string {
  const sanitized = name
    .replace(/[<>:"/\\|?*#]/g, "_")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 120);
  return sanitized || "journal-list";
}

/** Strip export prefixes so re-import restores the original list name. */
export function deriveListNameFromFilename(filename: string): string {
  let name = filename.replace(/\.csv$/i, "").replace(/_/g, " ").trim();
  if (name.startsWith("Selected-")) {
    name = name.slice("Selected-".length);
  }
  if (name.startsWith("Favorites-")) {
    name = name.slice("Favorites-".length);
  }
  if (name.startsWith("All-Favorites")) {
    name = "All Favorites";
  }
  return name.trim() || "Imported List";
}

export function normalizeListName(name: string): string {
  return name.trim().toLowerCase();
}

export function isDuplicateListName(
  name: string,
  existingNames: string[],
  excludeName?: string
): boolean {
  const normalized = normalizeListName(name);
  const exclude = excludeName ? normalizeListName(excludeName) : null;
  return existingNames.some((existing) => {
    const existingNormalized = normalizeListName(existing);
    if (exclude && existingNormalized === exclude) {
      return false;
    }
    return existingNormalized === normalized;
  });
}

export function resolveUniqueListName(
  desiredName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(desiredName)) {
    return desiredName;
  }
  const dated = `${desiredName} (${new Date().toLocaleDateString()})`;
  if (!existingNames.has(dated)) {
    return dated;
  }
  return `${desiredName} (${Date.now()})`;
}

const AUTHORITY_LEVEL_EXPORT: Record<Locale, Record<string, string>> = {
  en: {
    一级: "Level 1",
    二级: "Level 2",
    三级: "Level 3",
  },
  zh: {
    一级: "一级",
    二级: "二级",
    三级: "三级",
  },
};

const OPEN_ACCESS_EXPORT: Record<Locale, Record<string, string>> = {
  en: {
    是: "Yes",
    否: "No",
  },
  zh: {
    是: "是",
    否: "否",
  },
};

export function formatAuthorityForExport(level: string, locale: Locale): string {
  return AUTHORITY_LEVEL_EXPORT[locale][level] ?? level;
}

export function formatOpenAccessForExport(value: string, locale: Locale): string {
  return OPEN_ACCESS_EXPORT[locale][value] ?? value;
}

type ExportOptions = {
  hasPartition: boolean;
  partitionHeader: string;
  includeListName?: boolean;
  listName?: string;
  locale: Locale;
};

export function buildJournalExportHeaders(options: ExportOptions): string[] {
  const dataHeaders = options.hasPartition
    ? [
        "Journal Name",
        "ISSN/EISSN",
        "Impact Factor",
        options.partitionHeader,
        "Authority Level",
        "Open Access",
      ]
    : ["Journal Name", "ISSN/EISSN", "Impact Factor", "Open Access"];

  return options.includeListName
    ? [LIST_NAME_COLUMN, ...dataHeaders]
    : dataHeaders;
}

export function buildJournalExportRow(
  journal: Journal,
  options: ExportOptions
): (string | number)[] {
  const dataRow = options.hasPartition
    ? [
        journal.journalName,
        journal.issn,
        journal.impactFactor,
        journal.majorCategoryPartition,
        formatAuthorityForExport(journal.authorityJournal, options.locale),
        formatOpenAccessForExport(journal.openAccess, options.locale),
      ]
    : [
        journal.journalName,
        journal.issn,
        journal.impactFactor,
        formatOpenAccessForExport(journal.openAccess, options.locale),
      ];

  return options.includeListName
    ? [options.listName ?? "", ...dataRow]
    : dataRow;
}

export function buildJournalExportTable(
  journals: Journal[],
  options: ExportOptions
): (string | number)[][] {
  const headers = buildJournalExportHeaders(options);
  const rows = journals.map((journal) => buildJournalExportRow(journal, options));
  return [headers, ...rows];
}

export type ParsedImportRow = Record<string, string | undefined>;

export function groupImportRowsByListName(
  rows: ParsedImportRow[],
  fallbackListName: string
): Map<string, Set<string>> {
  const hasListNameColumn = rows.some((row) => row[LIST_NAME_COLUMN]?.trim());
  const groups = new Map<string, Set<string>>();

  for (const row of rows) {
    const issn = getPrimaryIssn(row["ISSN/EISSN"] ?? "");
    if (!issn) continue;

    const listName = hasListNameColumn
      ? row[LIST_NAME_COLUMN]?.trim() || fallbackListName
      : fallbackListName;

    if (!groups.has(listName)) {
      groups.set(listName, new Set());
    }
    groups.get(listName)!.add(issn);
  }

  return groups;
}
