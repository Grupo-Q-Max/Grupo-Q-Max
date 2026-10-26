import { publicUrl } from './public-url';

describe('publicUrl', () => {
  const original = process.env.FRONTEND_URL;
  afterEach(() => (process.env.FRONTEND_URL = original));

  it('aceita FRONTEND_URL com ou sem basePath e prioriza origin', () => {
    process.env.FRONTEND_URL = 'https://x.com.br/finora-experience/';
    expect(publicUrl('/v/abc')).toBe('https://x.com.br/finora-experience/v/abc');
    process.env.FRONTEND_URL = 'https://x.com.br';
    expect(publicUrl('v/abc')).toBe('https://x.com.br/finora-experience/v/abc');
    expect(publicUrl('/v/abc', 'http://localhost:3001')).toBe('http://localhost:3001/finora-experience/v/abc');
  });
});
