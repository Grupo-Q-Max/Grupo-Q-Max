import { createCipheriv, createHmac, randomBytes } from 'crypto';

export function normalizeCpf(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }

  let digit = (sum * 10) % 11;

  if (digit === 10) {
    digit = 0;
  }

  if (digit !== Number(cpf[9])) {
    return false;
  }

  sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }

  digit = (sum * 10) % 11;

  if (digit === 10) {
    digit = 0;
  }

  return digit === Number(cpf[10]);
}

function getCpfHashKey(): Buffer {
  const secret = process.env.CPF_HASH_SECRET;

  if (!secret) {
    throw new Error('CPF_HASH_SECRET não configurada.');
  }

  try {
    const decoded = Buffer.from(secret, 'base64');

    if (decoded.length > 0) {
      return decoded;
    }
  } catch {
    // fallback abaixo
  }

  return Buffer.from(secret, 'utf8');
}

function getEncryptionKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error('DATA_ENCRYPTION_KEY não configurada.');
  }

  const key = Buffer.from(secret, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'DATA_ENCRYPTION_KEY precisa possuir exatamente 32 bytes em Base64.',
    );
  }

  return key;
}

export function hashCpf(cpf: string): string {
  const norm = String(cpf || '').startsWith('EXT-')
    ? String(cpf).trim().toUpperCase()
    : normalizeCpf(cpf);
  return createHmac('sha256', getCpfHashKey())
    .update(norm)
    .digest('hex');
}

export function encryptCpf(cpf: string): string {
  const key = getEncryptionKey();

  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(normalizeCpf(cpf), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}
