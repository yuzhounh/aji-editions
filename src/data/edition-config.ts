export type EditionDefinition = {
  id: string;
  label: { zh: string; en: string };
  shortLabel: { zh: string; en: string };
  partitionFile: string;
  partitionYear: number;
  partitionType: "cas" | "xr";
  partitionReleaseDate: string;
  impactFactorFile: string;
  impactFactorYear: number;
  impactFactorReleaseDate: string;
};

/** Edition pairings follow ShowJCR + Clarivate release timing. */
export const EDITION_DEFINITIONS: EditionDefinition[] = [
  {
    id: "cas-2021",
    label: { zh: "2021 版", en: "2021 Edition" },
    shortLabel: { zh: "IF 2021 · CAS 2021", en: "IF 2021 · CAS 2021" },
    partitionFile: "FQBJCR2021-UTF8.csv",
    partitionYear: 2021,
    partitionType: "cas",
    partitionReleaseDate: "2021-12-20",
    impactFactorFile: "JCR2021-UTF8.csv",
    impactFactorYear: 2021,
    impactFactorReleaseDate: "2021-06-30",
  },
  {
    id: "cas-2022",
    label: { zh: "2022 版", en: "2022 Edition" },
    shortLabel: { zh: "IF 2022 · CAS 2022", en: "IF 2022 · CAS 2022" },
    partitionFile: "FQBJCR2022-UTF8.csv",
    partitionYear: 2022,
    partitionType: "cas",
    partitionReleaseDate: "2022-12-21",
    impactFactorFile: "JCR2022-UTF8.csv",
    impactFactorYear: 2022,
    impactFactorReleaseDate: "2022-06-28",
  },
  {
    id: "cas-2023",
    label: { zh: "2023 版", en: "2023 Edition" },
    shortLabel: { zh: "IF 2023 · CAS 2023", en: "IF 2023 · CAS 2023" },
    partitionFile: "FQBJCR2023-UTF8.csv",
    partitionYear: 2023,
    partitionType: "cas",
    partitionReleaseDate: "2023-12-27",
    impactFactorFile: "JCR2023-UTF8.csv",
    impactFactorYear: 2023,
    impactFactorReleaseDate: "2023-06-28",
  },
  {
    id: "cas-2025",
    label: { zh: "2025 版", en: "2025 Edition" },
    shortLabel: { zh: "IF 2024 · CAS 2025", en: "IF 2024 · CAS 2025" },
    partitionFile: "FQBJCR2025-UTF8.csv",
    partitionYear: 2025,
    partitionType: "cas",
    partitionReleaseDate: "2025-03-20",
    impactFactorFile: "JCR2024-UTF8.csv",
    impactFactorYear: 2024,
    impactFactorReleaseDate: "2024-06-20",
  },
  {
    id: "xr-2026",
    label: { zh: "2026 版", en: "2026 Edition" },
    shortLabel: { zh: "IF 2025 · XR 2026", en: "IF 2025 · XR 2026" },
    partitionFile: "XR2026-UTF8.csv",
    partitionYear: 2026,
    partitionType: "xr",
    partitionReleaseDate: "2026-03-24",
    impactFactorFile: "JCR2025-UTF8.csv",
    impactFactorYear: 2025,
    impactFactorReleaseDate: "2025-06-18",
  },
];

export function getLatestEditionId(
  definitions: EditionDefinition[] = EDITION_DEFINITIONS
): string {
  const latest = [...definitions].sort((a, b) => {
    if (b.partitionYear !== a.partitionYear) {
      return b.partitionYear - a.partitionYear;
    }
    return b.impactFactorYear - a.impactFactorYear;
  })[0];

  if (!latest) {
    throw new Error("No edition definitions configured.");
  }

  return latest.id;
}

export const DEFAULT_EDITION_ID = getLatestEditionId();
