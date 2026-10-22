// CSV for Excel pt-BR: ";" separator, every cell quoted, UTF-8 BOM so accents open right

export type CsvCell = string | number | null | undefined;

export const toCsv = (rows: CsvCell[][]) =>
  rows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");

/** Decimal comma, as Excel pt-BR expects. */
export const csvMoney = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Parses CSV text (Excel pt-BR ";" or plain ","; separator taken from the first line), with quoted
 * cells, "" escapes, line breaks inside quotes, CRLF and a leading BOM. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = firstLine.split(";").length >= firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Browser only: saves `rows` as `fileName`. */
export function downloadCsv(fileName: string, rows: CsvCell[][]) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  URL.revokeObjectURL(url);
}
