import { getJcrReleaseYear } from "@aji/core";
export { getJcrReleaseYear } from "@aji/core";

type EditionLabelSource = {
  impactFactorYear: number;
  partitionYear: number;
  partitionType: "cas" | "xr" | "jcr-only";
};

export function getEditionDisplayLabel(edition: EditionLabelSource): string {
  if (edition.partitionType === "jcr-only") {
    return `JCR ${getJcrReleaseYear(edition.impactFactorYear)}`;
  }

  const tag = edition.partitionType === "xr" ? "XR" : "CAS";
  return `JCR ${getJcrReleaseYear(edition.impactFactorYear)} · ${tag} ${edition.partitionYear}`;
}
