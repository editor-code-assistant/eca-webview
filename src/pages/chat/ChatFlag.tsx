import { memo } from "react";
import './ChatFlag.scss';

interface Props {
    text: string;
    onForkClicked: () => void;
    onRemoveClicked: () => void;
}

export const ChatFlag = memo(({ text, onForkClicked, onRemoveClicked }: Props) => {
    return (
        <div className="flag-banner">
            <span className="flag-label">🚩 {text}</span>
            <div className="flag-actions">
                <button onClick={onForkClicked} className="flag-btn" title="Fork from here">
                    <i className="codicon codicon-repo-forked" />
                </button>
                <button onClick={onRemoveClicked} className="flag-btn flag-btn-remove" title="Remove flag">
                    <i className="codicon codicon-close" />
                </button>
            </div>
        </div>
    );
});
