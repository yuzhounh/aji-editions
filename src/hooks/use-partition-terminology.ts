"use client";

import { useEdition } from "@/contexts/EditionContext";
import { useTranslation } from "@/i18n/provider";

export function usePartitionTerminology() {
  const { currentEdition } = useEdition();
  const { t } = useTranslation();
  const isXr = currentEdition.partitionType === "xr";

  return {
    isXr,
    /** Translation namespace for partition tooltips and shared partition strings. */
    ns: isXr ? ("xr" as const) : ("cas" as const),
    partitionShort: t(
      isXr ? "journal.xrPartitionShort" : "journal.casPartitionShort"
    ),
    partition: t(isXr ? "journal.xrPartition" : "journal.casPartition"),
    majorPartition: t(
      isXr ? "journal.xrMajorPartition" : "journal.casMajorPartition"
    ),
    description: t(isXr ? "journal.xrDescription" : "journal.casDescription"),
    statsPartitionTitle: t(
      isXr ? "stats.xrPartitionTitle" : "stats.partitionTitle"
    ),
    browseSubtitle: t(
      isXr ? "categories.browseSubtitleXr" : "categories.browseSubtitle"
    ),
    exportPartitionHeader: isXr ? "Xinrui Partition" : "CAS Partition",
  };
}
