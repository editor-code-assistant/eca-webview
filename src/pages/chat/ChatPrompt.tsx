import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { State, useEcaDispatch } from "../../redux/store";
import { sendPrompt } from "../../redux/thunks/chat";
import { SelectBox } from "../components/SelectBox";
import { ChatCommands } from "./ChatCommands";
import { ChatContexts } from "./ChatContexts";
import './ChatPrompt.scss';

interface ChatPromptProps {
    enabled: boolean,
    chatId?: string,
}

export const ChatPrompt = memo(({ chatId, enabled }: ChatPromptProps) => {
    const [promptValue, setPromptValue] = useState('');
    const [inputCompleting, setInputCompleting] = useState(false);
    const dispatch = useEcaDispatch();

    const defaultBehavior = useSelector((state: State) => state.server.config.chat.defaultBehavior);
    const behaviors = useSelector((state: State) => state.server.config.chat.behaviors || []);
    const defaultModel = useSelector((state: State) => state.server.config.chat.defaultModel);
    const models = useSelector((state: State) => state.server.config.chat.models || []);

    const [selectedModel, setSelectedModel] = useState(defaultModel);
    const [selectedBehavior, setSelectedBehavior] = useState(defaultBehavior);

    const sendPromptValue = () => {
        const prompt = promptValue.trim();
        if (prompt && !inputCompleting && selectedModel && selectedBehavior) {
            dispatch(sendPrompt({ prompt: prompt, chatId, model: selectedModel, behavior: selectedBehavior }));
            setPromptValue('')
        }
    }

    const handleModelChanged = (newModel: string) => {
        setSelectedModel(newModel);
    }

    const handleBehaviorChanged = (newBehavior: string) => {
        setSelectedBehavior(newBehavior);
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && enabled) {
            sendPromptValue();
            e.preventDefault();
        }
    }

    const inputRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [enabled, chatId]);

    const onPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPromptValue(event.target.value);
    }

    return (
        <div className="prompt-area">
            <ChatContexts enabled={enabled} chatId={chatId} />
            <ChatCommands
                input={inputRef.current}
                chatId={chatId}
                onCommandSelected={(command) => {
                    setPromptValue(`/${command.name} `);
                    inputRef.current?.focus();
                }}
                onCompleting={setInputCompleting}
            />
            <textarea
                ref={inputRef}
                autoFocus
                value={promptValue}
                onChange={onPromptChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask, plan, build..."
                className="field"
            />
            {enabled && (
                <div>
                    <SelectBox
                        id="select-behavior"
                        defaultOption={selectedBehavior}
                        onSelected={handleBehaviorChanged}
                        options={behaviors}
                    />
                    <SelectBox
                        id="select-model"
                        defaultOption={selectedModel}
                        onSelected={handleModelChanged}
                        options={models}
                    />
                </div>
            )}
            <div className="spacing"></div>
            <div className="send"><i onClick={sendPromptValue} className="codicon codicon-send"></i></div>
        </div>
    );
});
