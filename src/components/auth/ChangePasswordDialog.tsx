
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/provider';
import { useToast } from '@/hooks/use-toast';
import { User, sendPasswordResetEmail, Auth } from 'firebase/auth';
import { useAuth } from '@/firebase';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

export default function ChangePasswordDialog({ open, onOpenChange, user }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const auth = useAuth();
  const [isSending, setIsSending] = useState(false);

  const handleSendResetEmail = async () => {
    if (!user.email) {
        toast({
            variant: 'destructive',
            title: t('auth.changePassword.errorTitle'),
            description: t('auth.changePassword.noEmailError'),
        });
        return;
    }
    
    setIsSending(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: t('auth.reset.successTitle'),
        description: t('auth.changePassword.successDescription', { email: user.email }),
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      toast({
        variant: 'destructive',
        title: t('auth.changePassword.errorTitle'),
        description: error.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.changePassword.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.changePassword.description', { email: user.email! })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSending}>{t('common.cancel')}</Button>
            <Button type="button" onClick={handleSendResetEmail} disabled={isSending}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.changePassword.submitButton')}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
