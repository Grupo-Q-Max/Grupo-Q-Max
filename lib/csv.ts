// CSV for Excel pt-BR: ";" separator, every cell quoted, UTF-8 BOM so accents open right

export type CsvCell = string | number | null | undefined;

export const toCsv = (rows: CsvCell[][]) =>
  rows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");

/** Decimal comma, as Excel pt-BR expects. */
export const csvMoney = (n: number) => n.toFixed(2).replace(".", ",");

/** Browser only: saves `rows` as `fileName`. */
export function downloadCsv(fileName: string, rows: CsvCell[][]) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  URL.revokeObjectURL(url);
}
