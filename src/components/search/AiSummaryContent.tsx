
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
  Sparkles,
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
import AddToFavoritesDialog from "../favorites/AddToFavoritesDialog";
import { collection, query, where, or } from 'firebase/firestore';
import { Skeleton } from "../ui/skeleton";

interface JournalDetailProps {
  journal: Journal;
  onBack: () => void;
  onJournalSelect: (journalName: string) => void;
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

const formatIssn = (issn: string) => {
    const parts = issn.split('/');
    if (parts.length > 1) {
        return <>{parts[0]}/<wbr/>{parts.slice(1).join('/')}</>;
    }
    return issn;
};

export default function JournalDetail({ journal, onBack, onJournalSelect }: JournalDetailProps) {
  const [showAiAnalysis, setShowAiAnalysis] = useState<boolean>(false);
  const [summaryInfo, setSummaryInfo] = useState<JournalSummaryInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user, firestore } = useFirebase();
  const { t, locale } = useTranslation();
  const { currentEditionId } = useEdition();
  const { partition, description } = usePartitionTerminology();
  const [isFavoritesDialogOpen, setIsFavoritesDialogOpen] = useState(false);

  const journalId = journal.issn.split('/')[0];

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

  // Reset AI state when journal changes
  useEffect(() => {
    setShowAiAnalysis(false);
    setSummaryInfo(null);
    setIsLoading(false);
    setError(null);
  }, [journal]);

  const handleGenerateSummary = async () => {
    if (!journal) return;
    setShowAiAnalysis(true);
    setIsLoading(true);
    setError(null);
    try {
      const result: JournalSummaryInfo = await getSummary(journal, locale, currentEditionId);
      setSummaryInfo(result);
    } catch (e) {
      setError(t('journal.summaryError'));
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

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
        <Button variant="outline" size="icon" onClick={onBack} aria-label={t('journal.back')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-grow flex items-center gap-4 justify-between">
          <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight">{journal.journalName}</h2>
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

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
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
        </div>
        
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                        <Bot className="text-primary"/>
                        {t('journal.aiSummary')}
                    </CardTitle>
                    {!showAiAnalysis && (
                        <Button
                          onClick={handleGenerateSummary}
                          className="bg-primary/10 text-primary hover:bg-primary/20"
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {t('journal.generateAnalysis')}
                        </Button>
                    )}
                </div>
                 {showAiAnalysis && (
                    <CardDescription className="pt-2">{t('journal.aiDisclaimer')}</CardDescription>
                )}
            </CardHeader>
            {showAiAnalysis && (
              <CardContent>
                  {isLoading && (
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
            )}
        </Card>

        {showAiAnalysis && (
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
                        isLoading={isLoading}
                        error={error}
                        onJournalSelect={onJournalSelect}
                    />
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
