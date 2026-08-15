
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
import { User, verifyBeforeUpdateEmail } from 'firebase/auth';

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

const formSchema = (t: (key: string) => string) => z.object({
  newEmail: z.string().email({ message: t('auth.changeEmail.invalidEmail') }),
});

type FormValues = z.infer<ReturnType<typeof formSchema>>;

export default function ChangeEmailDialog({ open, onOpenChange, user }: ChangeEmailDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema(t)),
    defaultValues: {
        newEmail: "",
    },
  });

  const handleChangeEmail = async (data: FormValues) => {
    setIsUpdating(true);
    try {
      await verifyBeforeUpdateEmail(user, data.newEmail);
      toast({
        title: t('auth.changeEmail.successTitle'),
        description: t('auth.changeEmail.successDescription', { email: data.newEmail }),
      });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({
        variant: 'destructive',
        title: t('auth.changeEmail.errorTitle'),
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.changeEmail.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.changeEmail.description', { email: user.email! })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleChangeEmail)} className="space-y-4 py-4">
                <FormField
                    control={form.control}
                    name="newEmail"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('auth.changeEmail.newEmailLabel')}</FormLabel>
                        <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isUpdating}>{t('common.cancel')}</Button>
                    <Button type="submit" disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.changeEmail.submitButton')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
