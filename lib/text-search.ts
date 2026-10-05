/** Lowercase without accents, so "joao" finds "João". */
export const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** True when the query is empty or any value contains it (case and accent insensitive). */
export const matches = (query: string, ...values: (string | number | null | undefined)[]) => {
  const q = normalize(query.trim());
  return !q || values.some((v) => v != null && normalize(String(v)).includes(q));
};
