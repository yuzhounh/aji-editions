/** Stable in Node and browsers; keys are primary ISSNs from the existing core. */
export function dataBucket(key: string, count = 256): string {
  if (count < 1 || count > 256 || (count & (count - 1))) throw new Error("Invalid bucket count");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return ((hash >>> 0) & (count - 1)).toString(16).padStart(2, "0");
}

export const HISTORY_BUCKET_COUNT = 64;
