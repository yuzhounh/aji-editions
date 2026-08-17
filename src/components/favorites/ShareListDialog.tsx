"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, Check } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { createSharedList, getShareUrl } from "@/lib/shared-list";

interface ShareListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listName: string;
  journalIds: string[];
  sourceEditionId: string;
  sourceEditionLabel: string;
}

export default function ShareListDialog({
  open,
  onOpenChange,
  listName,
  journalIds,
  sourceEditionId,
  sourceEditionLabel,
}: ShareListDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, firestore } = useFirebase();
  const [shareUrl, setShareUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setShareUrl("");
      setCopied(false);
      return;
    }

    if (!user || !firestore || journalIds.length === 0) return;

    let cancelled = false;
    setIsCreating(true);

    createSharedList(firestore, user.uid, {
      listName,
      journalIds,
      sourceEditionId,
      sourceEditionLabel,
    })
      .then((shareId) => {
        if (!cancelled) {
          setShareUrl(getShareUrl(shareId));
        }
      })
      .catch((error) => {
        console.error("Error creating share link:", error);
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: t("share.create.errorTitle"),
            description: t("share.create.errorDescription"),
          });
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCreating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, user, firestore, listName, journalIds, sourceEditionId, sourceEditionLabel, t, toast, onOpenChange]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: t("share.create.copiedTitle"),
        description: t("share.create.copiedDescription"),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("share.create.copyError"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("share.create.title")}</DialogTitle>
          <DialogDescription>
            {t("share.create.description", { listName, count: journalIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isCreating ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("share.create.generating")}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly aria-label={t("share.create.linkLabel")} />
                <Button type="button" variant="outline" onClick={handleCopy} disabled={!shareUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t("share.create.expiryNote")}</p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
