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
    return {
      print: printPart.trim() || "-",
      electronic: electronicPart.trim() || "-",
    };
  }

  return { print: raw, electronic: "-" };
}
