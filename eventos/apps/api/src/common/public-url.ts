const BASE_PATH = '/finora-experience';

// Link público do web. FRONTEND_URL pode vir com ou sem o basePath; origin
// (cabeçalho da requisição do visitante) tem precedência quando existe.
export function publicUrl(path: string, origin?: string | null): string {
  const base = (origin || process.env.FRONTEND_URL || 'http://localhost:3001')
    .replace(/\/+$/, '')
    .replace(new RegExp(`${BASE_PATH}$`), '');
  return `${base}${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
