import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** Server-only decoded LRU. A failed read/parse is never cached. */
export function createGzipShardCache<T>(capacity: number, read: (file: string) => Buffer = readFileSync) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Invalid shard cache capacity");
  const entries = new Map<string, T>();
  return (file: string): T => {
    if (entries.has(file)) {
      const value = entries.get(file)!; entries.delete(file); entries.set(file, value); return value;
    }
    const value = JSON.parse(gunzipSync(read(file)).toString("utf8")) as T;
    entries.set(file, value);
    while (entries.size > capacity) entries.delete(entries.keys().next().value!);
    return value;
  };
}
