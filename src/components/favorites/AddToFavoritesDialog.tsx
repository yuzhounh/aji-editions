
"use client";

import { useState, useEffect } from "react";
import { useFirebase } from "@/firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, WithId } from "@/firebase/firestore/use-collection";
import {
  collection,
  query,
  orderBy,
  doc,
  writeBatch,
  serverTimestamp,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { useMemoFirebase } from "@/firebase/provider";
import { Journal } from "@/data/journals";
import { JournalList } from "./FavoritesContent";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { toast } from "@/hooks/use-toast";

interface AddToFavoritesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journal: Journal;
  mode?: 'add' | 'move';
  batchJournals?: Journal[];
  currentListId?: string;
  onSuccess?: () => void;
}

export default function AddToFavoritesDialog({
  open,
  onOpenChange,
  journal,
  mode = 'add',
  batchJournals = [],
  currentListId,
  onSuccess,
}: AddToFavoritesDialogProps) {
  const { user, firestore } = useFirebase();
  const { t } = useTranslation();
  const [newList, setNewList] = useState("");
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isBatchOperation = batchJournals.length > 0;
  const journalsToProcess = isBatchOperation ? batchJournals : [journal];
  const journalIdsToProcess = journalsToProcess.map(j => j.issn.split('/')[0]);

  const journalListsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, `users/${user.uid}/journal_lists`),
            orderBy("name", "asc")
          )
        : null,
    [user, firestore]
  );
  const { data: journalLists, setData: setJournalLists } = useCollection<JournalList>(journalListsQuery);
  
  const favoritedInQuery = useMemoFirebase(
    () =>
      user && firestore && !isBatchOperation
        ? query(
            collection(firestore, `users/${user.uid}/favorite_journals`),
            where("journalId", "==", journal.issn.split('/')[0])
          )
        : null,
    [user, firestore, journal, isBatchOperation]
  );
  const { data: favoritedIn, isLoading: isLoadingFavorites } = useCollection<{listId: string}>(favoritedInQuery);

  useEffect(() => {
    if (!open) return;
    
    if (mode === 'move' || isBatchOperation) {
        // For batch operations or move, start with no lists selected.
        setSelectedLists(new Set());
    } else if (favoritedIn) {
        // For single add, pre-select the lists the journal is already in.
        const listIds = new Set(favoritedIn.map((fav) => fav.listId).filter(Boolean));
        setSelectedLists(listIds);
    }
  }, [favoritedIn, mode, isBatchOperation, open]);

  const handleCreateNewList = async () => {
    if (!newList.trim() || !user || !firestore) return;
    setIsCreating(true);

    const listName = newList.trim();
    const tempId = `temp_${Date.now()}`;
    const newListData = {
      name: listName,
      userId: user.uid,
      createdAt: new Date(), 
    };

    // Optimistic UI update
    setJournalLists(prev => [...(prev || []), { ...newListData, id: tempId }]);
    setSelectedLists(prev => new Set(prev).add(tempId));
    setNewList("");
    
    try {
      const docRef = await addDoc(collection(firestore, `users/${user.uid}/journal_lists`), {
          ...newListData,
          createdAt: serverTimestamp(),
      });

      // Replace temp ID with real ID from Firestore
      setJournalLists(prev => (prev || []).map(list => list.id === tempId ? { ...list, id: docRef.id } : list));
      setSelectedLists(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          newSet.add(docRef.id);
          return newSet;
      });

    } catch (error) {
      console.error("Error creating new list:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not create the new list.",
      });
      // Rollback optimistic update on error
      setJournalLists(prev => (prev || []).filter(list => list.id !== tempId));
      setSelectedLists(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !firestore || selectedLists.size === 0) return;
    
    setIsSaving(true);
    onOpenChange(false); // Optimistic UI update: close dialog immediately

    // Show optimistic toast
    toast({
        title: isBatchOperation ? t('batchEdit.add.successTitle') : t('favorites.dialog.saveSuccessTitle'),
        description: isBatchOperation ? t('batchEdit.add.successDescription', {count: batchJournals.length}) : t('favorites.dialog.saveSuccessDescription'),
    });
    
    onSuccess?.();

    const performSave = async () => {
        try {
            const batch = writeBatch(firestore);

            for (const journalId of journalIdsToProcess) {
                // If moving, delete from the old list first.
                if (mode === 'move' && currentListId) {
                    const oldFavQuery = query(
                        collection(firestore, `users/${user.uid}/favorite_journals`),
                        where('journalId', '==', journalId),
                        where('listId', '==', currentListId)
                    );
                    const oldFavs = await getDocs(oldFavQuery);
                    oldFavs.forEach(doc => batch.delete(doc.ref));
                }

                // Add to all newly selected lists.
                selectedLists.forEach(listId => {
                    const favoriteId = `${journalId}_${listId}`;
                    const favoriteRef = doc(firestore, `users/${user.uid}/favorite_journals`, favoriteId);
                    batch.set(favoriteRef, {
                        journalId: journalId,
                        userId: user.uid,
                        listId: listId,
                        createdAt: serverTimestamp(),
                    });
                });

                // For single-journal "add/edit" (not batch add/move).
                if (!isBatchOperation && mode === 'add') {
                    const favsQuery = query(collection(firestore, `users/${user.uid}/favorite_journals`), where('journalId', '==', journalId));
                    const existingFavsSnapshot = await getDocs(favsQuery);
                    const initialListIds = new Set(existingFavsSnapshot.docs.map(doc => doc.data().listId).filter(Boolean));

                    // Remove from lists that are no longer selected.
                    const listsToRemove = new Set([...initialListIds].filter(id => !selectedLists.has(id)));
                    existingFavsSnapshot.docs.forEach(doc => {
                        const listId = doc.data().listId;
                        if (listId && listsToRemove.has(listId)) {
                            batch.delete(doc.ref);
                        }
                    });
                }
            }
            
            await batch.commit();

        } catch (error) {
            console.error("Error updating favorites:", error);
            // Show error toast if background operation fails
            toast({
              variant: "destructive",
              title: t('common.error'),
              description: isBatchOperation ? t('batchEdit.add.errorDescription') : t('favorites.dialog.saveErrorDescription'),
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    performSave();
  };

  const onCheckedChange = (checked: boolean | "indeterminate", listId: string) => {
    setSelectedLists(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(listId);
        } else {
            newSet.delete(listId);
        }
        return newSet;
    });
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCreateNewList();
    }
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveChanges();
    }
  };
  
  const getDialogTitle = () => {
    if (!isBatchOperation) {
        return t('favorites.dialog.title');
    }
    if (mode === 'move') {
        return t('batchEdit.move.title', { count: batchJournals.length });
    }
    return t('batchEdit.add.title', { count: batchJournals.length });
  }
  
  const getButtonText = () => {
    if (mode === 'move') {
        return t('batchEdit.move.button');
    }
    if (isBatchOperation) {
        return t('batchEdit.add.button');
    }
    return t('favorites.dialog.saveButton');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="flex gap-2">
                <Input
                    placeholder={t('favorites.dialog.newListPlaceholder')}
                    value={newList}
                    onChange={(e) => setNewList(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    disabled={isCreating}
                />
                <Button onClick={handleCreateNewList} disabled={!newList.trim() || isCreating} className="min-w-[100px]">
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('favorites.dialog.createButton')}
                </Button>
            </div>

            <ScrollArea className="h-40 rounded-md border">
                <div 
                  className="p-2 space-y-2"
                  onKeyDown={handleListKeyDown}
                >
                {(journalLists || []).map((list: WithId<JournalList>) => (
                    <label 
                        key={list.id} 
                        htmlFor={list.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer"
                    >
                        <Checkbox
                            id={list.id}
                            checked={selectedLists.has(list.id)}
                            onCheckedChange={(checked) => onCheckedChange(checked, list.id)}
                            disabled={isLoadingFavorites || (mode === 'move' && list.id === currentListId)}
                        />
                        <span className="text-sm font-medium leading-none">
                            {list.name}
                        </span>
                    </label>
                ))}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-w-[100px]">{t('common.cancel')}</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving || selectedLists.size === 0} className="min-w-[100px]">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
