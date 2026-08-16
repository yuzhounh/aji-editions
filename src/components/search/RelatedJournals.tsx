"use client";

import { useMemo } from "react";
import type { Journal } from "@/data/journals";
import { Skeleton } from "@/components/ui/skeleton";
import JournalListItem from "./JournalListItem";
import { useEdition } from "@/contexts/EditionContext";
import { useTranslation } from "@/i18n/provider";
import { getPrimaryIssn } from "@/lib/issn";

type RelatedJournalRef = {
  journalName: string;
  issn: string;
};

interface RelatedJournalsProps {
  relatedJournals: RelatedJournalRef[] | null;
  isLoading: boolean;
  error: string | null;
  onJournalSelect: (journalName: string) => void;
}

export default function RelatedJournals({
  relatedJournals,
  isLoading,
  error,
  onJournalSelect,
}: RelatedJournalsProps) {
  const { journals } = useEdition();
  const { t } = useTranslation();

  const journalMap = useMemo(
    () => new Map(journals.map((j) => [getPrimaryIssn(j.issn), j])),
    [journals]
  );

  const fullRelatedJournals = useMemo(() => {
    if (!relatedJournals) return [];
    return relatedJournals
      .map((ref) => journalMap.get(getPrimaryIssn(ref.issn)))
      .filter((j): j is Journal => !!j);
  }, [relatedJournals, journalMap]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-[88px] w-full" />
        <Skeleton className="h-[88px] w-full" />
        <Skeleton className="h-[88px] w-full" />
      </div>
    );
  }

  if (error) {
    return null;
  }

  if (fullRelatedJournals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("journal.relatedEmpty")}</p>
    );
  }

  return (
    <div className="space-y-2">
      {fullRelatedJournals.map((relatedJournal) => (
        <JournalListItem
          key={relatedJournal.issn}
          journal={relatedJournal}
          onClick={() => onJournalSelect(relatedJournal.journalName)}
        />
      ))}
    </div>
  );
}
