/**
 * @fileoverview Loads pre-built AJI Editions datasets on the server side.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { EditionsCollection, Journal, JournalDataset } from "./types";
import { getLatestEditionFromCollection } from "./edition-utils";

export type { Journal, JournalDataset, EditionsCollection, MinorCategory } from "./types";

const EDITIONS_GZ_CANDIDATES = [
  "src/data/editions/editions.json.gz",
  "public/data/editions.json.gz",
];

let cachedCollection: EditionsCollection | null = null;

function resolveEditionsGzPath(): string {
  for (const relativePath of EDITIONS_GZ_CANDIDATES) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  throw new Error(
    "Missing editions.json.gz. Run `npm run build:editions` first."
  );
}

function loadEditionsCollection(): EditionsCollection {
  const gzPath = resolveEditionsGzPath();
  const compressed = fs.readFileSync(gzPath);
  const json = zlib.gunzipSync(compressed).toString("utf8");
  const collection = JSON.parse(json) as EditionsCollection;

  collection.editions = collection.editions.map((edition) => ({
    ...edition,
    journals: edition.journals.filter((journal) => journal.journalName),
  }));

  return collection;
}

function getEditionsCollection(): EditionsCollection {
  if (!cachedCollection) {
    cachedCollection = loadEditionsCollection();
  }
  return cachedCollection;
}

export function getEditionById(editionId: string): JournalDataset | undefined {
  return getEditionsCollection().editions.find((edition) => edition.id === editionId);
}

export function getDefaultEdition(): JournalDataset {
  return getLatestEditionFromCollection(getEditionsCollection());
}

/** Default edition journals — for server modules that search the active dataset. */
export function getDefaultJournals(): Journal[] {
  return getDefaultEdition().journals;
}
