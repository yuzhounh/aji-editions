type EditionLabelSource = {
  impactFactorYear: number;
  partitionYear: number;
  partitionType: "cas" | "xr";
};

export function getEditionDisplayLabel(edition: EditionLabelSource): string {
  const partitionTag = edition.partitionType === "xr" ? "XR" : "CAS";
  return `IF ${edition.impactFactorYear} · ${partitionTag} ${edition.partitionYear}`;
}
