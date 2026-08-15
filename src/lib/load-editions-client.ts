import type { EditionsCollection } from "@/data/types";

export async function loadEditionsCollectionClient(): Promise<EditionsCollection> {
  const response = await fetch("/data/editions.json.gz", { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load edition data (${response.status})`);
  }

  const compressed = await response.arrayBuffer();
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  const collection = JSON.parse(json) as EditionsCollection;

  collection.editions = collection.editions.map((edition) => ({
    ...edition,
    journals: edition.journals.filter((journal) => journal.journalName),
  }));

  return collection;
}
