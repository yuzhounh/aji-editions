import Papa from "papaparse";

/** Download CSV via Blob URL (avoids data-URI size limits and `#` truncation). */
export function triggerCsvDownload(
  data: (string | number)[][],
  filename: string
): void {
  const csv = "\uFEFF" + Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
