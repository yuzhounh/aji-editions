"use client";

import * as React from "react";
import type { EditionsCollection, Journal, JournalDataset } from "@/data/types";
import { getLatestEditionIdFromCollection } from "@/data/edition-utils";

type EditionContextValue = {
  editions: JournalDataset[];
  currentEdition: JournalDataset;
  currentEditionId: string;
  setEditionId: (editionId: string) => void;
  journals: Journal[];
};

const EditionContext = React.createContext<EditionContextValue | null>(null);

const STORAGE_KEY = "aji-editions:selected-edition";

type EditionProviderProps = {
  collection: EditionsCollection;
  children: React.ReactNode;
};

export function EditionProvider({ collection, children }: EditionProviderProps) {
  const latestEditionId = getLatestEditionIdFromCollection(collection);
  const [currentEditionId, setCurrentEditionId] = React.useState(latestEditionId);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (
      stored &&
      collection.editions.some((edition) => edition.id === stored)
    ) {
      setCurrentEditionId(stored);
    }
  }, [collection.editions]);

  const setEditionId = React.useCallback((editionId: string) => {
    setCurrentEditionId(editionId);
    window.localStorage.setItem(STORAGE_KEY, editionId);
  }, []);

  const currentEdition =
    collection.editions.find((edition) => edition.id === currentEditionId) ??
    collection.editions[0];

  if (!currentEdition) {
    throw new Error("No editions available.");
  }

  const value = React.useMemo(
    () => ({
      editions: collection.editions,
      currentEdition,
      currentEditionId: currentEdition.id,
      setEditionId,
      journals: currentEdition.journals,
    }),
    [collection.editions, currentEdition, setEditionId]
  );

  return (
    <EditionContext.Provider value={value}>{children}</EditionContext.Provider>
  );
}

export function useEdition(): EditionContextValue {
  const context = React.useContext(EditionContext);
  if (!context) {
    throw new Error("useEdition must be used within an EditionProvider.");
  }
  return context;
}
