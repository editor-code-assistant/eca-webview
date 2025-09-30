import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { State, useEcaDispatch } from "../../redux/store";
import { sendPrompt } from "../../redux/thunks/chat";
import { SelectBox } from "../components/SelectBox";
import { ChatCommands } from "./ChatCommands";
import { ChatContexts } from "./ChatContexts";
import './ChatPrompt.scss';
import { ChatCommand } from "../../protocol";
import { editorReadInput } from "../../redux/thunks/editor";

interface ChatPromptProps {
    enabled: boolean,
    chatId: string,
}

export const ChatPrompt = memo(({ chatId, enabled }: ChatPromptProps) => {
    const [promptValue, setPromptValue] = useState('');
    const [inputCompleting, setInputCompleting] = useState(false);
    const dispatch = useEcaDispatch();

    const selectBehavior = useSelector((state: State) => state.server.config.chat.selectBehavior);
    const behaviors = useSelector((state: State) => state.server.config.chat.behaviors || []);
    const selectModel = useSelector((state: State) => state.server.config.chat.selectModel);
    const models = useSelector((state: State) => state.server.config.chat.models || []);

    const [selectedModel, setSelectedModel] = useState<string>();
    const [selectedBehavior, setSelectedBehavior] = useState<string>();

    useEffect(() => {
        if (selectedModel === undefined && selectModel !== undefined) {
            setSelectedModel(selectModel);
        }
    }, [selectModel]);

    useEffect(() => {
        if (selectedBehavior === undefined && selectBehavior !== undefined) {
            setSelectedBehavior(selectBehavior);
        }
    }, [selectBehavior]);

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
        inputRef.current?.focus();
    }, [enabled, chatId]);

    const onPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPromptValue(event.target.value);
    }

    const onCommandSelected = async (command: ChatCommand) => {
        inputRef.current?.focus();
        let prompt = `/${command.name}`;
        setPromptValue(prompt)

        for (let i = 0; i < command.arguments.length; i++) {
            const arg = command.arguments[i];
            prompt += " ";
            const message = `Arg: ${arg.name}\nDescription: ${arg.description}\n\nInput value:`;
            const userArgInput = (await dispatch(editorReadInput({ message: message }))).payload as (string | null);

            if (userArgInput) {
                if (userArgInput.indexOf(' ') >= 0) {
                    prompt += `"${userArgInput}"`;
                } else {
                    prompt += userArgInput;
                }
                setPromptValue(prompt)
            }
        }
        setPromptValue(prompt);
        inputRef.current?.focus();
    }

    return (
        <div className="prompt-area">
            <ChatContexts enabled={enabled} chatId={chatId} />
            <ChatCommands
                input={inputRef.current}
                chatId={chatId}
                onCommandSelected={onCommandSelected}
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
