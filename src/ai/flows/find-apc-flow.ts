

'use server';

/**
 * @fileOverview A flow for finding the Article Processing Charge (APC) for a journal.
 *
 * - findApc - A function that returns the APC for a given journal.
 * - FindApcInput - The input type for the findApc function.
 * - FindApcOutput - The return type for the findApc function.
 */

import { z } from 'zod';
import { deepseekChatJson, parseDeepSeekJson } from '@/ai/deepseek';

const FindApcInputSchema = z.object({
  journalName: z.string().describe('The name of the journal to find the APC for.'),
});
export type FindApcInput = z.infer<typeof FindApcInputSchema>;

const FindApcOutputSchema = z.object({
  apc: z.string().describe('The Article Processing Charge for a "Regular Paper" or "Research Article". E.g., "$2500" or "Not found".'),
  apcUrl: z.string().describe("A URL to search for the journal's APC. E.g., a Google search URL."),
});
export type FindApcOutput = z.infer<typeof FindApcOutputSchema>;

export async function findApc(input: FindApcInput): Promise<FindApcOutput> {
  const { journalName } = input;

  const responseText = await deepseekChatJson([
    {
      role: 'system',
      content:
        'You are an expert academic research assistant. You always output strictly valid JSON that matches the requested schema. Do not include any text outside the JSON object.',
    },
    {
      role: 'user',
      content: `
Your task is to find the Article Processing Charge (APC) for a "Regular Paper" or "Research Article" in a specific journal.

Journal Name: ${journalName}

1. Based on your knowledge, find the most recent APC for a "Regular Paper" or "Research Article" for the journal specified.
2. The APC should be in USD. For example, "$3000".
3. If you cannot find the APC with high confidence, set the "apc" field to "Not found".
4. Always provide a Google search URL for the user to verify the information in the "apcUrl" field. The search query should be "${journalName} article processing charge".

You MUST output a single JSON object with exactly this shape:
{
  "apc": "...",
  "apcUrl": "..."
}`,
    },
  ], { temperature: 0.3 });

  try {
    const parsed = parseDeepSeekJson(responseText);
    const validated = FindApcOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `DeepSeek response did not match schema: ${JSON.stringify(validated.error.issues.slice(0, 3))}`
      );
    }
    return validated.data;
  } catch (err: any) {
    console.error('Failed to parse DeepSeek APC response:', err);
    return {
      apc: 'Not found',
      apcUrl: `https://www.google.com/search?q=${encodeURIComponent(journalName + ' article processing charge')}`,
    };
  }
}
