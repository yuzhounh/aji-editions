
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/provider';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { isDuplicateListName } from '@/lib/favorites-csv';

interface RenameJournalListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listName: string;
  existingListNames?: string[];
}

export default function RenameJournalListDialog({
  open,
  onOpenChange,
  listId,
  listName,
  existingListNames = [],
}: RenameJournalListDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, firestore } = useFirebase();
  const [newName, setNewName] = useState(listName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !firestore || !listId || !newName.trim()) return;

    const trimmedName = newName.trim();
    if (isDuplicateListName(trimmedName, existingListNames, listName)) {
      toast({
        variant: 'destructive',
        title: t('favorites.renameList.errorTitle'),
        description: t('favorites.duplicateListName'),
      });
      return;
    }

    setIsSaving(true);

    try {
      const listRef = doc(firestore, `users/${user.uid}/journal_lists`, listId);
      await updateDoc(listRef, { name: trimmedName });
      onOpenChange(false);
      toast({
        title: t('favorites.renameList.successTitle'),
        description: t('favorites.renameList.successDescription', { listName: trimmedName }),
      });
    } catch (error: any) {
      console.error("Error renaming list:", error);
      toast({
        variant: 'destructive',
        title: t('favorites.renameList.errorTitle'),
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('favorites.renameList.title')}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('favorites.dialog.newListPlaceholder')}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-w-[100px]">{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!newName.trim() || isSaving} className="min-w-[100px]">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('favorites.dialog.saveButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
