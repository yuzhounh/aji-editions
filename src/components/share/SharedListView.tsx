"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFirebase } from "@/firebase";
import { useEdition } from "@/contexts/EditionContext";
import { useTranslation } from "@/i18n/provider";
import { useToast } from "@/hooks/use-toast";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import { fetchSharedList, importSharedListToUser, type SharedListRecord } from "@/lib/shared-list";
import { getPrimaryIssn } from "@/lib/issn";
import { collection, getDocs } from "firebase/firestore";
import { AjiLogo } from "@/components/brand/AjiLogo";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import JournalListItem from "@/components/search/JournalListItem";
import LoginDialog from "@/components/auth/LoginDialog";
import EditionSwitcher from "@/components/edition/EditionSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/theme/LanguageToggle";
import { Loader2, BookmarkPlus, Home } from "lucide-react";
import type { Journal } from "@/data/journals";

interface SharedListViewProps {
  shareId: string;
}

export default function SharedListView({ shareId }: SharedListViewProps) {
  const { firestore, user } = useFirebase();
  const { journals, isLoading: isEditionLoading } = useEdition();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasPartition } = usePartitionTerminology();

  const [shared, setShared] = useState<SharedListRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not_found" | "revoked" | "expired">("loading");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedListName, setImportedListName] = useState<string | null>(null);
  const importAfterLoginRef = useRef(false);

  useEffect(() => {
    if (!firestore || !shareId) return;

    let cancelled = false;
    setStatus("loading");

    fetchSharedList(firestore, shareId)
      .then(({ data, status: fetchStatus }) => {
        if (cancelled) return;
        setShared(data);
        setStatus(fetchStatus);
      })
      .catch((error) => {
        console.error("Error loading shared list:", error);
        if (!cancelled) {
          setStatus("not_found");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [firestore, shareId]);

  const journalMap = useMemo(
    () => new Map(journals.map((j) => [getPrimaryIssn(j.issn), j])),
    [journals]
  );

  const resolvedJournals = useMemo(() => {
    if (!shared) return [] as Journal[];
    return shared.journalIds
      .map((id) => journalMap.get(id))
      .filter((j): j is Journal => !!j)
      .sort((a, b) => {
        const factorA = typeof a.impactFactor === "number" ? a.impactFactor : 0;
        const factorB = typeof b.impactFactor === "number" ? b.impactFactor : 0;
        return factorB - factorA;
      });
  }, [shared, journalMap]);

  const unavailableCount = shared
    ? Math.max(0, shared.journalCount - resolvedJournals.length)
    : 0;

  const performImport = async () => {
    if (!user || !firestore || !shared || isImporting) return;

    setIsImporting(true);
    try {
      const validJournalIds = shared.journalIds.filter((id) => journalMap.has(id));
      if (validJournalIds.length === 0) {
        toast({
          variant: "destructive",
          title: t("share.import.noMatchesTitle"),
          description: t("share.import.noMatchesDescription"),
        });
        return;
      }

      const listsSnapshot = await getDocs(
        collection(firestore, `users/${user.uid}/journal_lists`)
      );
      const existingListNames = listsSnapshot.docs.map((docSnap) => docSnap.data().name as string);

      const result = await importSharedListToUser(
        firestore,
        user.uid,
        shared,
        validJournalIds,
        existingListNames
      );

      setImportedListName(result.listName);
      toast({
        title: t("share.import.successTitle"),
        description:
          result.skipped > 0
            ? t("share.import.successDescriptionWithSkipped", {
                listName: result.listName,
                count: result.imported,
                skipped: result.skipped,
              })
            : t("share.import.successDescription", {
                listName: result.listName,
                count: result.imported,
              }),
      });
    } catch (error) {
      console.error("Error importing shared list:", error);
      toast({
        variant: "destructive",
        title: t("share.import.errorTitle"),
        description: t("share.import.errorDescription"),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveClick = () => {
    if (importedListName) return;
    if (!user) {
      importAfterLoginRef.current = true;
      setIsLoginOpen(true);
      return;
    }
    void performImport();
  };

  useEffect(() => {
    if (!user || !importAfterLoginRef.current || !shared || status !== "ok" || importedListName) {
      return;
    }
    importAfterLoginRef.current = false;
    setIsLoginOpen(false);
    void performImport();
  }, [user, shared, status, importedListName]);

  const renderBody = () => {
    if (status === "loading" || isEditionLoading) {
      return (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("share.loading")}
        </div>
      );
    }

    if (status === "not_found") {
      return <p className="py-20 text-center text-muted-foreground">{t("share.notFound")}</p>;
    }
    if (status === "revoked") {
      return <p className="py-20 text-center text-muted-foreground">{t("share.revoked")}</p>;
    }
    if (status === "expired") {
      return <p className="py-20 text-center text-muted-foreground">{t("share.expired")}</p>;
    }

    if (!shared) return null;

    return (
      <div className="space-y-6 animate-in fade-in-50 duration-300">
        <div className="space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">{shared.listName}</h1>
          <p className="text-muted-foreground">
            {t("share.meta", {
              count: shared.journalCount,
              edition: shared.sourceEditionLabel,
            })}
          </p>
        </div>

        {unavailableCount > 0 && (
          <Alert>
            <AlertDescription>
              {resolvedJournals.length === 0
                ? t("favorites.unavailableInEditionOnly")
                : t("favorites.unavailableInEdition", { count: unavailableCount })}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {importedListName ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("share.import.alreadySaved", { listName: importedListName })}
              </p>
              <Button asChild variant="outline">
                <Link href="/">{t("share.openFavorites")}</Link>
              </Button>
            </>
          ) : (
            <Button onClick={handleSaveClick} disabled={isImporting || resolvedJournals.length === 0}>
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookmarkPlus className="mr-2 h-4 w-4" />
              )}
              {user ? t("share.saveToFavorites") : t("share.loginToSave")}
            </Button>
          )}
        </div>

        {resolvedJournals.length > 0 ? (
          <div className="space-y-2">
            {resolvedJournals.map((journal) => (
              <JournalListItem
                key={journal.issn}
                journal={journal}
                onClick={() => {}}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-muted-foreground">{t("share.noVisibleJournals")}</p>
        )}

        {!hasPartition && (
          <p className="text-sm text-muted-foreground">{t("edition.jcrOnlyNote")}</p>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="page-shell flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <AjiLogo className="h-8 w-auto" />
            </Link>
            <div className="flex items-center gap-2">
              <EditionSwitcher />
              <LanguageToggle />
              <ThemeToggle />
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  {t("share.backHome")}
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-grow py-8 md:py-10">{renderBody()}</div>
      </div>

      <LoginDialog open={isLoginOpen} onOpenChange={setIsLoginOpen} />
    </>
  );
}
