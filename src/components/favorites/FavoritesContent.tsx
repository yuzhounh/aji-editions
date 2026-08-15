

"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useFirebase } from "@/firebase";
import { WithId } from "@/firebase/firestore/use-collection";
import { collection, writeBatch, doc, serverTimestamp, addDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Journal } from "@/data/journals";
import { useTranslation } from "@/i18n/provider";
import { BookText, LogIn, Pencil, Trash2, Upload, FolderPlus, Search } from "lucide-react";
import CategoryStats from "../search/CategoryStats";
import DeleteJournalListDialog from "./DeleteJournalListDialog";
import RenameJournalListDialog from "./RenameJournalListDialog";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import CreateJournalListDialog from "./CreateJournalListDialog";

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
    const { t } = useTranslation();
    const { toast } = useToast();
    const [deleteDialogState, setDeleteDialogState] = useState<{open: boolean, listId: string, listName: string}>({open: false, listId: '', listName: ''});
    const [renameDialogState, setRenameDialogState] = useState<{open: boolean, listId: string, listName: string}>({open: false, listId: '', listName: ''});
    const [isCreateListDialogOpen, setIsCreateListDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [journalsForStats, setJournalsForStats] = useState<Journal[]>([]);

    const categorized = useMemo(() => {
        if (!allFavorites || allFavorites.length === 0) {
            return {};
        }

        const categorizedFavorites: Record<string, number> = {};
        
        allFavorites.forEach(fav => {
            if (fav.listId && fav.listId.trim() !== '') {
                categorizedFavorites[fav.listId] = (categorizedFavorites[fav.listId] || 0) + 1;
            }
        });

        return categorizedFavorites;
    }, [allFavorites]);
    
    useEffect(() => {
        if (!allFavorites) {
            setJournalsForStats([]);
            return;
        }

        if (allFavorites.length === 0) {
            setJournalsForStats([]);
        } else {
            const journalMap = new Map(journals.map(j => [j.issn.split('/')[0], j]));
            const uniqueJournalIds = new Set<string>();
            allFavorites.forEach(fav => {
                uniqueJournalIds.add(fav.journalId);
            });
            const statsJournals = Array.from(uniqueJournalIds)
                .map(id => journalMap.get(id))
                .filter((j): j is Journal => !!j);
            setJournalsForStats(statsJournals);
        }
    }, [allFavorites, journals]);


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

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !firestore) return;

        event.target.value = '';

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const importedJournals = results.data as { "ISSN/EISSN": string }[];
                const journalIssns = new Set(importedJournals.map(j => j["ISSN/EISSN"]?.split('/')[0]).filter(Boolean));

                let listName = file.name.replace(/\.csv$/, '').replace(/_/g, ' ');
                const existingNames = new Set((journalLists || []).map(l => l.name));
                if (existingNames.has(listName)) {
                    listName = `${listName} (${new Date().toLocaleDateString()})`;
                }

                try {
                    const journalMapByIssn = new Map(journals.map(j => [j.issn.split('/')[0], j]));
                    const validJournalIds = Array.from(journalIssns).filter(issn => journalMapByIssn.has(issn));
                    
                    const listRef = await addDoc(collection(firestore, `users/${user.uid}/journal_lists`), {
                        name: listName,
                        userId: user.uid,
                        createdAt: serverTimestamp(),
                    });
                    
                    const batch = writeBatch(firestore);
                    validJournalIds.forEach(journalId => {
                        const favoriteId = `${journalId}_${listRef.id}`;
                        const favoriteRef = doc(firestore, `users/${user.uid}/favorite_journals`, favoriteId);
                        batch.set(favoriteRef, {
                            journalId: journalId,
                            userId: user.uid,
                            listId: listRef.id,
                            createdAt: serverTimestamp(),
                        });
                    });
                    await batch.commit();

                    toast({
                        title: t('favorites.importList.successTitle'),
                        description: t('favorites.importList.successDescription', { listName, count: validJournalIds.length }),
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
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                                        {categorized[list.id] || 0} {t('categories.journals')}
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
                />
            )}
             <CreateJournalListDialog 
                open={isCreateListDialogOpen}
                onOpenChange={setIsCreateListDialogOpen}
            />
        </div>
    );
}
