"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/i18n/provider"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const { t } = useTranslation()
  const isDark = resolvedTheme === "dark"
  const Icon = isDark ? Moon : Sun

  return (
    <DropdownMenuItem
      className="min-h-10 cursor-pointer"
      onSelect={(event) => {
        event.preventDefault()
        setTheme(isDark ? "light" : "dark")
      }}
    >
      <Icon className="text-muted-foreground" />
      <span>{t("preferences.theme")}</span>
      <span className="ml-auto text-muted-foreground">
        {t(isDark ? "preferences.dark" : "preferences.light")}
      </span>
    </DropdownMenuItem>
  )
}
