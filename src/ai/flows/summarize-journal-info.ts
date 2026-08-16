
'use server';

/**
 * @fileOverview Serves pre-generated journal summaries with edition-aware related journals.
 */

import { z } from 'zod';
import { getEditionById } from '@/data/journals';
import { getStaticJournalSummary } from '@/data/summaries';
import { getPrimaryIssn } from '@/lib/issn';

const SummarizeJournalInfoInputSchema = z.object({
  journalName: z.string().describe('The name of the journal.'),
  issn: z.string().describe('The ISSN of the journal.'),
  locale: z.enum(['en', 'zh']).describe('The locale for the output language.'),
  editionId: z.string().describe('The active AJI edition identifier.'),
});
export type SummarizeJournalInfoInput = z.infer<
  typeof SummarizeJournalInfoInputSchema
>;

const ContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["heading"]),
    level: z.number().min(1).max(3).describe("The heading level (e.g., 2 for ##)."),
    content: z.string().describe("The text content of the heading."),
  }),
  z.object({
    type: z.enum(["paragraph"]),
    content: z.string().describe("The text content of the paragraph."),
  }),
  z.object({
    type: z.enum(["list"]),
    items: z.array(z.string()).describe("An array of strings, where each string is a list item."),
  }),
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

const SummarizeJournalInfoOutputSchema = z.object({
  summary: z.array(ContentBlockSchema).describe('A comprehensive summary of the journal covering its introduction, main publication areas, and status within its field, structured as an array of content blocks.'),
  relatedJournals: z.array(z.object({
    journalName: z.string().describe("The name of the related journal."),
    issn: z.string().describe("The ISSN of the related journal."),
  })).describe("A list of 6-9 journals related to the current one, drawn from your general knowledge.")
});
export type SummarizeJournalInfoOutput = z.infer<
  typeof SummarizeJournalInfoOutputSchema
>;

function filterRelatedJournalsForEdition(
  relatedJournals: SummarizeJournalInfoOutput['relatedJournals'],
  editionId: string
): SummarizeJournalInfoOutput['relatedJournals'] {
  const edition = getEditionById(editionId);
  const editionJournals = edition?.journals ?? [];
  const journalMapByIssn = new Map(editionJournals.map(j => [getPrimaryIssn(j.issn), j]));

  return relatedJournals
    .map(suggestedJournal => {
      const suggestedIssnPrefix = getPrimaryIssn(suggestedJournal.issn);
      const foundJournal = journalMapByIssn.get(suggestedIssnPrefix);

      if (foundJournal) {
        return {
          journalName: foundJournal.journalName,
          issn: foundJournal.issn,
        };
      }
      return null;
    })
    .filter((j): j is { journalName: string; issn: string } => !!j);
}

export async function summarizeJournalInfo(
  input: SummarizeJournalInfoInput
): Promise<SummarizeJournalInfoOutput> {
  const parsed = SummarizeJournalInfoInputSchema.safeParse(input);
  if (!parsed.success) {
    return { summary: [], relatedJournals: [] };
  }

  const { locale, editionId, issn } = parsed.data;
  const primaryIssn = getPrimaryIssn(issn);
  const staticSummary = getStaticJournalSummary(primaryIssn, locale);

  if (!staticSummary) {
    console.warn(`Missing pre-generated summary for ISSN ${primaryIssn}`);
    return { summary: [], relatedJournals: [] };
  }

  return {
    summary: staticSummary.summary,
    relatedJournals: filterRelatedJournalsForEdition(
      staticSummary.relatedJournals,
      editionId
    ),
  };
}
