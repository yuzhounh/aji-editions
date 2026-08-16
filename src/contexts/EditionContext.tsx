"use client";

import * as React from "react";
import type { EditionsCollection, Journal, JournalDataset } from "@/data/types";
import { getDefaultEditionIdFromCollection } from "@/data/edition-utils";
import { loadEditionsCollectionClient } from "@/lib/load-editions-client";
import { useTranslation } from "@/i18n/provider";

type EditionContextValue = {
  editions: JournalDataset[];
  currentEdition: JournalDataset;
  currentEditionId: string;
  setEditionId: (editionId: string) => void;
  journals: Journal[];
  isLoading: boolean;
};

const EditionContext = React.createContext<EditionContextValue | null>(null);

const STORAGE_KEY = "aji-editions:selected-edition";

type EditionProviderProps = {
  children: React.ReactNode;
};

function EditionProviderInner({
  collection,
  children,
}: {
  collection: EditionsCollection;
  children: React.ReactNode;
}) {
  const defaultEditionId = getDefaultEditionIdFromCollection(collection);
  const [currentEditionId, setCurrentEditionId] = React.useState(defaultEditionId);

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
      isLoading: false,
    }),
    [collection.editions, currentEdition, setEditionId]
  );

  return (
    <EditionContext.Provider value={value}>{children}</EditionContext.Provider>
  );
}

export function EditionProvider({ children }: EditionProviderProps) {
  const { t } = useTranslation();
  const [collection, setCollection] = React.useState<EditionsCollection | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    loadEditionsCollectionClient()
      .then((loaded) => {
        if (!cancelled) {
          setCollection(loaded);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : t("edition.loadError")
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t("edition.loading")}</p>
      </div>
    );
  }

  return (
    <EditionProviderInner collection={collection}>{children}</EditionProviderInner>
  );
}

export function useEdition(): EditionContextValue {
  const context = React.useContext(EditionContext);
  if (!context) {
    throw new Error("useEdition must be used within an EditionProvider.");
  }
  return context;
}
