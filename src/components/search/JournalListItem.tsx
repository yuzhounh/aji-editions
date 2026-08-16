"use client";

import { type Journal } from "@/data/journals";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Medal, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitIssnDisplay } from "@/lib/issn";
import { useTranslation } from "@/i18n/provider";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import { Checkbox } from "../ui/checkbox";

interface JournalListItemProps {
  journal: Journal;
  onClick: () => void;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

const getPartitionBadgeVariant = (partition: string): "level1" | "level2" | "level3" | "level4" | "secondary" => {
  const mainPartition = partition.charAt(0);
  switch (mainPartition) {
    case "1": return "level1";
    case "2": return "level2";
    case "3": return "level3";
    case "4": return "level4";
    default: return "secondary";
  }
};

const AuthorityBadge = ({ level }: { level: string }) => {
    const { t } = useTranslation();
    let icon;
    let variant: "authority1" | "authority2" | "authority3" | "secondary" = "secondary";
    let levelText = level;
    if (level === "一级") levelText = t('cas.authority.1');
    if (level === "二级") levelText = t('cas.authority.2');
    if (level === "三级") levelText = t('cas.authority.3');

    switch (level) {
        case "一级":
            icon = <Crown className="h-3 w-3" />;
            variant = "authority1";
            break;
        case "二级":
            icon = <Medal className="h-3 w-3" />;
            variant = "authority2";
            break;
        case "三级":
            icon = <Star className="h-3 w-3" />;
            variant = "authority3";
            break;
        default:
            return null;
    }
    return (
        <Badge variant={variant} className="gap-1 pl-1 pr-1.5">
            {icon}
            <span className="text-xs whitespace-nowrap">{levelText}</span>
        </Badge>
    )
}

const formatImpactFactor = (factor: number | string) => {
    const num = Number(factor);
    if (!isNaN(num) && String(factor).trim() !== "" && !String(factor).includes('<')) {
      return num.toFixed(1);
    }
    return factor;
};

const IssnMetadataRow = ({
  issn,
  authorityLevel,
  isOpenAccess,
}: {
  issn: string;
  authorityLevel: string;
  isOpenAccess: boolean;
}) => {
  const { t } = useTranslation();
  const { print, electronic } = splitIssnDisplay(issn);

  return (
    <div className="mt-1.5 flex flex-nowrap items-center gap-x-1 text-xs md:text-sm text-muted-foreground">
      <span className="inline-block w-[9ch] shrink-0 text-right font-code tabular-nums">
        {print}
      </span>
      <span className="shrink-0 font-code text-muted-foreground/60">/</span>
      <span className="inline-block w-[9ch] shrink-0 font-code tabular-nums">
        {electronic}
      </span>
      <div className="flex shrink-0 items-center gap-1.5 pl-1">
        <AuthorityBadge level={authorityLevel} />
        {isOpenAccess && <Badge variant="openAccess">{t("journal.oa")}</Badge>}
      </div>
    </div>
  );
};

export default function JournalListItem({ journal, onClick, isEditing, isSelected, onSelectionChange }: JournalListItemProps) {
  const { t, locale } = useTranslation();
  const { partitionShort, hasPartition } = usePartitionTerminology();

  const getPartitionText = (partition: string) => {
    if (locale === 'zh') {
        const mainPartition = partition.charAt(0);
        switch (mainPartition) {
            case '1': return t('cas.partitions.1');
            case '2': return t('cas.partitions.2');
            case '3': return t('cas.partitions.3');
            case '4': return t('cas.partitions.4');
            default: return partition;
        }
    }
    const match = partition.match(/(\d+)/);
    return match ? `Q${match[1]}` : partition;
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) {
        if (e.target instanceof HTMLInputElement) return;
        onSelectionChange?.(!isSelected);
    } else {
        onClick();
    }
};

  return (
    <Card
      className={cn("cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:ring-primary/30", isSelected && "ring-2 ring-primary shadow-card-hover")}
      onClick={handleCardClick}
    >
      <CardContent className="p-4 md:py-4 md:px-5 flex items-center gap-4">
        {isEditing && (
            <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectionChange}
                className="h-5 w-5"
                aria-label={`Select journal ${journal.journalName}`}
            />
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <p className="font-headline text-base md:text-lg font-semibold leading-snug truncate">{journal.journalName}</p>
              <IssnMetadataRow
                issn={journal.issn}
                authorityLevel={journal.authorityJournal}
                isOpenAccess={journal.openAccess === "是"}
              />
            </div>

            <div className="flex items-start gap-6 md:gap-8 shrink-0 md:pl-4 md:border-l md:border-border/60">
                <div className="flex flex-col items-start md:items-end min-w-[72px]">
                    <p className="text-[10px] md:text-xs uppercase tracking-wide text-muted-foreground font-medium leading-none h-4 flex items-center">{t('journal.impactFactor')}</p>
                    <div className="mt-1 h-7 flex items-center">
                        <p className="font-headline font-semibold text-base tabular-nums leading-none">{formatImpactFactor(journal.impactFactor)}</p>
                    </div>
                </div>
                {hasPartition && journal.majorCategoryPartition && (
                <div className="flex flex-col items-start md:items-end min-w-[56px]">
                    <p className="text-[10px] md:text-xs uppercase tracking-wide text-muted-foreground font-medium leading-none h-4 flex items-center">{partitionShort}</p>
                    <div className="mt-1 h-7 flex items-center">
                        <Badge variant={getPartitionBadgeVariant(journal.majorCategoryPartition)} className="text-sm px-2 py-0.5">
                            {getPartitionText(journal.majorCategoryPartition)}
                        </Badge>
                    </div>
                </div>
                )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
