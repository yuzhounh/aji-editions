"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RelatedJournal = {
  journalName: string;
  issn: string;
};

interface RelatedJournalsProps {
  relatedJournals: RelatedJournal[] | null;
  isLoading: boolean;
  error: string | null;
  onJournalSelect: (journalName: string) => void;
}

export default function RelatedJournals({ relatedJournals, isLoading, error, onJournalSelect }: RelatedJournalsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    // Silently fail for this component as the error is shown in the summary
    return null;
  }
  
  if (!relatedJournals || relatedJournals.length === 0) {
    return <p>No related journals found.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {relatedJournals.map((relatedJournal, index) => (
        <Card
          key={index}
          className="cursor-pointer hover:shadow-md transition-shadow flex flex-col"
          onClick={() => onJournalSelect(relatedJournal.journalName)}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-medium leading-tight line-clamp-2">{relatedJournal.journalName}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-sm text-muted-foreground">{relatedJournal.issn}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
