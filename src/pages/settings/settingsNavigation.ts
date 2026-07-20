export type SettingsTabKey = 'mcps' | 'providers' | 'config' | 'jobs' | 'logs';

const SETTINGS_TAB_KEYS: readonly SettingsTabKey[] = [
    'mcps',
    'providers',
    'config',
    'jobs',
    'logs',
];

function isSettingsTabKey(value: unknown): value is SettingsTabKey {
    return typeof value === 'string' && SETTINGS_TAB_KEYS.some(key => key === value);
}

export function resolveSettingsTab(state: unknown): SettingsTabKey {
    if (typeof state !== 'object' || state === null || !('tab' in state)) return 'mcps';
    return isSettingsTabKey(state.tab) ? state.tab : 'mcps';
}
