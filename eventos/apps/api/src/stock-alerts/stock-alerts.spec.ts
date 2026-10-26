import { crossedStockAlert, stockAlertLimit } from './stock-alerts.service';

describe('alerta de estoque', () => {
  it('limite é % do estoque inicial, no mínimo 1', () => {
    expect(stockAlertLimit(100, 20)).toBe(20);
    expect(stockAlertLimit(3, 20)).toBe(1);
  });

  it('dispara só ao cruzar o limite ou esgotar', () => {
    expect(crossedStockAlert(21, 20, 20)).toBe('baixo');
    expect(crossedStockAlert(20, 19, 20)).toBeNull();
    expect(crossedStockAlert(1, 0, 20)).toBe('esgotado');
    expect(crossedStockAlert(10, 15, 20)).toBeNull();
  });
});
