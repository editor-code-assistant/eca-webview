import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { MCPsTab } from './MCPsTab';
import { ProvidersTab } from './ProvidersTab';
import { GlobalConfigTab } from './GlobalConfigTab';
import { JobsTab } from './JobsTab';
import './Settings.scss';

type SettingsTabKey = 'mcps' | 'providers' | 'config' | 'jobs';

const tabs: { key: SettingsTabKey; label: string; icon: string }[] = [
    { key: 'mcps', label: '🧩 MCPs', icon: '' },
    { key: 'providers', label: '🔑 Providers', icon: '' },
    { key: 'jobs', label: '⚡ Jobs', icon: '' },
    { key: 'config', label: '⚙️ Global Config', icon: '' },
];

const validTabs = new Set<string>(tabs.map(t => t.key));

export function Settings() {
    const location = useLocation();
    const initialTab = (location.state as any)?.tab;
    const [activeTab, setActiveTab] = useState<SettingsTabKey>(
        initialTab && validTabs.has(initialTab) ? initialTab : 'mcps'
    );
    const navigate = useNavigate();

    return (
        <div className="settings-container scrollable">
            <div className="page-header">
                <button onClick={() => navigate(ROUTES.CHAT)} className="back-button">
                    <i className="codicon codicon-arrow-left"></i>
                </button>
                <h2 className="page-title">Settings</h2>
            </div>

            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}>
                        {tab.icon && <i className={`codicon ${tab.icon}`}></i>}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="settings-tab-content">
                {activeTab === 'mcps' && <MCPsTab />}
                {activeTab === 'providers' && <ProvidersTab />}
                {activeTab === 'jobs' && <JobsTab />}
                {activeTab === 'config' && <GlobalConfigTab />}
            </div>
        </div>
    );
}
