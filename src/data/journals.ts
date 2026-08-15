/**
 * @fileoverview Loads pre-built AJI Editions datasets on the server side.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { EditionsCollection, Journal, JournalDataset } from "./types";
import { getLatestEditionFromCollection } from "./edition-utils";

export type { Journal, JournalDataset, EditionsCollection, MinorCategory } from "./types";

function loadEditionsCollection(): EditionsCollection {
  const gzPath = path.resolve(process.cwd(), "src/data/editions/editions.json.gz");

  if (!fs.existsSync(gzPath)) {
    throw new Error(
      "Missing src/data/editions/editions.json.gz. Run `npm run build:editions` first."
    );
  }

  const compressed = fs.readFileSync(gzPath);
  const json = zlib.gunzipSync(compressed).toString("utf8");
  const collection = JSON.parse(json) as EditionsCollection;

  collection.editions = collection.editions.map((edition) => ({
    ...edition,
    journals: edition.journals.filter((journal) => journal.journalName),
  }));

  return collection;
}

export const editionsCollection = loadEditionsCollection();

export function getEditionById(editionId: string): JournalDataset | undefined {
  return editionsCollection.editions.find((edition) => edition.id === editionId);
}

export function getDefaultEdition(): JournalDataset {
  return getLatestEditionFromCollection(editionsCollection);
}

/** Default edition journals — kept for backward compatibility in server modules. */
export const journals: Journal[] = getDefaultEdition().journals;
