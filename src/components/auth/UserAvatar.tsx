
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
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { LanguageToggle } from "@/components/theme/LanguageToggle";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface UserAvatarProps {
  onLoginClick: () => void;
}

export default function UserAvatar({ onLoginClick }: UserAvatarProps) {
  const { user, auth } = useFirebase();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const userInitial = (user?.displayName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full p-0" aria-label={t('auth.accountMenu')}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.photoURL ?? undefined} alt="" />
            <AvatarFallback>{user ? userInitial : <UserIcon aria-hidden="true" />}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-60 max-w-[var(--radix-dropdown-menu-content-available-width)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-xl"
      >
        <DropdownMenuLabel>
          <p className="truncate font-medium">{user ? user.displayName || user.email : t('preferences.guest')}</p>
          {user?.displayName && user.email && (
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <LanguageToggle />
        <ThemeToggle />
        <DropdownMenuSeparator />
        {user ? (
          <DropdownMenuItem onClick={handleSignOut} className="min-h-10 cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('auth.logout')}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onLoginClick} className="min-h-10 cursor-pointer">
            <LogIn className="mr-2 h-4 w-4" />
            <span>{t('auth.login')}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
