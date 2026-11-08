import { describe, expect, it } from 'vitest';
import { requireGameBackend } from './game-backend-config';

describe('game backend configuration', () => {
  it('rejects a missing server URL even when a server key exists', () => {
    expect(() => requireGameBackend(undefined, 'test-server-key')).toThrow('Koneksi penyimpanan permainan belum dikonfigurasi');
  });
  it('rejects a missing privileged server key even when a URL exists', () => {
    expect(() => requireGameBackend('https://backend.example', undefined)).toThrow('Koneksi penyimpanan permainan belum dikonfigurasi');
  });
  it('accepts both required server values', () => {
    expect(() => requireGameBackend('https://backend.example', 'test-server-key')).not.toThrow();
  });
  it('does not include supplied credentials in the configuration error', () => {
    try {
      requireGameBackend(undefined, 'private-test-value');
      expect.fail('missing URL must throw');
    } catch (error) {
      expect(String(error)).not.toContain('private-test-value');
    }
  });
});
import { storageErrorMessage } from './game-backend-config';
describe('storage error messages', () => {
  it('explains missing tables', () => {
    expect(storageErrorMessage({ code: 'PGRST205', message: 'Could not find the table' }, 'x')).toContain('Tabel permainan belum dibuat');
  });
  it('explains a rejected server key', () => {
    expect(storageErrorMessage({ message: 'Invalid API key' }, 'x')).toContain('Kunci server penyimpanan ditolak');
  });
  it('keeps the fallback for unknown errors', () => {
    expect(storageErrorMessage({ message: 'something' }, 'fallback')).toBe('fallback');
  });
});
