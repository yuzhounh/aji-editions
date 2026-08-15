/**
 * DeepSeek API client (OpenAI-compatible chat completions).
 * Configuration:
 *   - DEEPSEEK_API_KEY: required, DeepSeek API key.
 *   - DEEPSEEK_MODEL: optional, defaults to "deepseek-v4-flash".
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekChatOptions {
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Calls the DeepSeek chat completions API in JSON mode and returns the raw
 * JSON text from the model. Throws on network/API/empty-response errors.
 */
export async function deepseekChatJson(
  messages: DeepSeekMessage[],
  options: DeepSeekChatOptions = {}
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured in environment.');
  }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const temperature = options.temperature ?? 0.7;
  const timeoutMs = options.timeoutMs ?? 60000;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      response_format: { type: 'json_object' },
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DeepSeek API error (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data: any = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('DeepSeek API returned an empty response.');
  }

  return content;
}

/**
 * Parses a DeepSeek response into a JSON object, tolerating markdown code
 * fences that some models add around the JSON payload.
 */
export function parseDeepSeekJson(text: string): any {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return JSON.parse(cleaned);
}
