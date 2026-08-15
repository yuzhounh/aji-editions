
"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/provider';
import { useToast } from '@/hooks/use-toast';
import { User, updateProfile } from 'firebase/auth';

interface ChangeNicknameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

const formSchema = (t: (key: string) => string) => z.object({
  newNickname: z.string().min(2, { message: t('auth.nicknameRequired') }),
});

type FormValues = z.infer<ReturnType<typeof formSchema>>;

export default function ChangeNicknameDialog({ open, onOpenChange, user }: ChangeNicknameDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema(t)),
    defaultValues: {
        newNickname: user.displayName || "",
    },
  });

  const handleChangeNickname = async (data: FormValues) => {
    setIsUpdating(true);
    onOpenChange(false);
    toast({
        title: t('auth.changeNickname.successTitle'),
        description: t('auth.changeNickname.successDescription'),
    });

    const performUpdate = async () => {
        try {
            await updateProfile(user, { displayName: data.newNickname });
        } catch (error: any) {
            console.error("Error updating nickname:", error);
            toast({
                variant: 'destructive',
                title: t('auth.changeNickname.errorTitle'),
                description: error.message,
            });
        } finally {
            setIsUpdating(false);
        }
    };
    
    performUpdate();
  };

  const description = user.displayName
    ? t('auth.changeNickname.description', { nickname: user.displayName })
    : t('auth.changeNickname.noNicknameDescription');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.changeNickname.title')}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleChangeNickname)} className="space-y-4 py-4">
                <FormField
                    control={form.control}
                    name="newNickname"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('auth.changeNickname.newNicknameLabel')}</FormLabel>
                        <FormControl>
                        <Input placeholder={t('auth.nicknamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isUpdating}>{t('common.cancel')}</Button>
                    <Button type="submit" disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.changeNickname.submitButton')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
