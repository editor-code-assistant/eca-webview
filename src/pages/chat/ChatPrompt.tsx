import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useWebviewListener, webviewSend, webviewSendAndGet } from "../../hooks";
import { State, useEcaDispatch } from "../../redux/store";
import { sendPrompt } from "../../redux/thunks/chat";
import { addContext, enqueuePendingPrompt, dequeuePendingPrompt, pushPromptHistory } from "../../redux/slices/chat";
import { setSelectedVariant } from "../../redux/slices/server";
import { SelectBox } from "../components/SelectBox";
import { ChatCommands } from "./ChatCommands";
import { ChatContexts } from "./ChatContexts";
import { ChatFileMentions } from "./ChatFileMentions";
import './ChatPrompt.scss';
import { ChatCommand } from "../../protocol";
import { editorReadInput } from "../../redux/thunks/editor";

interface ChatPromptProps {
    enabled: boolean,
    chatId: string,
}

export const ChatPrompt = memo(({ chatId, enabled }: ChatPromptProps) => {
    const [promptValue, setPromptValue] = useState('');
    const [commandCompleting, setCommandCompleting] = useState(false);
    const [fileCompleting, setFileCompleting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const inputCompleting = commandCompleting || fileCompleting;
    const dispatch = useEcaDispatch();

    // Prompt history navigation
    const promptHistory = useSelector((state: State) => state.chat.promptHistory);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [draftPrompt, setDraftPrompt] = useState('');

    const selectAgent = useSelector((state: State) => state.server.config.chat.selectAgent);
    const agents = useSelector((state: State) => state.server.config.chat.agents || []);
    const selectModel = useSelector((state: State) => state.server.config.chat.selectModel);
    const models = useSelector((state: State) => state.server.config.chat.models || []);
    const variants = useSelector((state: State) => state.server.config.chat.variants || []);
    const selectedVariant = useSelector((state: State) => state.server.config.chat.selectedVariant);

    const [selectedModel, setSelectedModel] = useState<string>();
    const [selectedAgent, setSelectedAgent] = useState<string>();

    const loading = useSelector((state: State) => state.chat.chats[chatId]?.progress != undefined);
    const waitingApproval = useSelector((state: State) => {
        const messages = state.chat.chats[chatId]?.messages ?? [];
        return messages.some(msg => {
            if (msg.type !== 'toolCall') return false;
            if (msg.status === 'run' && msg.manualApproval) return true;
            return msg.subagentMessages?.some(
                sub => sub.type === 'toolCall' && sub.status === 'run' && sub.manualApproval
            ) ?? false;
        });
    });
    const pendingPrompts = useSelector((state: State) => state.chat.chats[chatId]?.pendingPrompts || []);

    useEffect(() => {
        if (selectModel !== undefined) {
            setSelectedModel(selectModel);
        }
    }, [selectModel]);

    useEffect(() => {
        if (selectAgent !== undefined) {
            setSelectedAgent(selectAgent);
        }
    }, [selectAgent]);

    // Auto-send queued prompts when loading finishes
    useEffect(() => {
        if (!loading && pendingPrompts.length > 0 && selectedAgent) {
            const nextPrompt = pendingPrompts[0];
            dispatch(dequeuePendingPrompt(chatId));
            dispatch(sendPrompt({ prompt: nextPrompt, chatId, model: selectedModel, agent: selectedAgent, variant: selectedVariant }));
        }
    }, [loading]);

    const sendPromptValue = () => {
        const prompt = promptValue.trim();
        if (prompt && !inputCompleting && selectedAgent) {
            dispatch(pushPromptHistory(prompt));
            setHistoryIndex(-1);
            setDraftPrompt('');
            if (loading) {
                dispatch(enqueuePendingPrompt({ chatId, prompt }));
            } else {
                dispatch(sendPrompt({ prompt: prompt, chatId, model: selectedModel, agent: selectedAgent, variant: selectedVariant }));
            }
            setPromptValue('')
        }
    }

    const handleModelChanged = (newModel: string) => {
        setSelectedModel(newModel);
        webviewSend('chat/selectedModelChanged', {
            model: newModel,
            ...(selectedVariant ? { variant: selectedVariant } : {}),
        });
    }

    const handleAgentChanged = (newAgent: string) => {
        setSelectedAgent(newAgent);
        webviewSend('chat/selectedAgentChanged', {
            agent: newAgent,
        });
    }

    const handleVariantChanged = (newVariant: string) => {
        dispatch(setSelectedVariant(newVariant === 'No variant' ? null : newVariant));
    }

    const variantOptions = ['No variant', ...[...variants].sort()];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && enabled) {
            sendPromptValue();
            e.preventDefault();
            return;
        }

        // Don't cycle history while a completion menu is open
        if (inputCompleting) return;

        // Prompt history: Up/Down arrows when textarea has no multi-line content
        const isMultiLine = promptValue.includes('\n');
        if (e.key === "ArrowUp" && !isMultiLine && promptHistory.length > 0) {
            e.preventDefault();
            if (historyIndex === -1) {
                setDraftPrompt(promptValue);
                const newIndex = promptHistory.length - 1;
                setHistoryIndex(newIndex);
                setPromptValue(promptHistory[newIndex]);
            } else if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setPromptValue(promptHistory[newIndex]);
            }
            return;
        }

        if (e.key === "ArrowDown" && !isMultiLine && historyIndex !== -1) {
            e.preventDefault();
            if (historyIndex < promptHistory.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setPromptValue(promptHistory[newIndex]);
            } else {
                setHistoryIndex(-1);
                setPromptValue(draftPrompt);
            }
            return;
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
        // Reset history browsing when the user types manually
        if (historyIndex !== -1) {
            setHistoryIndex(-1);
            setDraftPrompt('');
        }
    }

    const onPaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;
                const mimeType = item.type;

                const reader = new FileReader();
                reader.onload = async () => {
                    const dataUri = reader.result as string;
                    // Strip the data:image/...;base64, prefix to get raw base64
                    const base64Data = dataUri.replace(/^data:[^;]+;base64,/, '');
                    try {
                        const result = await webviewSendAndGet('editor/saveClipboardImage', {
                            base64Data,
                            mimeType,
                        });
                        if (result?.path) {
                            dispatch(addContext({
                                context: { type: 'file', path: result.path },
                                prompt: 'system',
                            }));
                        }
                    } catch (err) {
                        console.error('Failed to save clipboard image:', err);
                    }
                };
                reader.readAsDataURL(file);
                break; // only handle first image
            }
        }
    }, [dispatch]);

    const onFileSelected = (path: string, replaceStart: number, replaceEnd: number) => {
        const before = promptValue.substring(0, replaceStart);
        const after = promptValue.substring(replaceEnd);
        setPromptValue(before + path + after);
        inputRef.current?.focus();
    };

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

    const sendDisabled = !enabled || inputCompleting || !promptValue.trim();

    return (
        <div className={['prompt-area', isFocused && 'focused', loading && 'running', waitingApproval && 'waiting-approval'].filter(Boolean).join(' ')}>
            <ChatContexts enabled={enabled} chatId={chatId} />
            <ChatCommands
                input={inputRef.current}
                chatId={chatId}
                onCommandSelected={onCommandSelected}
                onCompleting={setCommandCompleting}
            />
            <ChatFileMentions
                input={inputRef.current}
                chatId={chatId}
                promptValue={promptValue}
                onFileSelected={onFileSelected}
                onCompleting={setFileCompleting}
            />
            <textarea
                ref={inputRef}
                autoFocus
                value={promptValue}
                onChange={onPromptChange}
                onKeyDown={handleKeyDown}
                onPaste={onPaste}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Ask, plan, build..."
                className="field"
                aria-label="Chat prompt"
            />
            {enabled && (
                <div className="toolbar">
                    <SelectBox
                        id="select-agent"
                        defaultOption={selectedAgent}
                        onSelected={handleAgentChanged}
                        options={agents}
                        title="Select agent"
                    />
                    <SelectBox
                        id="select-model"
                        defaultOption={selectedModel}
                        onSelected={handleModelChanged}
                        options={models}
                        title="Select model"
                    />
                    <SelectBox
                        id="select-variant"
                        defaultOption={selectedVariant || 'No variant'}
                        onSelected={handleVariantChanged}
                        options={variantOptions}
                        title="Select variant"
                    />
                </div>
            )}
            <div className="spacing"></div>
            <div className="send">
                <i
                    onClick={sendDisabled ? undefined : sendPromptValue}
                    className={`codicon codicon-send${sendDisabled ? ' disabled' : ''}`}
                    role="button"
                    aria-label="Send message"
                    aria-disabled={sendDisabled}
                    tabIndex={sendDisabled ? -1 : 0}
                />
            </div>
        </div>
    );
});
