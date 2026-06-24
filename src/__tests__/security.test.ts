/**
 * @jest-environment node
 */
import { rateLimit, rateLimitResponse, generateCsrfToken, validateCsrfToken, safeRedirect, getLocalDate, parsePagination } from '@/lib/security';

describe('rateLimit', () => {
  const key = 'test-key';

  afterEach(() => {
    const map = (rateLimit as unknown as { clear?: () => void });
    if (map.clear) map.clear();
  });

  it('allows requests within limit', () => {
    const result = rateLimit(key, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks after limit is exceeded', () => {
    const max = 3;
    for (let i = 0; i < max; i++) {
      const result = rateLimit(key, max, 60000);
      if (i < max - 1) expect(result.allowed).toBe(true);
      else expect(result.allowed).toBe(false);
    }
  });

  it('resets after window expires', () => {
    const windowMs = 5;
    rateLimit('reset-test-key', 1, windowMs);
    const blocked = rateLimit('reset-test-key', 1, windowMs);
    expect(blocked.allowed).toBe(false);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const afterReset = rateLimit('reset-test-key', 1, windowMs);
        expect(afterReset.allowed).toBe(true);
        resolve();
      }, windowMs + 10);
    });
  }, 10000);
});

describe('rateLimitResponse', () => {
  it('returns 429 with Retry-After header', () => {
    const res = rateLimitResponse(Date.now() + 10000);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('10');
  });

  it('returns JSON error message', async () => {
    const res = rateLimitResponse(Date.now() + 5000);
    const body = await res.json();
    expect(body.error).toBe('Too many requests. Please slow down.');
  });
});

describe('generateCsrfToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns unique tokens each call', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});

describe('validateCsrfToken', () => {
  it('validates matching tokens', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('rejects non-matching tokens', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(validateCsrfToken(t1, t2)).toBe(false);
  });

  it('rejects wrong length tokens', () => {
    expect(validateCsrfToken('short', generateCsrfToken())).toBe(false);
    expect(validateCsrfToken(generateCsrfToken(), 'short')).toBe(false);
  });

  it('rejects empty tokens', () => {
    expect(validateCsrfToken('', generateCsrfToken())).toBe(false);
    expect(validateCsrfToken(generateCsrfToken(), '')).toBe(false);
  });
});

describe('safeRedirect', () => {
  it('allows dashboard paths', () => {
    expect(safeRedirect('/dashboard/director')).toBe('/dashboard/director');
    expect(safeRedirect('/dashboard/employee')).toBe('/dashboard/employee');
    expect(safeRedirect('/dashboard/client')).toBe('/dashboard/client');
  });

  it('allows login and register', () => {
    expect(safeRedirect('/login')).toBe('/login');
    expect(safeRedirect('/register')).toBe('/register');
  });

  it('blocks external URLs', () => {
    expect(safeRedirect('https://evil.com')).toBe('/login');
    expect(safeRedirect('//evil.com')).toBe('/login');
  });

  it('falls back to /login for unknown paths', () => {
    expect(safeRedirect('/api/whatever')).toBe('/login');
  });
});

describe('getLocalDate', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = getLocalDate();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns UTC date when no offset given', () => {
    const date = getLocalDate();
    const utcDate = new Date().toISOString().split('T')[0];
    expect(date).toBe(utcDate);
  });

  it('handles positive timezone offset', () => {
    const date = getLocalDate('330');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles negative timezone offset', () => {
    const date = getLocalDate('-300');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to UTC for invalid offset', () => {
    const date = getLocalDate('abc');
    const utcDate = new Date().toISOString().split('T')[0];
    expect(date).toBe(utcDate);
  });
});

describe('parsePagination', () => {
  const mockParams = (params: Record<string, string>) => {
    return new URLSearchParams(params);
  };

  it('returns default values when no params', () => {
    const result = parsePagination(mockParams({}), 50, 200);
    expect(result.limit).toBe(50);
    expect(result.page).toBe(1);
    expect(result.from).toBe(0);
    expect(result.to).toBe(49);
  });

  it('parses page and limit from query', () => {
    const result = parsePagination(mockParams({ page: '3', limit: '20' }), 50, 200);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.from).toBe(40);
    expect(result.to).toBe(59);
  });

  it('caps limit at maxLimit', () => {
    const result = parsePagination(mockParams({ limit: '999' }), 50, 200);
    expect(result.limit).toBe(200);
  });

  it('minimum limit is 1', () => {
    const result = parsePagination(mockParams({ limit: '0' }), 50, 200);
    expect(result.limit).toBe(1);
  });

  it('minimum page is 1', () => {
    const result = parsePagination(mockParams({ page: '0' }), 50, 200);
    expect(result.page).toBe(1);
  });
});
