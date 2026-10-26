import { extractPacingRules } from './draws.service';

describe('Regras Inteligentes de Cadência (Smart Pacing)', () => {
  it('deve retornar zeros para descrições sem regras de cadência', () => {
    const rules = extractPacingRules('Garrafa de inox Finora');
    expect(rules.minDrawInterval).toBe(0);
    expect(rules.initialDrawDelay).toBe(0);
  });

  it('deve extrair intervalo mínimo (cooldown) corretamente', () => {
    const rules = extractPacingRules('iPhone 16 Pro [INTERVALO: 50]');
    expect(rules.minDrawInterval).toBe(50);
    expect(rules.initialDrawDelay).toBe(0);
  });

  it('deve extrair delay inicial e intervalo combinados', () => {
    const rules = extractPacingRules(
      'Kit Premium Finora [INTERVALO: 30] [DELAY: 20]',
    );
    expect(rules.minDrawInterval).toBe(30);
    expect(rules.initialDrawDelay).toBe(20);
  });

  it('deve suportar aliases como COOLDOWN e LIBERAR_APOS', () => {
    const rules = extractPacingRules(
      'Brinde Raro [COOLDOWN: 100] [LIBERAR_APOS: 50]',
    );
    expect(rules.minDrawInterval).toBe(100);
    expect(rules.initialDrawDelay).toBe(50);
  });
});
