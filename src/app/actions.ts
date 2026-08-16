'use server';

import type { Journal } from '@/data/journals';
import {
  summarizeJournalInfo,
  type SummarizeJournalInfoOutput,
} from '@/ai/flows/summarize-journal-info';
export type { ContentBlock } from '@/ai/flows/summarize-journal-info';

export type JournalSummaryInfo = SummarizeJournalInfoOutput;

export async function getSummary(
  journal: Journal,
  locale: 'en' | 'zh',
  editionId: string
): Promise<JournalSummaryInfo> {
  const summary = await summarizeJournalInfo({
    journalName: journal.journalName,
    issn: journal.issn,
    locale,
    editionId,
  });

  return summary;
}
