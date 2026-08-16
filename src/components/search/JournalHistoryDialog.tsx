"use client";

import { useMemo } from "react";
import type { Journal } from "@/data/journals";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { useEdition } from "@/contexts/EditionContext";
import { useTranslation } from "@/i18n/provider";
import { getMajorCategoryName, getMinorCategoryName } from "@/i18n/categories";
import {
  buildJournalHistory,
  type JournalIfHistoryPoint,
} from "@/lib/journal-history";
import { getPrimaryIssn } from "@/lib/issn";
import { cn } from "@/lib/utils";

type JournalHistoryDialogProps = {
  journal: Journal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ifChartConfig = {
  impactFactor: {
    label: "IF",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function getPartitionZoneKey(partition: string): string | null {
  const match = partition.match(/(\d+)/);
  return match ? match[1] : null;
}

function PartitionZoneBadge({ partition }: { partition: string }) {
  const { t } = useTranslation();
  const zone = getPartitionZoneKey(partition);
  if (!zone) return <span>{partition}</span>;

  let label = partition;
  if (zone === "1") label = t("cas.partitions.1");
  else if (zone === "2") label = t("cas.partitions.2");
  else if (zone === "3") label = t("cas.partitions.3");
  else if (zone === "4") label = t("cas.partitions.4");

  const variant =
    zone === "1"
      ? "level1"
      : zone === "2"
        ? "level2"
        : zone === "3"
          ? "level3"
          : zone === "4"
            ? "level4"
            : "secondary";

  return (
    <Badge variant={variant} className="min-w-[36px] justify-center">
      {label}
    </Badge>
  );
}

function formatAuthority(level: string, t: (key: string) => string): string {
  if (level === "一级") return t("cas.authority.1");
  if (level === "二级") return t("cas.authority.2");
  if (level === "三级") return t("cas.authority.3");
  return level;
}

function IfHistoryChart({
  points,
  currentEditionId,
}: {
  points: JournalIfHistoryPoint[];
  currentEditionId: string;
}) {
  const { t } = useTranslation();

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        jcrLabel: point.jcrLabel,
        impactFactor: point.impactFactor,
        display: point.impactFactorDisplay,
        isCurrent: point.editionId === currentEditionId,
      })),
    [points, currentEditionId]
  );

  const numericPoints = chartData.filter(
    (point) => point.impactFactor !== null
  );

  if (numericPoints.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("journal.historyNoIfData")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ChartContainer config={ifChartConfig} className="h-[300px] w-full">
        <LineChart
          data={numericPoints}
          margin={{ top: 32, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="jcrLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelKey="jcrLabel"
                formatter={(value, _name, item) => {
                  const payload = item.payload as { display?: string };
                  return payload.display ?? String(value);
                }}
              />
            }
          />
          <Line
            type="linear"
            dataKey="impactFactor"
            stroke="var(--color-impactFactor)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={({ cx, cy, payload }) => {
              const point = payload as { isCurrent?: boolean; display?: string };
              if (cx == null || cy == null) return null;
              return (
                <circle
                  key={`${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={point.isCurrent ? 6 : 4}
                  fill={
                    point.isCurrent
                      ? "hsl(var(--primary))"
                      : "hsl(var(--background))"
                  }
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6 }}
          >
            <LabelList
              dataKey="display"
              position="top"
              offset={12}
              className="fill-foreground text-[11px] font-semibold tabular-nums"
            />
          </Line>
        </LineChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">{t("journal.historyIfFootnote")}</p>
    </div>
  );
}

export default function JournalHistoryDialog({
  journal,
  open,
  onOpenChange,
}: JournalHistoryDialogProps) {
  const { editions, currentEditionId } = useEdition();
  const { t, locale } = useTranslation();
  const primaryIssn = getPrimaryIssn(journal.issn);

  const { ifHistory, partitionHistory } = useMemo(
    () => buildJournalHistory(editions, primaryIssn),
    [editions, primaryIssn]
  );

  const partitionHistoryDesc = useMemo(
    () =>
      [...partitionHistory].sort(
        (a, b) =>
          b.partitionYear - a.partitionYear ||
          b.jcrReleaseYear - a.jcrReleaseYear
      ),
    [partitionHistory]
  );

  const defaultTab =
    ifHistory.length > 1
      ? "if"
      : partitionHistory.length > 0
        ? "partition"
        : "if";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("journal.historyTitle")}</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {journal.journalName}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="if" disabled={ifHistory.length === 0}>
              {t("journal.historyIfTab")}
            </TabsTrigger>
            <TabsTrigger
              value="partition"
              disabled={partitionHistory.length === 0}
            >
              {t("journal.historyPartitionTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="if" className="mt-4">
            <IfHistoryChart
              points={ifHistory}
              currentEditionId={currentEditionId}
            />
          </TabsContent>

          <TabsContent value="partition" className="mt-4 space-y-3">
            {partitionHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("journal.historyNoPartitionData")}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg ring-1 ring-border/50">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">
                          {t("journal.historyJcrColumn")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("journal.historyPartitionSource")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("journal.historyMajorCategory")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("journal.historyMajorPartition")}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t("journal.historyAuthority")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {partitionHistoryDesc.map((row) => (
                        <tr
                          key={row.editionId}
                          className={cn(
                            "border-b last:border-0",
                            row.editionId === currentEditionId && "bg-primary/5"
                          )}
                        >
                          <td className="px-3 py-2.5 font-medium tabular-nums">
                            {row.jcrLabel}
                          </td>
                          <td className="px-3 py-2.5">{row.partitionLabel}</td>
                          <td className="px-3 py-2.5">
                            {getMajorCategoryName(row.majorCategory, locale)}
                          </td>
                          <td className="px-3 py-2.5">
                            <PartitionZoneBadge
                              partition={row.majorCategoryPartition}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {formatAuthority(row.authorityJournal, t)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {partitionHistory.some(
                  (row) => row.minorCategories.length > 0
                ) && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("journal.historyMinorCategories")}
                    </p>
                    <div className="space-y-2">
                      {partitionHistoryDesc.map((row) =>
                        row.minorCategories.length > 0 ? (
                          <div
                            key={`${row.editionId}-minors`}
                            className={cn(
                              "rounded-lg bg-muted/30 px-3 py-2 text-sm",
                              row.editionId === currentEditionId &&
                                "ring-1 ring-primary/20"
                            )}
                          >
                            <span className="font-medium tabular-nums">
                              {row.jcrLabel}
                            </span>
                            <span className="text-muted-foreground">
                              {" · "}
                              {row.partitionLabel}
                            </span>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              {row.minorCategories.map((minor, index) => (
                                <span key={`${row.editionId}-${index}`}>
                                  {getMinorCategoryName(minor.name, locale)}{" "}
                                  <PartitionZoneBadge partition={minor.partition} />
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("journal.historyPartitionFootnote")}
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
