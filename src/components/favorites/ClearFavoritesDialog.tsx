
"use client";

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/provider';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { writeBatch, collection, query, getDocs } from 'firebase/firestore';

interface ClearFavoritesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClearFavoritesDialog({ open, onOpenChange }: ClearFavoritesDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, firestore } = useFirebase();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClearAll = async () => {
    if (!user || !firestore) return;

    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);

      // 1. Get all journal lists
      const listsQuery = query(collection(firestore, `users/${user.uid}/journal_lists`));
      const listsSnapshot = await getDocs(listsQuery);
      listsSnapshot.forEach((doc) => batch.delete(doc.ref));

      // 2. Get all favorite journals
      const favoritesQuery = query(collection(firestore, `users/${user.uid}/favorite_journals`));
      const favoritesSnapshot = await getDocs(favoritesQuery);
      favoritesSnapshot.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();

      toast({
        title: t('favorites.clearAll.successTitle'),
        description: t('favorites.clearAll.successDescription'),
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error clearing all favorites:", error);
      toast({
        variant: 'destructive',
        title: t('favorites.clearAll.errorTitle'),
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('favorites.clearAll.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('favorites.clearAll.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            asChild
            disabled={isDeleting}
            onClick={handleClearAll}
          >
            <Button variant="destructive">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('favorites.clearAll.confirmButton')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
