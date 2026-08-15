export type MinorCategory = {
  name: string;
  partition: string;
};

export type Journal = {
  journalName: string;
  year: number;
  issn: string;
  review: string;
  oaj: string;
  openAccess: string;
  webOfScience: string;
  impactFactor: number | string;
  annotation: string;
  majorCategory: string;
  majorCategoryPartition: string;
  top: string;
  authorityJournal: string;
  minorCategories: MinorCategory[];
};

export type JournalDataset = {
  id: string;
  label: { zh: string; en: string };
  shortLabel: { zh: string; en: string };
  version: string;
  partitionYear: number;
  partitionType: "cas" | "xr";
  partitionReleaseDate: string;
  impactFactorYear: number;
  impactFactorReleaseDate: string;
  source: {
    partition: string;
    impactFactor: string;
  };
  generatedAt: string;
  journalCount: number;
  journals: Journal[];
};

export type EditionsCollection = {
  version: string;
  generatedAt: string;
  defaultEditionId: string;
  editions: JournalDataset[];
};
