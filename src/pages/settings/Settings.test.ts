import { describe, expect, it } from 'vitest';
import { resolveSettingsTab } from './settingsNavigation';

describe('resolveSettingsTab', () => {
  it.each(['mcps', 'providers', 'config', 'jobs', 'logs'] as const)(
    'accepts the %s tab from router state',
    (tab) => {
      expect(resolveSettingsTab({ tab })).toBe(tab);
    },
  );

  it.each([
    undefined,
    null,
    'logs',
    {},
    { tab: 'unknown' },
    { tab: 42 },
    { tab: null },
  ])('uses the deterministic default for malformed state %#', (state) => {
    expect(resolveSettingsTab(state)).toBe('mcps');
  });
});
