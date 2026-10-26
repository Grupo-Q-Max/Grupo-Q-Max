import {
  generateVipCode,
  normalizeVipCode,
  VIP_CODE_ALPHABET,
  VIP_CODE_LENGTH,
} from './vip-code';

describe('vip-code', () => {
  it('gera código no tamanho e alfabeto sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateVipCode();
      expect(code).toHaveLength(VIP_CODE_LENGTH);
      expect([...code].every((c) => VIP_CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(VIP_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('normaliza o que a pessoa digita', () => {
    expect(normalizeVipCode(' ab3d-ef9h ')).toBe('AB3DEF9H');
  });
});
