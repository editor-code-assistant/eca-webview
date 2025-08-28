import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { webviewSend } from "../../hooks";
import { setSelectedBehavior, setSelectedModel } from "../../redux/slices/chat";
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

    const selectedBehavior = useSelector((state: State) => state.chat.selectedBehavior);
    const behaviors = useSelector((state: State) => state.chat.behaviors);
    const selectedModel = useSelector((state: State) => state.chat.selectedModel);
    const models = useSelector((state: State) => state.chat.models);

    const sendPromptValue = () => {
        const prompt = promptValue.trim();
        if (prompt && !inputCompleting) {
            dispatch(sendPrompt({ prompt: prompt, chatId }));
            setPromptValue('')
        }
    }

    const handleModelChanged = (newModel: string) => {
        webviewSend('chat/selectedModelChanged', { value: newModel });
        dispatch(setSelectedModel(newModel));
    }

    const handleBehaviorChanged = (newBehavior: string) => {
        webviewSend('chat/selectedBehaviorChanged', { value: newBehavior });
        dispatch(setSelectedBehavior(newBehavior));
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
