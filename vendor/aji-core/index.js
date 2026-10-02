export function isBlankIssnPart(value) {
  const trimmed = value.trim();
  return !trimmed || /^n\/a$/i.test(trimmed) || trimmed === "-";
}

export function normalizeIssnPart(value) {
  const trimmed = String(value ?? "").trim();
  return isBlankIssnPart(trimmed) ? "" : trimmed;
}

export function combineIssnParts(print, electronic) {
  const printIssn = normalizeIssnPart(print);
  const electronicIssn = normalizeIssnPart(electronic);
  if (!printIssn && !electronicIssn) return "";
  return `${printIssn}/${electronicIssn}`;
}

export function splitIssnParts(issn) {
  // N/A itself contains a slash; remove that placeholder before splitting.
  const raw = String(issn ?? "").replace(/\bn\/a\b/gi, "");
  const [print = "", electronic = ""] = raw.split("/");
  return {
    print: normalizeIssnPart(print),
    electronic: normalizeIssnPart(electronic),
  };
}

export function splitIssnDisplay(issn) {
  const { print, electronic } = splitIssnParts(issn);
  return { print: print || "-", electronic: electronic || "-" };
}

export function getPrimaryIssn(issn) {
  const { print, electronic } = splitIssnParts(issn);
  return print || electronic;
}

// Preserve the existing single-edition application's persisted identifiers.
export function getLegacyFavoriteId(issn) {
  return issn.split("/")[0];
}

export function formatIssnDisplay(issn) {
  const { print, electronic } = splitIssnParts(issn);
  return [print, electronic].filter(Boolean).join("/") || "-";
}

// ShowJCR filenames contain the IF data year, not the JCR release year.
export function getJcrReleaseYear(impactFactorYear) {
  return impactFactorYear + 1;
}
