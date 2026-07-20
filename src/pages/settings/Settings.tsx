import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { resolveSettingsTab } from './settingsNavigation';
import type { SettingsTabKey } from './settingsNavigation';
import './Settings.scss';

const MCPsTab = lazy(async () => ({ default: (await import('./MCPsTab')).MCPsTab }));
const ProvidersTab = lazy(async () => ({ default: (await import('./ProvidersTab')).ProvidersTab }));
const GlobalConfigTab = lazy(async () => ({ default: (await import('./GlobalConfigTab')).GlobalConfigTab }));
const JobsTab = lazy(async () => ({ default: (await import('./JobsTab')).JobsTab }));
const LogsTab = lazy(async () => ({ default: (await import('./LogsTab')).LogsTab }));

const tabs: { key: SettingsTabKey; label: string; icon: string }[] = [
    { key: 'mcps', label: '🧩 MCPs', icon: '' },
    { key: 'providers', label: '🔑 Providers', icon: '' },
    { key: 'jobs', label: '⚡ Jobs', icon: '' },
    { key: 'logs', label: '📋 Logs', icon: '' },
    { key: 'config', label: '⚙️ Global Config', icon: '' },
];

export function Settings() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<SettingsTabKey>(() => resolveSettingsTab(location.state));
    const navigate = useNavigate();

    // React to subsequent `navigate(..., { state: { tab } })` calls
    // that arrive while Settings is already mounted — without this,
    // the "View Logs" menu item would be a no-op when the user is
    // already on the Settings page but looking at a different tab.
    useEffect(() => {
        const tab = resolveSettingsTab(location.state);
        setActiveTab(currentTab => currentTab === tab ? currentTab : tab);
    }, [location.state]);

    return (
        <div className="settings-container scrollable">
            <div className="page-header">
                <button onClick={() => { navigate(ROUTES.CHAT); }} className="back-button">
                    <i className="codicon codicon-arrow-left"></i>
                </button>
                <h2 className="page-title">Settings</h2>
            </div>

            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); }}>
                        {tab.icon && <i className={`codicon ${tab.icon}`}></i>}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="settings-tab-content">
                <Suspense fallback={<div className="settings-tab-loading">Loading settingsâ€¦</div>}>
                    {activeTab === 'mcps' && <MCPsTab />}
                    {activeTab === 'providers' && <ProvidersTab />}
                    {activeTab === 'jobs' && <JobsTab />}
                    {activeTab === 'logs' && <LogsTab />}
                    {activeTab === 'config' && <GlobalConfigTab />}
                </Suspense>
            </div>
        </div>
    );
}
