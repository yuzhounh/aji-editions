/**
 * @fileoverview Loads pre-built AJI Editions datasets on the server side.
 */
import path from "path";
import type { Journal, JournalDataset } from "./types";
import { createEditionStore } from "./edition-store";

export type { Journal, JournalDataset, EditionsCollection, MinorCategory } from "./types";

const store = createEditionStore(path.resolve(process.cwd(), "public/data"));

export function getEditionById(editionId: string): JournalDataset | undefined {
  return store.get(editionId);
}

export function getDefaultEdition(): JournalDataset {
  return store.default();
}

/** Default edition journals — for server modules that search the active dataset. */
export function getDefaultJournals(): Journal[] {
  return getDefaultEdition().journals;
}
