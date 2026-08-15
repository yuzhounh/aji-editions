"use client";

import { CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEdition } from "@/contexts/EditionContext";
import { useTranslation } from "@/i18n/provider";
import { getEditionDisplayLabel } from "@/lib/edition-label";
import { cn } from "@/lib/utils";

type EditionSwitcherProps = {
  className?: string;
  compact?: boolean;
};

function EditionOption({
  edition,
  locale,
  compact = false,
  showSubtitle = true,
}: {
  edition: {
    label: { zh: string; en: string };
    impactFactorYear: number;
    partitionYear: number;
    partitionType: "cas" | "xr";
  };
  locale: "zh" | "en";
  compact?: boolean;
  showSubtitle?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start",
        compact ? "gap-0 leading-none" : "gap-0.5 leading-tight"
      )}
    >
      <span
        className={cn(
          compact && !showSubtitle
            ? "text-sm font-medium leading-none"
            : compact
              ? "text-xs font-medium"
              : "font-medium"
        )}
      >
        {locale === "zh" ? edition.label.zh : edition.label.en}
      </span>
      {showSubtitle && (
        <span
          className={cn(
            "text-muted-foreground",
            compact ? "text-[10px] leading-none" : "text-xs"
          )}
        >
          {getEditionDisplayLabel(edition)}
        </span>
      )}
    </div>
  );
}

export default function EditionSwitcher({
  className,
  compact = false,
}: EditionSwitcherProps) {
  const { editions, currentEditionId, setEditionId } = useEdition();
  const { locale, t } = useTranslation();
  const currentEdition = editions.find((edition) => edition.id === currentEditionId);

  return (
    <Select value={currentEditionId} onValueChange={setEditionId}>
      <SelectTrigger
        className={cn(
          "h-10 gap-1.5 border-border/70 bg-background/80 px-2.5 py-0",
          compact ? "w-[136px]" : "w-[142px] sm:w-[158px]",
          className
        )}
        aria-label={t("edition.switcherLabel")}
      >
        <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue asChild>
          {currentEdition ? (
            <div className="flex min-w-0 flex-1 items-center overflow-hidden text-left">
              <EditionOption
                edition={currentEdition}
                locale={locale}
                compact
                showSubtitle={false}
              />
            </div>
          ) : (
            <span />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {editions.map((edition) => (
          <SelectItem
            key={edition.id}
            value={edition.id}
            className="pl-2 pr-2 [&>span:first-child]:hidden"
          >
            <EditionOption edition={edition} locale={locale} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
