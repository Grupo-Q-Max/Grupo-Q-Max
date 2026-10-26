export function normalizePhone(value: string): string {
  let digits = String(value ?? '').replace(/\D/g, '');

  if (
    digits.startsWith('55') &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.substring(2);
  }

  return digits;
}

export function normalizeEmail(value?: string | null): string | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  return normalized || null;
}

export function normalizeState(value?: string | null): string | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  return normalized || null;
}
