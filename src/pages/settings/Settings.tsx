import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { MCPsTab } from './MCPsTab';
import { ProvidersTab } from './ProvidersTab';
import { GlobalConfigTab } from './GlobalConfigTab';
import './Settings.scss';

type SettingsTabKey = 'mcps' | 'providers' | 'config';

const tabs: { key: SettingsTabKey; label: string; icon: string }[] = [
    { key: 'mcps', label: 'MCPs', icon: 'codicon-extensions' },
    { key: 'providers', label: 'Providers', icon: 'codicon-key' },
    { key: 'config', label: 'Global Config', icon: 'codicon-settings-gear' },
];

export function Settings() {
    const [activeTab, setActiveTab] = useState<SettingsTabKey>('mcps');
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
                        <i className={`codicon ${tab.icon}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="settings-tab-content">
                {activeTab === 'mcps' && <MCPsTab />}
                {activeTab === 'providers' && <ProvidersTab />}
                {activeTab === 'config' && <GlobalConfigTab />}
            </div>
        </div>
    );
}
