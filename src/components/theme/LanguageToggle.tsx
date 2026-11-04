"use client"

import { Globe } from "lucide-react"
import { useTranslation } from "@/i18n/provider"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation()

  return (
    <DropdownMenuItem
      className="min-h-10 cursor-pointer"
      onSelect={(event) => {
        event.preventDefault()
        setLocale(locale === "zh" ? "en" : "zh")
      }}
    >
      <Globe className="text-muted-foreground" />
      <span>{t("preferences.language")}</span>
      <span className="ml-auto font-medium text-primary">
        {locale === "zh" ? "简体中文" : "English"}
      </span>
    </DropdownMenuItem>
  )
}
