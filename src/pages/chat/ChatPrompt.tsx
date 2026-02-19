import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useWebviewListener } from "../../hooks";
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

    const selectAgent = useSelector((state: State) => state.server.config.chat.selectAgent);
    const agents = useSelector((state: State) => state.server.config.chat.agents || []);
    const selectModel = useSelector((state: State) => state.server.config.chat.selectModel);
    const models = useSelector((state: State) => state.server.config.chat.models || []);

    const [selectedModel, setSelectedModel] = useState<string>();
    const [selectedAgent, setSelectedAgent] = useState<string>();

    const loading = useSelector((state: State) => state.chat.chats[chatId]?.progress != undefined);

    useEffect(() => {
        if (selectedModel === undefined && selectModel !== undefined) {
            setSelectedModel(selectModel);
        }
    }, [selectModel]);

    useEffect(() => {
        if (selectedAgent === undefined && selectAgent !== undefined) {
            setSelectedAgent(selectAgent);
        }
    }, [selectAgent]);

    const sendPromptValue = () => {
        const prompt = promptValue.trim();
        if (prompt && !inputCompleting && selectedAgent && !loading) {
            dispatch(sendPrompt({ prompt: prompt, chatId, model: selectedModel, agent: selectedAgent }));
            setPromptValue('')
        }
    }

    const handleModelChanged = (newModel: string) => {
        setSelectedModel(newModel);
    }

    const handleAgentChanged = (newAgent: string) => {
        setSelectedAgent(newAgent);
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

    useWebviewListener('chat/focusPrompt', () => {
        inputRef.current?.focus();
    });

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
                        id="select-agent"
                        defaultOption={selectedAgent}
                        onSelected={handleAgentChanged}
                        options={agents}
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
