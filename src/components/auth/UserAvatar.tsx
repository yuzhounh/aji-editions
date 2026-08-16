
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { LogIn, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/i18n/provider";
import ClearFavoritesDialog from "../favorites/ClearFavoritesDialog";

interface UserAvatarProps {
  onLoginClick: () => void;
}

export default function UserAvatar({ onLoginClick }: UserAvatarProps) {
  const { user, auth } = useFirebase();
  const { t } = useTranslation();
  const [isClearFavoritesDialogOpen, setIsClearFavoritesDialogOpen] = useState(false);

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={onLoginClick}>
        <LogIn className="mr-2 h-4 w-4" />
        {t('auth.login')}
      </Button>
    );
  }

  const getInitial = () => {
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "?";
  };
  const userInitial = getInitial();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full p-0"
            aria-label={t('auth.accountMenu')}
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <p className="font-medium">{user.displayName || "User"}</p>
            <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsClearFavoritesDialogOpen(true)}
            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>{t('favorites.clearAll.menuItem')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('auth.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ClearFavoritesDialog
        open={isClearFavoritesDialogOpen}
        onOpenChange={setIsClearFavoritesDialogOpen}
      />
    </>
  );
}
