
"use client";

import { useState, useEffect } from "react";
import type { Journal } from "@/data/journals";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Barcode,
  Globe,
  TrendingUp,
  BookMarked,
  Award,
  DollarSign,
  Search,
  Bot,
  BookCopy,
  Heart,
  LineChart,
} from "lucide-react";
import CasPartitionDisplay from "./CasPartitionDisplay";
import { Badge } from "../ui/badge";
import { getSummary } from "@/app/actions";
import type { JournalSummaryInfo } from "@/app/actions";
import ContentBlockRenderer from "./ContentBlockRenderer";
import RelatedJournals from "./RelatedJournals";
import { useFirebase } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useMemoFirebase } from "@/firebase/provider";
import { useTranslation } from "@/i18n/provider";
import { useEdition } from "@/contexts/EditionContext";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import { formatIssnDisplay, getPrimaryIssn } from "@/lib/issn";
import AddToFavoritesDialog from "../favorites/AddToFavoritesDialog";
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from "../ui/skeleton";
import JournalHistoryDialog from "./JournalHistoryDialog";
import { journalHasMultiEditionHistory } from "@/lib/journal-history";

interface JournalDetailProps {
  journal: Journal;
  onBack: () => void;
  onJournalSelect: (journalName: string) => void;
  isHistoryRoot: boolean;
}

type SummaryCache = {
  [cacheKey: string]: JournalSummaryInfo;
};

function summaryCacheKey(issn: string, locale: string) {
  return `${issn}:${locale}`;
}

const formatImpactFactor = (factor: number | string) => {
    const num = Number(factor);
    if (!isNaN(num) && String(factor).trim() !== "" && !String(factor).includes('<')) {
      return num.toFixed(1);
    }
    return factor;
};

const InfoItem = ({ icon: Icon, label, value, isOA }: { icon: React.ElementType, label: string, value: React.ReactNode, isOA?: boolean }) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-start">
            <Icon className="h-5 w-5 text-accent mr-3 mt-1 shrink-0" />
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="text-base font-semibold">{value || "-"}</div>
                    {isOA && <Badge variant="openAccess">{t('journal.oa')}</Badge>}
                </div>
            </div>
        </div>
    );
};

const ApcInfoItem = ({ journalName }: { journalName: string }) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(journalName)}+article+processing+charge`;
    const { t } = useTranslation();

    return (
        <div className="flex items-start">
            <DollarSign className="h-5 w-5 text-accent mr-3 mt-1 shrink-0" />
            <div>
                <p className="text-sm font-medium text-muted-foreground">{t('journal.apc')}</p>
                 <a 
                    href={searchUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                    {t('journal.googleSearch')} <Search className="h-4 w-4"/>
                </a>
            </div>
        </div>
    );
};

const formatIssn = (issn: string) => formatIssnDisplay(issn);

export default function JournalDetail({ journal, onBack, onJournalSelect, isHistoryRoot }: JournalDetailProps) {
  const [summaryCache, setSummaryCache] = useState<SummaryCache>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, firestore } = useFirebase();
  const { t, locale } = useTranslation();
  const { currentEditionId, editions } = useEdition();
  const { partition, description, hasPartition } = usePartitionTerminology();
  const [isFavoritesDialogOpen, setIsFavoritesDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const journalId = getPrimaryIssn(journal.issn);
  const showHistoryButton = journalHasMultiEditionHistory(editions, journalId);
  const cacheKey = summaryCacheKey(journal.issn, locale);
  const summaryInfo = summaryCache[cacheKey];

  const favoritesQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, `users/${user.uid}/favorite_journals`),
            where("journalId", "==", journalId)
          )
        : null,
    [user, firestore, journalId]
  );

  const { data: favoriteEntries, isLoading: isFavoriteLoading } = useCollection(favoritesQuery);

  const isFavorited = favoriteEntries ? favoriteEntries.length > 0 : false;

  useEffect(() => {
    if (!journal) return;

    if (summaryCache[cacheKey]) {
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getSummary(journal, locale, currentEditionId)
      .then((result) => {
        if (cancelled) return;
        setSummaryCache((prev) => ({ ...prev, [cacheKey]: result }));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(t("journal.summaryError"));
        console.error(e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [journal, locale, currentEditionId, cacheKey, t]);

  const handleFavoriteClick = () => {
    if (!user) {
        // Optionally, trigger login dialog here
        return;
    }
    setIsFavoritesDialogOpen(true);
  };


  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onBack} 
          aria-label={t('journal.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3 justify-between">
          <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight min-w-0">
            {journal.journalName}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {showHistoryButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
              >
                <LineChart className="mr-2 h-4 w-4" />
                {t("journal.viewHistory")}
              </Button>
            )}
            {user && (
              <>
                <Button
                  variant={isFavorited ? "default" : "outline"}
                  size="icon"
                  onClick={handleFavoriteClick}
                  disabled={isFavoriteLoading}
                  aria-label={t('journal.favorite')}
                >
                  <Heart className={`h-5 w-5 ${isFavorited ? "fill-current" : ""}`} />
                </Button>
                <AddToFavoritesDialog
                  open={isFavoritesDialogOpen}
                  onOpenChange={setIsFavoritesDialogOpen}
                  journal={journal}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <JournalHistoryDialog
        journal={journal}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />

      <div className="space-y-6">
        <div className={`grid grid-cols-1 ${hasPartition ? "lg:grid-cols-3" : ""} gap-6`}>
            <Card className={hasPartition ? "lg:col-span-1" : ""}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                        <BookOpen className="text-primary"/>
                        {t('journal.basicInfo')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <InfoItem icon={CalendarDays} label={t('journal.year')} value={journal.year} />
                    <InfoItem icon={Barcode} label="ISSN/EISSN" value={formatIssn(journal.issn)} />
                    <InfoItem icon={BookCopy} label={t('journal.review')} value={journal.review === '是' ? t('yes') : t('no')} />
                    <InfoItem icon={BookMarked} label="Web of Science" value={journal.webOfScience} />
                    <InfoItem icon={TrendingUp} label={t('journal.impactFactor')} value={formatImpactFactor(journal.impactFactor)} />
                    <InfoItem icon={Globe} label={t('journal.openAccess')} value={journal.openAccess === '是' ? t('yes') : t('no')} isOA={journal.openAccess === '是'} />
                    {journal.openAccess === '是' && <ApcInfoItem journalName={journal.journalName} />}
                </CardContent>
            </Card>
            
            {hasPartition && (
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                        <Award className="text-primary"/>
                        {partition}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <CasPartitionDisplay journal={journal} />
                </CardContent>
            </Card>
            )}
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-headline">
                    <Bot className="text-primary"/>
                    {t('journal.aiSummary')}
                </CardTitle>
                <CardDescription className="pt-2">{t('journal.aiDisclaimer')}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && !summaryInfo && (
                  <div className="space-y-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                  </div>
                )}
                {error && <p className="text-destructive">{error}</p>}
                {!isLoading && !error && summaryInfo?.summary && (
                  <ContentBlockRenderer blocks={summaryInfo.summary} />
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-headline">
                    <BookCopy className="text-primary"/>
                    {t('journal.relatedJournals')}
                </CardTitle>
                <CardDescription>{t('journal.relatedDisclaimer')}</CardDescription>
            </CardHeader>
            <CardContent>
                <RelatedJournals
                    relatedJournals={summaryInfo?.relatedJournals ?? null}
                    isLoading={isLoading && !summaryInfo}
                    error={error}
                    onJournalSelect={onJournalSelect}
                />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
