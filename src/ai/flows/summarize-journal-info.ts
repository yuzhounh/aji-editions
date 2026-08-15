

'use server';

/**
 * @fileOverview Summarizes journal information, highlighting key metrics like impact factor and category rankings.
 *
 * - summarizeJournalInfo - A function that summarizes journal information.
 * - SummarizeJournalInfoInput - The input type for the summarizeJournalInfo function.
 * - SummarizeJournalInfoOutput - The return type for the summarizeJournalInfo function.
 */

import { z } from 'zod';
import { getEditionById } from '@/data/journals';
import type { Journal } from '@/data/journals';
import { deepseekChatJson, parseDeepSeekJson } from '@/ai/deepseek';

const SummarizeJournalInfoInputSchema = z.object({
  journalName: z.string().describe('The name of the journal.'),
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

export async function summarizeJournalInfo(
  input: SummarizeJournalInfoInput
): Promise<SummarizeJournalInfoOutput> {
  const { journalName, locale, editionId } = input;

  const responseText = await deepseekChatJson([
    {
      role: 'system',
      content:
        'You are a professional academic journal analyst. You always output strictly valid JSON that matches the requested schema. Do not include any text outside the JSON object.',
    },
    {
      role: 'user',
      content: `
Your task is to generate a detailed analysis report for the following journal.
The entire report MUST be written in the language of the provided locale: ${locale}.
IMPORTANT: When generating the report, DO NOT translate the original 'Journal Name'. Keep it as provided.

Journal Name: ${journalName}

You MUST output a single JSON object with exactly this shape:
{
  "summary": [
    { "type": "heading", "level": 2, "content": "..." },
    { "type": "paragraph", "content": "..." },
    { "type": "list", "items": ["...", "..."] }
  ],
  "relatedJournals": [
    { "journalName": "...", "issn": "..." }
  ]
}

The "summary" array MUST include the following sections, in order, as content blocks:
1. A heading (type "heading", level 2) for "Journal Introduction", followed by a paragraph (type "paragraph") providing background, history, and publisher info.
2. A heading (type "heading", level 2) for "Main Publication Areas", followed by a list (type "list") detailing the research directions and subject areas.
3. A heading (type "heading", level 2) for "Status in the Field", followed by a paragraph (type "paragraph") analyzing the journal's position, academic reputation, and influence.

Additionally, based on your own knowledge, recommend 6-9 related journals. Populate these recommendations into the "relatedJournals" field, including their names and ISSNs.`,
    },
  ], { temperature: 0.7 });

  let output: SummarizeJournalInfoOutput;
  try {
    const parsed = parseDeepSeekJson(responseText);
    const validated = SummarizeJournalInfoOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `DeepSeek response did not match schema: ${JSON.stringify(validated.error.issues.slice(0, 3))}`
      );
    }
    output = validated.data;
  } catch (err: any) {
    console.error('Failed to parse DeepSeek summary response:', err);
    return { summary: [], relatedJournals: [] };
  }

  // After getting AI suggestions, filter them to ensure they exist in our local data.
  // This prevents showing related journals that the user can't navigate to.
  const edition = getEditionById(editionId);
  const editionJournals = edition?.journals ?? [];
  const journalMapByIssn = new Map(editionJournals.map(j => [j.issn.split('/')[0], j]));

  const validatedRelatedJournals = output.relatedJournals
    .map(suggestedJournal => {
      // AI might return an ISSN with a slash or extra characters. We only care about the primary part.
      const suggestedIssnPrefix = suggestedJournal.issn.split('/')[0];
      const foundJournal = journalMapByIssn.get(suggestedIssnPrefix);

      // If we found a matching journal in our local data, use our data's name and full ISSN.
      if (foundJournal) {
        return {
          journalName: foundJournal.journalName,
          issn: foundJournal.issn,
        };
      }
      return null;
    })
    .filter((j): j is { journalName: string; issn: string } => !!j);

  return {
    summary: output.summary,
    relatedJournals: validatedRelatedJournals,
  };
}
