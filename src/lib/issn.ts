export function isBlankIssnPart(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || /^n\/a$/i.test(trimmed) || trimmed === "-";
}

export function normalizeIssnPart(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  return isBlankIssnPart(trimmed) ? "" : trimmed;
}

/** Always uses print/electronic layout so the slash stays aligned in the UI. */
export function combineIssnParts(print: unknown, electronic: unknown): string {
  const printIssn = normalizeIssnPart(print);
  const electronicIssn = normalizeIssnPart(electronic);
  if (!printIssn && !electronicIssn) return "";
  return `${printIssn}/${electronicIssn}`;
}

export function splitIssnDisplay(issn: string): {
  print: string;
  electronic: string;
} {
  const raw = issn.trim();
  if (!raw) {
    return { print: "-", electronic: "-" };
  }

  if (raw.includes("/")) {
    const [printPart = "", electronicPart = ""] = raw.split("/");
    const print = normalizeIssnPart(printPart);
    const electronic = normalizeIssnPart(electronicPart);
    return {
      print: print || "-",
      electronic: electronic || "-",
    };
  }

  const single = normalizeIssnPart(raw);
  return { print: single || "-", electronic: "-" };
}

/** Primary identifier for favorites, selection, and lookups. */
export function getPrimaryIssn(issn: string): string {
  const { print, electronic } = splitIssnDisplay(issn);
  const printIssn = print === "-" ? "" : print;
  const electronicIssn = electronic === "-" ? "" : electronic;
  return printIssn || electronicIssn;
}

export function formatIssnDisplay(issn: string): string {
  const { print, electronic } = splitIssnDisplay(issn);
  if (print === "-" && electronic === "-") return "-";
  if (print === "-") return electronic;
  if (electronic === "-") return print;
  return `${print}/${electronic}`;
}
