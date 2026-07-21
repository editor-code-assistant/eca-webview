import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { SyncLoader } from "react-spinners";
import { useStickyString, useWebviewListener, webviewSend, webviewSendAndGet } from "../../hooks";
import { State, useEcaDispatch } from "../../redux/store";
import { answerQuestion, cancelQuestion, listChats, sendPrompt, steerPrompt, steerPromptRemove, stopPrompt } from "../../redux/thunks/chat";
import { addContext, clearPrefillPrompt, enqueuePendingPrompt, dequeuePendingPrompt, pushPromptHistory, setSteerMessage } from "../../redux/slices/chat";
import { selectInitProgressString, setSelectedVariant } from "../../redux/slices/server";
import { SelectBox } from "../components/SelectBox";
import { ChatCommands } from "./ChatCommands";
import { ChatContexts } from "./ChatContexts";
import { ChatFileMentions } from "./ChatFileMentions";
import { ChatResumePicker } from "../components/ChatResumePicker";
import './ChatPrompt.scss';
import { ChatCommand } from "../../protocol";
import { editorReadInput } from "../../redux/thunks/editor";

interface ChatPromptProps {
    enabled: boolean,
    chatId: string,
    heroMode?: boolean,
}

export const ChatPrompt = memo(({ chatId, enabled, heroMode }: ChatPromptProps) => {
    const [promptValue, setPromptValue] = useState('');
    const [commandCompleting, setCommandCompleting] = useState(false);
    const [fileCompleting, setFileCompleting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    // One-shot shake played when the user presses Enter while the server
    // isn't Running. Controlled from handleKeyDown; reset via setTimeout
    // after the CSS animation duration defined in ChatPrompt.scss.
    const [shake, setShake] = useState(false);
    const inputCompleting = commandCompleting || fileCompleting;
    const dispatch = useEcaDispatch();

    // Prompt history navigation
    const promptHistory = useSelector((state: State) => state.chat.promptHistory);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [draftPrompt, setDraftPrompt] = useState('');

    // Per-chat selection (set by scoped `config/updated` payloads — see
    // applyConfigToChat in src/redux/slices/chat.ts). When unset on a
    // freshly minted chat we fall back to the global last-known mirrors
    // on `state.server.config.chat` so every new chat starts with the
    // session defaults.
    const perChatSelectedModel = useSelector((state: State) => state.chat.chats[chatId]?.selectedModel);
    const perChatSelectedAgent = useSelector((state: State) => state.chat.chats[chatId]?.selectedAgent);
    const perChatSelectedVariant = useSelector((state: State) => state.chat.chats[chatId]?.selectedVariant);

    const globalSelectAgent = useSelector((state: State) => state.server.config.chat.selectAgent);
    const agents = useSelector((state: State) => state.server.config.chat.agents || []);
    const globalSelectModel = useSelector((state: State) => state.server.config.chat.selectModel);
    const models = useSelector((state: State) => state.server.config.chat.models || []);
    const variants = useSelector((state: State) => state.server.config.chat.variants || []);
    const globalSelectedVariant = useSelector((state: State) => state.server.config.chat.selectedVariant);

    const selectModel = perChatSelectedModel ?? globalSelectModel;
    const selectAgent = perChatSelectedAgent ?? globalSelectAgent;
    const selectedVariant = perChatSelectedVariant !== undefined ? perChatSelectedVariant : globalSelectedVariant;

    const [selectedModel, setSelectedModel] = useState<string>();
    const [selectedAgent, setSelectedAgent] = useState<string>();

    const currentProgress = useSelector((state: State) => state.chat.chats[chatId]?.progress);
    const loading = currentProgress !== undefined;

    // Resume picker. Visible only on an empty chat once we know the
    // server has resumable chats; the cache itself lives on the redux
    // slice (`state.chat.resumableChats`) so the picker can render
    // immediately without a second RPC roundtrip. We refetch whenever
    // we land in a new empty chat to keep `relativeTime()` honest.
    const [resumePickerOpen, setResumePickerOpen] = useState(false);
    const chatIsEmpty = useSelector((state: State) => !!state.chat.chats[chatId]?.isEmpty);
    const chatMessagesEmpty = useSelector((state: State) => (state.chat.chats[chatId]?.messages?.length ?? 0) === 0);
    const resumableChats = useSelector((state: State) => state.chat.resumableChats);
    const isResumableSlot = chatIsEmpty && chatMessagesEmpty;
    const showResumeHint = enabled && isResumableSlot && !currentProgress && (resumableChats?.length ?? 0) > 0;

    // ECA server init-progress line (eca-emacs parity). When the server
    // is still starting up, we prefer this live "N/M · title" over the
    // static "Waiting for ECA server…" so the user can see what the
    // server is actually doing — e.g. "Loading models 2/5". When the
    // server is Running, this selector returns null and the hint is
    // hidden entirely by the `!enabled` guard around the block.
    //
    // `useStickyString` smooths out the rapid start→finish churn of a
    // fast ECA boot so titles don't flicker through for <100 ms each
    // and the whole line doesn't flash in and back out on the same
    // frame. See the hook's comment for minShow/trailingMs semantics.
    const initProgress = useStickyString(useSelector(selectInitProgressString));

    const onStop = () => {
        dispatch(stopPrompt({ chatId }));
    };
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
    const steerMessage = useSelector((state: State) => state.chat.chats[chatId]?.steerMessage);
    const pendingQuestion = useSelector((state: State) => state.chat.chats[chatId]?.pendingQuestion);
    const isAnswerMode = !!pendingQuestion && !pendingQuestion.answer && !pendingQuestion.cancelled && !!pendingQuestion.allowFreeform;
    const isQuestionPending = !!pendingQuestion && !pendingQuestion.answer && !pendingQuestion.cancelled;

    // Fetch the resumable-chats list whenever the user is sitting in
    // an empty placeholder. Cheap when the cache is already populated
    // (the thunk just overwrites it with the latest); does nothing
    // useful while the server isn't running yet (the host returns an
    // error envelope, the thunk sets the cache to `[]`, and the hint
    // stays hidden). Re-fires on `chatId` change so a brand-new "+"
    // chat picks up a fresh list.
    useEffect(() => {
        if (enabled && isResumableSlot) {
            dispatch(listChats());
        }
    }, [enabled, isResumableSlot, chatId]);

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
        if (!prompt || inputCompleting) return;

        // Answer mode: send as question answer instead of chat prompt
        if (isAnswerMode) {
            dispatch(answerQuestion({ chatId, answer: prompt }));
            setPromptValue('');
            return;
        }

        if (selectedAgent) {
            dispatch(pushPromptHistory(prompt));
            setHistoryIndex(-1);
            setDraftPrompt('');
            if (loading) {
                dispatch(steerPrompt({ chatId, message: prompt }));
                dispatch(setSteerMessage({ chatId, message: prompt }));
            } else {
                dispatch(sendPrompt({ prompt: prompt, chatId, model: selectedModel, agent: selectedAgent, variant: selectedVariant }));
            }
            setPromptValue('')
        }
    }

    const queuePromptValue = () => {
        const prompt = promptValue.trim();
        if (prompt && loading) {
            dispatch(pushPromptHistory(prompt));
            setHistoryIndex(-1);
            setDraftPrompt('');
            dispatch(enqueuePendingPrompt({ chatId, prompt }));
            setPromptValue('');
        }
    }

    const handleModelChanged = (newModel: string) => {
        setSelectedModel(newModel);
        // Include the currently-selected chat id so the server can
        // persist the model on `[:chats chat-id]` and emit a scoped
        // `config/updated` back. The chatId field is optional on the
        // wire — older servers that don't understand it will fall
        // through to the legacy session-wide path.
        webviewSend('chat/selectedModelChanged', {
            ...(chatId ? { chatId } : {}),
            model: newModel,
            ...(selectedVariant ? { variant: selectedVariant } : {}),
        });
    }

    const handleAgentChanged = (newAgent: string) => {
        setSelectedAgent(newAgent);
        webviewSend('chat/selectedAgentChanged', {
            ...(chatId ? { chatId } : {}),
            agent: newAgent,
        });
    }

    const handleVariantChanged = (newVariant: string) => {
        dispatch(setSelectedVariant(newVariant === 'No variant' ? null : newVariant));
    }

    const variantOptions = ['No variant', ...[...variants].sort()];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // ── Escape: layered cancel ──
        //
        // Completion menus (slash commands, @file mentions) attach their own
        // keydown listeners with stopPropagation(), so this branch only runs
        // when no completion menu is open.
        //   1. Cancel a pending askQuestion (both select-option and answer mode).
        //   2. Stop an in-flight generation.
        //   3. Blur the textarea so window-level shortcuts work.
        if (e.key === "Escape" && !inputCompleting) {
            if (isQuestionPending || isAnswerMode) {
                dispatch(cancelQuestion({ chatId }));
                e.preventDefault();
                return;
            }
            if (loading) {
                dispatch(stopPrompt({ chatId }));
                e.preventDefault();
                return;
            }
            (e.target as HTMLTextAreaElement).blur();
            return;
        }

        // ── Server not ready: Enter is a no-op ──
        //
        // The textarea itself stays editable (drafts survive startup) but
        // pressing Enter must NOT submit and, crucially, must NOT insert a
        // newline (the textarea's default behavior). This single branch
        // swallows Enter + any modifier (plain, Shift, Ctrl, Meta) and
        // triggers a short shake on the prompt card as passive feedback.
        if (!enabled && e.key === "Enter") {
            e.preventDefault();
            setShake(true);
            // Duration matches the prompt-shake keyframes in ChatPrompt.scss.
            window.setTimeout(() => setShake(false), 320);
            return;
        }

        if (e.key === "Enter" && e.ctrlKey && enabled) {
            queuePromptValue();
            e.preventDefault();
            return;
        }
        if (e.key === "Enter" && !e.shiftKey && enabled) {
            sendPromptValue();
            e.preventDefault();
            return;
        }

        // Don't cycle history while a completion menu is open
        if (inputCompleting) return;

        // Prompt history: Up/Down arrows only when cursor is at the very
        // start (ArrowUp) or very end (ArrowDown) of the text. This avoids
        // hijacking arrow navigation on visually-wrapped long lines.
        const textarea = e.target as HTMLTextAreaElement;
        const cursorAtStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
        const cursorAtEnd = textarea.selectionStart === promptValue.length;
        if (e.key === "ArrowUp" && cursorAtStart && promptHistory.length > 0) {
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

        if (e.key === "ArrowDown" && cursorAtEnd && historyIndex !== -1) {
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

    // One-shot prompt prefill (e.g. the text of a rolled-back message).
    const prefillPrompt = useSelector((state: State) => state.chat.chats[chatId]?.prefillPrompt);
    useEffect(() => {
        if (prefillPrompt !== undefined) {
            setPromptValue(prefillPrompt);
            dispatch(clearPrefillPrompt(chatId));
            inputRef.current?.focus();
        }
    }, [prefillPrompt, chatId]);

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

        const args = command.arguments ?? [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
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

    const sendDisabled = !enabled || inputCompleting || !promptValue.trim() || (isQuestionPending && !isAnswerMode);

    const placeholderText = isAnswerMode
        ? "Answer>"
        : isQuestionPending
            ? "Select an option above..."
            : selectedAgent === 'plan'
                ? "Plan, research, explore..."
                : selectedAgent === 'code'
                    ? "Code, ask, build..."
                    : "Ask, plan, build...";

    return (
        <motion.div
            layout="position"
            layoutDependency={heroMode}
            transition={{
                layout: {
                    type: "spring",
                    stiffness: 260,
                    damping: 34,
                    mass: 0.9,
                },
            }}
            className={['prompt-area', heroMode && 'hero', isFocused && 'focused', loading && 'running', waitingApproval && 'waiting-approval', !enabled && 'waiting', shake && 'shake'].filter(Boolean).join(' ')}
        >
            <AnimatePresence initial={false}>
                {currentProgress && (
                    <motion.div
                        key="progress-area"
                        className="progress-area"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                        <p>{currentProgress}</p>
                        <SyncLoader className="spinner" size={2} />
                        <div className="divider"></div>
                        <span onClick={onStop} className="stop">Stop</span>
                    </motion.div>
                )}
                {showResumeHint && (
                    <motion.div
                        key="resume-hint"
                        className="resume-hint"
                        role="button"
                        tabIndex={0}
                        aria-label={`Resume a previous chat (${resumableChats!.length} available)`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        onClick={() => setResumePickerOpen(true)}
                        onKeyDown={(e) => {
                            // Keyboard parity with the click handler — Enter
                            // and Space open the picker. We deliberately
                            // don't bind these on the wrapping prompt card
                            // so users typing in the textarea above aren't
                            // hijacked.
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setResumePickerOpen(true);
                            }
                        }}
                    >
                        <i className="codicon codicon-history" />
                        <span className="resume-hint-text">Resume a previous chat</span>
                        <span className="resume-hint-count">{resumableChats!.length}</span>
                    </motion.div>
                )}
            </AnimatePresence>
            {resumePickerOpen && resumableChats && (
                <ChatResumePicker
                    chats={resumableChats}
                    originatingChatId={chatId}
                    onClose={() => setResumePickerOpen(false)}
                />
            )}
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
                placeholder={placeholderText}
                className="field"
                disabled={isQuestionPending && !isAnswerMode}
                aria-label={isAnswerMode ? "Answer question" : "Chat prompt"}
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
            {!enabled && (
                // Inline "waiting for server" hint shown in place of the
                // toolbar. Gives users who are already focused on the
                // prompt a local explanation for why Enter is inert —
                // without requiring them to look back up at the main
                // startup-card. When the server has started emitting
                // $/progress notifications we swap the generic copy for
                // the live "N/M · title" line so the hint and the main
                // indicator stop repeating the same generic message
                // (before this wiring the user would see "Starting ECA
                // server…" AND "Waiting for ECA server…" at once).
                //
                // AnimatePresence + motion.span cross-fades the text
                // whenever the displayed string changes (e.g. progress
                // appearing, new title, then falling back to the
                // generic copy once init settles). The status-dot is
                // intentionally kept outside the animated element so
                // its pulse animation isn't interrupted on every swap.
                <div className="prompt-waiting-hint" aria-hidden="true">
                    <span className="status-dot" />
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={initProgress ?? 'waiting'}
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                            {initProgress ?? 'Waiting for ECA server…'}
                        </motion.span>
                    </AnimatePresence>
                </div>
            )}
            {steerMessage && (
                <div className="steer-indicator" title={steerMessage}>
                    <span
                        className="steer-text"
                        onClick={() => {
                            // Edit: pull the pending steer back into the input.
                            dispatch(steerPromptRemove({ chatId }));
                            setPromptValue(steerMessage);
                            inputRef.current?.focus();
                        }}
                    >
                        Steering: {steerMessage.length > 40 ? steerMessage.substring(0, 40) + '...' : steerMessage}
                    </span>
                    <button
                        className="steer-remove"
                        onClick={() => dispatch(steerPromptRemove({ chatId }))}
                        title="Remove steering message"
                        aria-label="Remove steering message"
                    >
                        <i className="codicon codicon-close" />
                    </button>
                </div>
            )}
            {pendingPrompts.length > 0 && (
                <div className="queue-indicator">Queued: {pendingPrompts.length} message{pendingPrompts.length > 1 ? 's' : ''}</div>
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
        </motion.div>
    );
});
