import { webviewSend } from '../../hooks';
import './GlobalConfigTab.scss';

export function GlobalConfigTab() {
    const onOpenConfig = () => {
        webviewSend('editor/openGlobalConfig', {});
    };

    return (
        <div className="global-config-tab">
            <p className="tab-description">
                Edit the ECA global configuration file. This JSON file controls default models,
                providers, MCP servers, and other settings.{' '}
                <a href="https://eca.dev/config">Learn more</a>
            </p>

            <div className="config-action">
                <button className="open-config-btn" onClick={onOpenConfig}>
                    <i className="codicon codicon-go-to-file"></i>
                    Open config.json
                </button>
                <span className="config-path">~/.config/eca/config.json</span>
            </div>
        </div>
    );
}
