
'use server';
/**
 * @fileOverview A tool for finding journals based on a query.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { journals, Journal } from '@/data/journals';

const FindJournalsInputSchema = z.object({
  query: z.string().describe('The search query for journals. Can be a topic, category, or partial name.'),
});

const FindJournalsOutputSchema = z.array(z.object({
    journalName: z.string(),
    issn: z.string(),
}));

export const findJournalsTool = ai.defineTool(
  {
    name: 'findJournalsTool',
    description: 'Finds journals from the database based on a search query. The query can be a topic, category, or partial journal name.',
    inputSchema: FindJournalsInputSchema,
    outputSchema: FindJournalsOutputSchema,
  },
  async (input) => {
    const { query } = input;
    const lowercasedQuery = query.toLowerCase();

    const allJournals = journals;

    const filteredJournals = allJournals.filter((journal: Journal) => {
        const inName = journal.journalName.toLowerCase().includes(lowercasedQuery);
        const inMajorCategory = journal.majorCategory.toLowerCase().includes(lowercasedQuery);
        const inMinorCategories = journal.minorCategories.some(cat => cat.name.toLowerCase().includes(lowercasedQuery));
        return inName || inMajorCategory || inMinorCategories;
    }).slice(0, 10); // Limit to 10 results to not overwhelm the context

    return filteredJournals.map(j => ({ journalName: j.journalName, issn: j.issn }));
  }
);
