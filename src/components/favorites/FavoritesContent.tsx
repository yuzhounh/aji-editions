

"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useFirebase } from "@/firebase";
import { WithId } from "@/firebase/firestore/use-collection";
import { collection, doc, serverTimestamp, addDoc, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Journal } from "@/data/journals";
import { useTranslation } from "@/i18n/provider";
import { BookText, LogIn, Pencil, Trash2, Upload, FolderPlus, Search, Download } from "lucide-react";
import CategoryStats from "../search/CategoryStats";
import DeleteJournalListDialog from "./DeleteJournalListDialog";
import RenameJournalListDialog from "./RenameJournalListDialog";
import CreateJournalListDialog from "./CreateJournalListDialog";
import ClearFavoritesDialog from "./ClearFavoritesDialog";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { getPrimaryIssn } from "@/lib/issn";
import { ChunkedWriteBatch } from "@/lib/firestore-batch";
import { triggerCsvDownload } from "@/lib/csv-download";
import {
  buildJournalExportRow,
  buildJournalExportHeaders,
  deriveListNameFromFilename,
  groupImportRowsByListName,
  resolveUniqueListName,
  sanitizeCsvFilename,
  type ParsedImportRow,
} from "@/lib/favorites-csv";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";

export type JournalList = {
    name: string;
    userId: string;
};

type FavoriteJournalEntry = {
    journalId: string;
    listId?: string;
};


interface FavoritesContentProps {
    onJournalListSelect: (list: WithId<JournalList>) => void;
    allFavorites: WithId<FavoriteJournalEntry>[] | null;
    journalLists: WithId<JournalList>[] | null;
    isLoadingLists: boolean;
    onFindJournalsClick: () => void;
    onLoginClick: () => void;
    journals: Journal[];
}

export default function FavoritesContent({ onJournalListSelect, allFavorites, journalLists, isLoadingLists, onFindJournalsClick, onLoginClick, journals }: FavoritesContentProps) {
    const { user, isUserLoading, firestore } = useFirebase();
    const { t, locale } = useTranslation();
    const { toast } = useToast();
    const { exportPartitionHeader, hasPartition } = usePartitionTerminology();
    const [deleteDialogState, setDeleteDialogState] = useState<{open: boolean, listId: string, listName: string}>({open: false, listId: '', listName: ''});
    const [renameDialogState, setRenameDialogState] = useState<{open: boolean, listId: string, listName: string}>({open: false, listId: '', listName: ''});
    const [isCreateListDialogOpen, setIsCreateListDialogOpen] = useState(false);
    const [isClearFavoritesDialogOpen, setIsClearFavoritesDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [journalsForStats, setJournalsForStats] = useState<Journal[]>([]);

    const journalMapByIssn = useMemo(
        () => new Map(journals.map((j) => [getPrimaryIssn(j.issn), j])),
        [journals]
    );

    const listCounts = useMemo(() => {
        const total: Record<string, number> = {};
        const available: Record<string, number> = {};

        if (!allFavorites) {
            return { total, available };
        }

        allFavorites.forEach((fav) => {
            if (!fav.listId?.trim()) return;
            total[fav.listId] = (total[fav.listId] || 0) + 1;
            if (journalMapByIssn.has(fav.journalId)) {
                available[fav.listId] = (available[fav.listId] || 0) + 1;
            }
        });

        return { total, available };
    }, [allFavorites, journalMapByIssn]);
    
    useEffect(() => {
        if (!allFavorites) {
            setJournalsForStats([]);
            return;
        }

        if (allFavorites.length === 0) {
            setJournalsForStats([]);
        } else {
            const uniqueJournalIds = new Set<string>();
            allFavorites.forEach(fav => {
                uniqueJournalIds.add(fav.journalId);
            });
            const statsJournals = Array.from(uniqueJournalIds)
                .map(id => journalMapByIssn.get(id))
                .filter((j): j is Journal => !!j);
            setJournalsForStats(statsJournals);
        }
    }, [allFavorites, journalMapByIssn]);


    const handleDeleteClick = (e: React.MouseEvent, list: WithId<JournalList>) => {
        e.stopPropagation(); 
        setDeleteDialogState({ open: true, listId: list.id, listName: list.name });
    };

    const handleRenameClick = (e: React.MouseEvent, list: WithId<JournalList>) => {
        e.stopPropagation(); 
        setRenameDialogState({ open: true, listId: list.id, listName: list.name });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const importJournalsIntoList = async (
        listName: string,
        journalIds: string[],
        existingNames: Set<string>
    ): Promise<{ imported: number; skipped: number; listName?: string }> => {
        if (!user || !firestore) return { imported: 0, skipped: 0 };

        const validJournalIds = journalIds.filter((issn) => journalMapByIssn.has(issn));
        const skippedCount = journalIds.length - validJournalIds.length;

        if (validJournalIds.length === 0) {
            return { imported: 0, skipped: skippedCount };
        }

        const resolvedName = resolveUniqueListName(listName, existingNames);
        existingNames.add(resolvedName);

        const listRef = await addDoc(collection(firestore, `users/${user.uid}/journal_lists`), {
            name: resolvedName,
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

        try {
            const batch = new ChunkedWriteBatch(firestore);
            for (const journalId of validJournalIds) {
                const favoriteId = `${journalId}_${listRef.id}`;
                const favoriteRef = doc(firestore, `users/${user.uid}/favorite_journals`, favoriteId);
                await batch.set(favoriteRef, {
                    journalId,
                    userId: user.uid,
                    listId: listRef.id,
                    createdAt: serverTimestamp(),
                });
            }
            await batch.commit();
        } catch (batchError) {
            await deleteDoc(listRef);
            throw batchError;
        }

        return { imported: validJournalIds.length, skipped: skippedCount, listName: resolvedName };
    };

    const handleExportAll = () => {
        if (!journalLists || !allFavorites) return;

        const exportOptions = {
            hasPartition,
            partitionHeader: exportPartitionHeader,
            includeListName: true,
            locale,
        };
        const headers = buildJournalExportHeaders(exportOptions);
        const rows: (string | number)[][] = [headers];

        for (const list of journalLists) {
            const journalIds = allFavorites
                .filter((fav) => fav.listId === list.id)
                .map((fav) => fav.journalId);

            for (const journalId of journalIds) {
                const journal = journalMapByIssn.get(journalId);
                if (!journal) continue;
                rows.push(
                    buildJournalExportRow(journal, {
                        ...exportOptions,
                        listName: list.name,
                    })
                );
            }
        }

        if (rows.length <= 1) {
            toast({
                variant: "destructive",
                title: t("favorites.exportAll.emptyTitle"),
                description: t("favorites.exportAll.emptyDescription"),
            });
            return;
        }

        triggerCsvDownload(rows, `${sanitizeCsvFilename("All-Favorites")}.csv`);
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !firestore) return;

        event.target.value = '';

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const fallbackListName = deriveListNameFromFilename(file.name);
                const groups = groupImportRowsByListName(
                    results.data as ParsedImportRow[],
                    fallbackListName
                );

                if (groups.size === 0) {
                    toast({
                        variant: 'destructive',
                        title: t('favorites.importList.noMatchesTitle'),
                        description: t('favorites.importList.noMatchesDescription'),
                    });
                    return;
                }

                const existingNames = new Set((journalLists || []).map((l) => l.name));
                let totalImported = 0;
                let totalSkipped = 0;
                let listsCreated = 0;
                let lastImportedListName = fallbackListName;

                try {
                    for (const [listName, issnSet] of groups) {
                        const result = await importJournalsIntoList(
                            listName,
                            Array.from(issnSet),
                            existingNames
                        );
                        totalImported += result.imported;
                        totalSkipped += result.skipped;
                        if (result.imported > 0) {
                            listsCreated += 1;
                            if (result.listName) {
                                lastImportedListName = result.listName;
                            }
                        }
                    }

                    if (totalImported === 0) {
                        toast({
                            variant: 'destructive',
                            title: t('favorites.importList.noMatchesTitle'),
                            description: t('favorites.importList.noMatchesDescription'),
                        });
                        return;
                    }

                    toast({
                        title: t('favorites.importList.successTitle'),
                        description:
                            listsCreated > 1
                                ? t('favorites.importList.successDescriptionMulti', {
                                    listCount: listsCreated,
                                    count: totalImported,
                                    skipped: totalSkipped,
                                  })
                                : totalSkipped > 0
                                  ? t('favorites.importList.successDescriptionWithSkipped', {
                                      listName: lastImportedListName,
                                      count: totalImported,
                                      skipped: totalSkipped,
                                    })
                                  : t('favorites.importList.successDescription', {
                                      listName: lastImportedListName,
                                      count: totalImported,
                                    }),
                    });
                } catch (error) {
                    console.error("Error importing list:", error);
                    toast({
                        variant: 'destructive',
                        title: t('favorites.importList.errorTitle'),
                        description: t('favorites.importList.errorDescription'),
                    });
                }
            },
            error: (error) => {
                console.error("CSV parsing error:", error);
                toast({
                    variant: 'destructive',
                    title: t('favorites.importList.errorTitle'),
                    description: t('favorites.importList.errorDescription'),
                });
            }
        });
    };


    if (!user) {
        if (isUserLoading) {
            return (
              <div className="flex justify-center items-center h-64">
                <div className="text-lg">{t('favorites.loading')}</div>
              </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center text-center px-4 py-20 border-2 border-dashed rounded-lg">
                <h2 className="text-2xl font-bold mb-4">{t('favorites.login.title')}</h2>
                <p className="text-muted-foreground mb-6">{t('favorites.login.description')}</p>
                <Button onClick={onLoginClick}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('auth.login')}
                </Button>
            </div>
        );
    }

    if (isLoadingLists && journalLists === null) {
        return (
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">{t('favorites.loading')}</div>
          </div>
        );
    }
    
    const hasContentToShow = (allFavorites && allFavorites.length > 0) || (journalLists && journalLists.length > 0);

    return (
        <div className="animate-in fade-in-50 duration-300">
            {hasContentToShow ? (
                <div className="space-y-8">
                    <CategoryStats journals={journalsForStats} />
                    <div className="flex flex-wrap justify-end gap-4">
                        <Button variant="outline" onClick={() => setIsCreateListDialogOpen(true)}>
                            <FolderPlus className="mr-2 h-4 w-4" />
                            {t('favorites.createList.button')}
                        </Button>
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="mr-2 h-4 w-4" />
                            {t('favorites.importList.button')}
                        </Button>
                        <Button variant="outline" onClick={handleExportAll}>
                            <Download className="mr-2 h-4 w-4" />
                            {t('favorites.exportAll.button')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsClearFavoritesDialogOpen(true)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('favorites.clearAll.button')}
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            accept=".csv"
                            style={{ display: 'none' }}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(journalLists || []).map((list) => (
                           <Card
                            key={list.id}
                            className="group relative cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200 flex flex-col"
                            onClick={() => onJournalListSelect(list)}
                            >
                                <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                        onClick={(e) => handleRenameClick(e, list)}
                                        aria-label={t('favorites.renameList.ariaLabel', { listName: list.name })}
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        onClick={(e) => handleDeleteClick(e, list)}
                                        aria-label={t('favorites.deleteList.ariaLabel', { listName: list.name })}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                                <CardHeader className="flex-grow pb-2">
                                    <CardTitle className="font-headline text-xl">
                                    {list.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                    <BookText className="w-4 h-4 mr-2" />
                                    <span>
                                        {(() => {
                                            const total = listCounts.total[list.id] || 0;
                                            const available = listCounts.available[list.id] || 0;
                                            if (total > available && available > 0) {
                                                return t('favorites.listCountPartial', {
                                                    available,
                                                    total,
                                                });
                                            }
                                            return `${available || total} ${t('categories.journals')}`;
                                        })()}
                                    </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 px-4 border-2 border-dashed rounded-lg space-y-6">
                    <div>
                        <h3 className="mt-4 text-lg font-medium text-foreground">{t('favorites.empty.title')}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('favorites.empty.description')}
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center items-center gap-4">
                        <Button onClick={onFindJournalsClick}>
                            <Search className="mr-2 h-4 w-4" />
                            {t('favorites.empty.button')}
                        </Button>
                        <Button variant="outline" onClick={() => setIsCreateListDialogOpen(true)}>
                            <FolderPlus className="mr-2 h-4 w-4" />
                            {t('favorites.createList.button')}
                        </Button>
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="mr-2 h-4 w-4" />
                            {t('favorites.importList.button')}
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            accept=".csv"
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>
            )}
            {deleteDialogState.open && (
                <DeleteJournalListDialog
                    open={deleteDialogState.open}
                    onOpenChange={(open) => setDeleteDialogState({ ...deleteDialogState, open })}
                    listId={deleteDialogState.listId}
                    listName={deleteDialogState.listName}
                />
            )}
            {renameDialogState.open && (
                <RenameJournalListDialog
                    open={renameDialogState.open}
                    onOpenChange={(open) => setRenameDialogState({ ...renameDialogState, open })}
                    listId={renameDialogState.listId}
                    listName={renameDialogState.listName}
                    existingListNames={(journalLists || [])
                        .filter((list) => list.id !== renameDialogState.listId)
                        .map((list) => list.name)}
                />
            )}
             <CreateJournalListDialog 
                open={isCreateListDialogOpen}
                onOpenChange={setIsCreateListDialogOpen}
                existingListNames={(journalLists || []).map((list) => list.name)}
            />
            <ClearFavoritesDialog
                open={isClearFavoritesDialogOpen}
                onOpenChange={setIsClearFavoritesDialogOpen}
            />
        </div>
    );
}
