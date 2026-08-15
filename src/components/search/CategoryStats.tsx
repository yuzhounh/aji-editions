
"use client";

import { useMemo, useState } from "react";
import type { Journal } from "@/data/journals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { usePartitionTerminology } from "@/hooks/use-partition-terminology";
import { cn } from "@/lib/utils";


interface CategoryStatsProps {
  journals: Journal[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const partitionColors: { [key: string]: string } = {
  "一区": "hsl(var(--partition-q1))",
  "二区": "hsl(var(--partition-q2))",
  "三区": "hsl(var(--partition-q3))",
  "四区": "hsl(var(--partition-q4))",
  "Q1": "hsl(var(--partition-q1))",
  "Q2": "hsl(var(--partition-q2))",
  "Q3": "hsl(var(--partition-q3))",
  "Q4": "hsl(var(--partition-q4))",
};

const authorityColors: { [key: string]: string } = {
  "一级": "hsl(var(--authority-l1))",
  "二级": "hsl(var(--authority-l2))",
  "三级": "hsl(var(--authority-l3))",
  "Level 1": "hsl(var(--authority-l1))",
  "Level 2": "hsl(var(--authority-l2))",
  "Level 3": "hsl(var(--authority-l3))",
};

const openAccessColors: { [key: string]: string } = {
    "Closed Access": "hsl(var(--oa-closed))",
    "Open Access": "hsl(var(--oa-open))",
};

const StatsBarChart = ({ data, totalJournals }: { data: { name: string; count: number, fill: string }[]; totalJournals: number }) => {
    const { t } = useTranslation();
    if (!data.length || totalJournals === 0) return <div className="h-8 bg-muted rounded-md" />;

    return (
        <TooltipProvider>
            <div className="flex h-8 w-full rounded-md overflow-hidden">
                {data.map((item) => (
                    <Tooltip key={item.name} delayDuration={100}>
                        <TooltipTrigger asChild>
                            <div
                                style={{
                                    width: `${(item.count / totalJournals) * 100}%`,
                                    backgroundColor: item.fill,
                                }}
                                className="h-full transition-transform duration-200 ease-in-out hover:scale-105 hover:brightness-110"
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-sm p-1">
                                <p className="font-bold flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }} />
                                    {item.name}
                                </p>
                                <p>{t('stats.count')}: {item.count}</p>
                                <p>{t('stats.ratio')}: {((item.count / totalJournals) * 100).toFixed(1)}%</p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    );
};


const StatsDetails = ({ title, data, total }: { title: string; data: { name: string; count: number, fill: string }[]; total: number }) => {
    
    if (total === 0) return null;

    return (
        <div className="space-y-3">
            <h4 className="text-base font-semibold text-muted-foreground">{title}</h4>
            <div className="space-y-2 text-base">
                {data.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }} />
                           <span>{item.name}</span>
                        </div>
                        <div className="font-mono text-right">
                           <span>{item.count}</span>
                           <span className="text-muted-foreground text-sm ml-2">({((item.count / total) * 100).toFixed(1)}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

function useStatsData(journals: Journal[]) {
  const { t, locale } = useTranslation();
  const totalJournals = journals.length;

  const partitionData = useMemo(() => {
    const partitionKeys = locale === 'zh' ? ['一区', '二区', '三区', '四区'] : ['Q1', 'Q2', 'Q3', 'Q4'];
    const counts: { [key: string]: number } = { [partitionKeys[0]]: 0, [partitionKeys[1]]: 0, [partitionKeys[2]]: 0, [partitionKeys[3]]: 0 };
    journals.forEach((j) => {
      const p = j.majorCategoryPartition.charAt(0);
      if (p === '1') counts[partitionKeys[0]]++;
      else if (p === '2') counts[partitionKeys[1]]++;
      else if (p === '3') counts[partitionKeys[2]]++;
      else if (p === '4') counts[partitionKeys[3]]++;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count, fill: partitionColors[name] })).filter(item => item.count > 0);
  }, [journals, locale]);

  const authorityData = useMemo(() => {
    const authorityKeys = locale === 'zh' ? ['一级', '二级', '三级'] : ['Level 1', 'Level 2', 'Level 3'];
    const counts: { [key: string]: number } = { [authorityKeys[0]]: 0, [authorityKeys[1]]: 0, [authorityKeys[2]]: 0 };
    journals.forEach((j) => {
      if (j.authorityJournal === "一级") counts[authorityKeys[0]]++;
      else if (j.authorityJournal === "二级") counts[authorityKeys[1]]++;
      else if (j.authorityJournal === "三级") counts[authorityKeys[2]]++;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count, fill: authorityColors[name] })).filter(item => item.count > 0);
  }, [journals, locale]);

  const openAccessData = useMemo(() => {
    const keys = { "Open Access": t('stats.oa.open'), "Closed Access": t('stats.oa.closed') };
    const counts = { [keys["Closed Access"]]: 0, [keys["Open Access"]]: 0 };
    journals.forEach((j) => {
      if (j.openAccess === "是") {
        counts[keys["Open Access"]]++;
      } else {
        counts[keys["Closed Access"]]++;
      }
    });
    return Object.entries(counts)
      .sort(([a], [b]) => (a === keys["Closed Access"] ? -1 : 1))
      .map(([name, count]) => ({ name, count, fill: name === keys['Open Access'] ? openAccessColors['Open Access'] : openAccessColors['Closed Access'] }))
      .filter(item => item.count > 0);
  }, [journals, t]);

  return { totalJournals, partitionData, authorityData, openAccessData };
}

function StatsBody({ journals }: { journals: Journal[] }) {
  const { t } = useTranslation();
  const { statsPartitionTitle } = usePartitionTerminology();
  const { totalJournals, partitionData, authorityData, openAccessData } = useStatsData(journals);

  const allStats = [
    { title: statsPartitionTitle, data: partitionData },
    { title: t('stats.authorityTitle'), data: authorityData },
    { title: t('stats.oaTitle'), data: openAccessData },
  ];

  return (
    <CardContent className="space-y-6 pt-0">
      <div className="text-center">
          <p className="text-base text-muted-foreground">{t('stats.totalJournals')}</p>
          <p className="text-4xl font-bold tabular-nums">{totalJournals}</p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 md:hidden">
        {allStats.map(stat => (
          <div key={stat.title}>
            <StatsDetails title={stat.title} data={stat.data} total={totalJournals} />
            <div className="mt-4 space-y-2">
              <StatsBarChart data={stat.data} totalJournals={totalJournals} />
            </div>
          </div>
        ))}
      </div>
      
      <div className="hidden md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-6">
          <StatsDetails title={statsPartitionTitle} data={partitionData} total={totalJournals} />
          <StatsDetails title={t('stats.authorityTitle')} data={authorityData} total={totalJournals} />
          <StatsDetails title={t('stats.oaTitle')} data={openAccessData} total={totalJournals} />

          <div className="space-y-2">
              <StatsBarChart data={partitionData} totalJournals={totalJournals} />
          </div>
          <div className="space-y-2">
              <StatsBarChart data={authorityData} totalJournals={totalJournals} />
          </div>
          <div className="space-y-2">
              <StatsBarChart data={openAccessData} totalJournals={totalJournals} />
          </div>
      </div>
    </CardContent>
  );
}

export default function CategoryStats({ journals, collapsible = false, defaultOpen = true }: CategoryStatsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const { totalJournals, partitionData, openAccessData } = useStatsData(journals);

  const topPartition = partitionData.reduce(
    (best, item) => (item.count > best.count ? item : best),
    { name: "", count: 0, fill: "" }
  );
  const oaCount = openAccessData.find((item) => item.name === t('stats.oa.open'))?.count ?? 0;
  const oaPercent = totalJournals > 0 ? ((oaCount / totalJournals) * 100).toFixed(0) : "0";

  const summaryParts = [
    t('stats.summaryTotal', { count: totalJournals }),
    topPartition.name ? t('stats.summaryPartition', { name: topPartition.name, percent: ((topPartition.count / totalJournals) * 100).toFixed(0) }) : null,
    t('stats.summaryOa', { percent: oaPercent }),
  ].filter(Boolean);

  if (!collapsible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">{t('stats.title')}</CardTitle>
        </CardHeader>
        <StatsBody journals={journals} />
      </Card>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg font-headline">{t('stats.title')}</CardTitle>
              {!open && (
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  {summaryParts.join(" · ")}
                </p>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-muted-foreground">
                {open ? t('stats.collapse') : t('stats.expand')}
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <StatsBody journals={journals} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
