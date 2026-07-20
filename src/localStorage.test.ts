import { beforeEach, describe, expect, it } from 'vitest';
import { getLocalStorage, setLocalStorage } from './localStorage';

describe('typed local storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips supported values', () => {
    setLocalStorage('editor', 'desktop');
    setLocalStorage('fontScale', 1.2);

    expect(getLocalStorage('editor')).toBe('desktop');
    expect(getLocalStorage('fontScale')).toBe(1.2);
  });

  it.each([
    ['editor', '"unsupported"'],
    ['editor', '42'],
    ['fontScale', '"large"'],
    ['fontScale', '-1'],
    ['fontScale', 'null'],
  ] as const)('rejects invalid %s values', (key, value) => {
    localStorage.setItem(key, value);

    expect(getLocalStorage(key)).toBeUndefined();
  });
});
