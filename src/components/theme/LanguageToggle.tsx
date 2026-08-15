"use client"

import * as React from "react"
import { useTranslation } from "@/i18n/provider"
import { Button } from "@/components/ui/button"

export function LanguageToggle() {
  const { locale, setLocale } = useTranslation()

  const toggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh")
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleLocale}
      aria-label={locale === "zh" ? "Switch to English" : "切换为中文"}
    >
      <span className="text-xs font-bold leading-none">
        {locale === "zh" ? "中" : "EN"}
      </span>
    </Button>
  )
}
