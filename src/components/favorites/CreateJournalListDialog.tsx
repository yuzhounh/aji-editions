
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/provider';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface CreateJournalListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateJournalListDialog({ open, onOpenChange }: CreateJournalListDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, firestore } = useFirebase();
  const [listName, setListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    if (!user || !firestore || !listName.trim()) return;

    setIsCreating(true);
    // Optimistically close dialog and show toast
    onOpenChange(false);
    toast({
      title: t('favorites.createList.successTitle'),
      description: t('favorites.createList.successDescription', { listName: listName.trim() }),
    });
    const finalListName = listName.trim();
    setListName('');

    const performCreate = async () => {
        try {
          await addDoc(collection(firestore, `users/${user.uid}/journal_lists`), {
            name: finalListName,
            userId: user.uid,
            createdAt: serverTimestamp(),
          });
        } catch (error: any) {
          console.error("Error creating new list:", error);
          toast({
            variant: 'destructive',
            title: t('favorites.createList.errorTitle'),
            description: error.message,
          });
        } finally {
          setIsCreating(false);
        }
    }
    
    performCreate();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('favorites.createList.title')}</DialogTitle>
          <DialogDescription>
            {t('favorites.createList.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('favorites.dialog.newListPlaceholder')}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>{t('common.cancel')}</Button>
          <Button onClick={handleCreate} disabled={!listName.trim() || isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('favorites.dialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
