function validateCpfAlgorithmic(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

describe('Validação Algorítmica de CPF', () => {
  it('deve rejeitar CPFs com quantidade de dígitos incorreta', () => {
    expect(validateCpfAlgorithmic('123456789')).toBe(false);
    expect(validateCpfAlgorithmic('1234567890123')).toBe(false);
  });

  it('deve rejeitar CPFs com dígitos todos repetidos', () => {
    expect(validateCpfAlgorithmic('111.111.111-11')).toBe(false);
    expect(validateCpfAlgorithmic('000.000.000-00')).toBe(false);
    expect(validateCpfAlgorithmic('999.999.999-99')).toBe(false);
  });

  it('deve rejeitar CPFs com dígitos verificadores inválidos', () => {
    expect(validateCpfAlgorithmic('123.456.789-00')).toBe(false);
    expect(validateCpfAlgorithmic('529.982.247-21')).toBe(false);
  });

  it('deve aprovar CPFs matematicamente válidos', () => {
    // CPFs com dígitos verificadores válidos padrão Receita Federal
    expect(validateCpfAlgorithmic('529.982.247-25')).toBe(true);
  });
});
