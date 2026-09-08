import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { TooltipRefProps } from "react-tooltip";
import { ChatCommand } from "../../protocol";
import { State, useEcaDispatch } from "../../redux/store";
import { queryCommands } from "../../redux/thunks/chat";
import { ToolTip } from "../components/ToolTip";
import './ChatCommands.scss';
import './ChatContexts.scss';

interface Props {
    chatId: string,
    input: HTMLTextAreaElement | null,
    onCommandSelected: (cmd: ChatCommand) => void,
    onCompleting: (completing: boolean) => void,
}

function icon(command: ChatCommand): React.ReactNode {
    let icon = '';
    switch (command.type) {
        case 'mcpPrompt':
            icon = 'debug-line-by-line';
            break;
        case 'native':
            icon = 'menu';
            break;
        default:
            icon = 'question';
            break;
    }

    return (<i className={`icon ${command.type} codicon codicon-${icon}`}></i>);
}

function isCommand(input: HTMLTextAreaElement | null): boolean {
    return input?.value.startsWith('/') || false;
}

export const ChatCommands = memo(({ chatId, input, onCommandSelected, onCompleting }: Props) => {
    const dispatch = useEcaDispatch();
    const openPopupRef = useRef<TooltipRefProps>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [show, setShow] = useState(false);
    const commands = useSelector((state: State) => state.chat.commands);

    const promptValue = input?.value;
    const query = promptValue?.substring(1) || '';

    useEffect(() => {
        if (isCommand(input)) {
            dispatch(queryCommands({
                chatId,
                query: query,
            }));
        }
    }, [promptValue]);

    useEffect(() => {
        if (show) {
            openPopupRef.current?.open({ anchorSelect: '.prompt-area .field', });
            onCompleting(true);
        } else {
            openPopupRef.current?.close();
            onCompleting(false);
        }
    }, [show]);

    const selectCommand = (command: ChatCommand, event: any) => {
        setShow(false);
        event.preventDefault();
        onCommandSelected(command);
    }

    useEffect(() => {
        setSelectedIndex(0);
    }, [commands?.length]);

    useEffect(() => {
        if (!input) return;

        // Only user-driven events may open the popup: typing (native
        // `input`) and focusing the field. Programmatic value changes —
        // prompt history navigation, prefill, command insertion — never
        // do; otherwise restoring a `/command` from history popped the
        // list open and its ArrowUp/ArrowDown handlers below swallowed
        // the next history keystrokes.
        const updateShow = () => {
            setShow(isCommand(input) && !input.value.includes(' '));
        }
        const handleBlur = () => setShow(false);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!show || !commands || commands.length === 0) return;
            if (e.key === "ArrowDown") {
                setSelectedIndex((prev) => (prev + 1) % commands.length);
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
                e.preventDefault();
            } else if ((e.key === "Enter" || e.key === "Tab") && commands[selectedIndex]) {
                selectCommand(commands[selectedIndex], e)
            } else if (e.key === "Escape") {
                setShow(false);
                e.preventDefault();
            }
        };

        input.addEventListener('input', updateShow);
        input.addEventListener('focus', updateShow);
        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);
        return () => {
            input.removeEventListener('input', updateShow);
            input.removeEventListener('focus', updateShow);
            input.removeEventListener('blur', handleBlur);
            input.removeEventListener('keydown', handleKeyDown);
        };
        // `show` must be a dep: handleKeyDown closes over it, and without it
        // Escape (show=false, same value) left a stale handler that still
        // treated the next Enter as a command selection.
    }, [input, show, commands, selectedIndex, onCommandSelected]);

    return show ? (
        <ToolTip
            ref={openPopupRef}
            delayHide={0}
            delayShow={0}
            globalCloseEvents={{ escape: true, clickOutsideAnchor: true }}
            imperativeModeOnly
            clickable
            className="scrollable commands-container"
            place="top-start">
            <ul className="commands">
                {commands && commands.map((command, index) => (
                    <li onClick={(e) => selectCommand(command, e)}
                        onMouseDown={(e) => selectCommand(command, e)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        key={index}
                        className={`item ${index === selectedIndex ? 'selected' : ''}`}>
                        {icon(command)}
                        <span className="label">{command.name}</span>
                        <span className="args">({(command.arguments ?? []).map((a) => a.name).join(', ')})</span>
                        <span className="description">{command.description}</span>
                    </li>
                ))}
            </ul>
        </ToolTip>
    ) : null;
});
