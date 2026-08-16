type EditionLabelSource = {
  impactFactorYear: number;
  partitionYear: number;
  partitionType: "cas" | "xr" | "jcr-only";
};

/** Clarivate JCR release edition year (IF data year + 1). */
export function getJcrReleaseYear(impactFactorYear: number): number {
  return impactFactorYear + 1;
}

export function getEditionDisplayLabel(edition: EditionLabelSource): string {
  if (edition.partitionType === "jcr-only") {
    return `JCR ${getJcrReleaseYear(edition.impactFactorYear)}`;
  }

  const tag = edition.partitionType === "xr" ? "XR" : "CAS";
  return `JCR ${getJcrReleaseYear(edition.impactFactorYear)} · ${tag} ${edition.partitionYear}`;
}
