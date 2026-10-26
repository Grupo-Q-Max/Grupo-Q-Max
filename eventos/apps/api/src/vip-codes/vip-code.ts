import { randomInt } from 'crypto';

// Sem 0/O/1/I/L para não confundir na leitura do cartão impresso.
export const VIP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const VIP_CODE_LENGTH = 8;

export function generateVipCode(): string {
  let code = '';

  for (let i = 0; i < VIP_CODE_LENGTH; i++) {
    code += VIP_CODE_ALPHABET[randomInt(VIP_CODE_ALPHABET.length)];
  }

  return code;
}

export function normalizeVipCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
