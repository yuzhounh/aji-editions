"use client";

import * as React from "react";
import type { EditionMetadata, EditionShard, Journal, JournalDataset } from "@/data/types";
import { sortEditionsByYearDesc } from "@/data/edition-utils";
import { editionsClient, type EditionCatalog } from "@/lib/load-editions-client";
import { useTranslation } from "@/i18n/provider";

type EditionContextValue = {
  editions: EditionMetadata[];
  currentEdition: JournalDataset;
  currentEditionId: string;
  setEditionId: (editionId: string) => void;
  journals: Journal[];
  isLoading: boolean;
  hasHistory: (primaryIssn: string) => boolean;
  loadHistory: (primaryIssn: string) => Promise<JournalDataset[]>;
};

const EditionContext = React.createContext<EditionContextValue | null>(null);

const STORAGE_KEY = "aji-editions:selected-edition";

type EditionProviderProps = {
  children: React.ReactNode;
};

export function EditionProvider({ children }: EditionProviderProps) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = React.useState<EditionCatalog | null>(null);
  const [current, setCurrent] = React.useState<EditionShard | null>(null);
  const [selection, setSelection] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    editionsClient.catalog()
      .then(async (loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
        let stored: string | null = null;
        try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
        const wanted = selection || stored;
        const fallback = loaded.editions.find(item => item.id === loaded.defaultEditionId) ||
          sortEditionsByYearDesc(loaded.editions.filter(item => item.partitionType !== "jcr-only"))[0] || loaded.editions[0];
        const id = loaded.editions.some(item => item.id === wanted) ? wanted! : fallback.id;
        const shard = await editionsClient.edition(id);
        if (cancelled) return;
        // Change labels and rows together; a slow previous request never changes the selection.
        setCurrent(shard);
        try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* Keep the in-memory selection. */ }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError : new Error("Failed to load edition data"));
        }
      }).finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [selection, attempt]);

  const setEditionId = React.useCallback((id: string) => {
    if (catalog?.editions.some(item => item.id === id)) setSelection(id);
  }, [catalog]);
  const historyIssns = React.useMemo(() => new Set(current?.historyIssns || []), [current]);
  const value = React.useMemo<EditionContextValue | null>(() => current && catalog ? ({
    editions: catalog.editions, currentEdition: current.edition, currentEditionId: current.edition.id,
    setEditionId, journals: current.edition.journals, isLoading: loading,
    hasHistory: (issn: string) => historyIssns.has(issn), loadHistory: editionsClient.loadHistory,
  }) : null, [catalog, current, loading, setEditionId, historyIssns]);

  if (error && !value) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive" role="alert">{t("edition.loadError")}</p>
        <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setAttempt((value) => value + 1)}>
          {t("edition.retry")}
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t("edition.loading")}</p>
      </div>
    );
  }

  return (
    <EditionContext.Provider value={value}>
      {(loading || !!error) && (
        <div className="flex min-h-10 items-center justify-center gap-3 px-4 text-sm" role={error ? "alert" : "status"}>
          <span>{error ? t("edition.loadError") : t("edition.loading")}</span>
          {!!error && <button type="button" className="min-h-10 rounded-md border px-4" onClick={() => setAttempt(value => value + 1)}>{t("edition.retry")}</button>}
        </div>
      )}
      <React.Fragment key="edition-content">{children}</React.Fragment>
    </EditionContext.Provider>
  );
}

export function useEdition(): EditionContextValue {
  const context = React.useContext(EditionContext);
  if (!context) {
    throw new Error("useEdition must be used within an EditionProvider.");
  }
  return context;
}
