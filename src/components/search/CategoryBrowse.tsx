"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/i18n/provider";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import { getMajorCategoryName } from "@/i18n/categories";
import { getCategoryMeta } from "@/lib/category-meta";
import { cn } from "@/lib/utils";

interface CategoryBrowseProps {
  categories: [string, number][];
  onCategorySelect: (category: string) => void;
}

export default function CategoryBrowse({ categories, onCategorySelect }: CategoryBrowseProps) {
  const { t, locale } = useTranslation();
  const { browseSubtitle } = usePartitionTerminology();

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="space-y-2">
        <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight">
          {t("categories.browseTitle")}
        </h2>
        <p className="text-muted-foreground">{browseSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {categories.map(([category, count]) => {
          const meta = getCategoryMeta(category);
          const Icon = meta.icon;
          const name = getMajorCategoryName(category, locale);

          return (
            <Card
              key={category}
              className="cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:ring-primary/30 group h-full"
              onClick={() => onCategorySelect(category)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                      meta.bgClass
                    )}
                  >
                    <Icon className={cn("h-5 w-5", meta.accentClass)} />
                  </div>
                  <p
                    className="font-headline text-base md:text-lg font-semibold leading-snug line-clamp-2 pt-1.5"
                    title={name}
                  >
                    {name}
                  </p>
                </div>
                <p className="mt-2 pl-[52px] text-sm text-muted-foreground">
                  <span className="tabular-nums">{count}</span> {t("categories.journals")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
