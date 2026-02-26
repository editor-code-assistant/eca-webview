import { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { TooltipRefProps } from "react-tooltip";
import { ChatFile } from "../../protocol";
import { State, useEcaDispatch } from "../../redux/store";
import { queryFiles } from "../../redux/thunks/chat";
import { uriToPath } from "../../util";
import { ToolTip } from "../components/ToolTip";
import './ChatFileMentions.scss';
import './ChatContexts.scss';

interface Props {
    chatId: string,
    input: HTMLTextAreaElement | null,
    promptValue: string,
    onFileSelected: (path: string, replaceStart: number, replaceEnd: number) => void,
    onCompleting: (completing: boolean) => void,
}

interface HashQuery {
    query: string;
    start: number;
    end: number;
}

/**
 * Walk backward from cursor to find a `#` trigger.
 * Returns the query text between `#` and cursor, or null if no active trigger.
 */
function findHashQuery(input: HTMLTextAreaElement | null): HashQuery | null {
    if (!input) return null;
    const cursor = input.selectionStart;
    const text = input.value;

    // Walk backward from cursor
    let i = cursor - 1;
    while (i >= 0 && text[i] !== ' ' && text[i] !== '\n' && text[i] !== '\t' && text[i] !== '#') {
        i--;
    }

    if (i < 0 || text[i] !== '#') return null;

    // # must be at start of text or preceded by whitespace
    if (i > 0 && text[i - 1] !== ' ' && text[i - 1] !== '\n' && text[i - 1] !== '\t') return null;

    const query = text.substring(i + 1, cursor);
    return { query, start: i, end: cursor };
}

function relativeFilePath(path: string, workspaceFolders: { uri: string }[]): string {
    for (const root of workspaceFolders) {
        const rootPath = uriToPath(root.uri);
        if (path.startsWith(rootPath)) {
            return path.substring(rootPath.length).replace(/^\//, '');
        }
    }
    return path;
}

export const ChatFileMentions = memo(({ chatId, input, promptValue, onFileSelected, onCompleting }: Props) => {
    const dispatch = useEcaDispatch();
    const openPopupRef = useRef<TooltipRefProps>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [show, setShow] = useState(false);
    const [hashQuery, setHashQuery] = useState<HashQuery | null>(null);
    const files = useSelector((state: State) => state.chat.files);
    const workspaceFolders = useSelector((state: State) => state.server.workspaceFolders);

    // Check for # trigger on every input/cursor change
    useEffect(() => {
        const hq = findHashQuery(input);
        setHashQuery(hq);

        if (hq) {
            dispatch(queryFiles({ chatId, query: hq.query }));
        }
    }, [promptValue]);

    useEffect(() => {
        const shouldShow = hashQuery !== null && files !== undefined && files.length > 0;
        setShow(shouldShow);
    }, [hashQuery, files]);

    useEffect(() => {
        if (show) {
            openPopupRef.current?.open({ anchorSelect: '.prompt-area .field' });
            onCompleting(true);
        } else {
            openPopupRef.current?.close();
            onCompleting(false);
        }
    }, [show]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [files?.length]);

    const selectFile = (file: ChatFile, event: any) => {
        event.preventDefault();
        setShow(false);
        if (hashQuery) {
            onFileSelected(file.path, hashQuery.start, hashQuery.end);
        }
    };

    useEffect(() => {
        if (!input) return;

        const handleCursorMove = () => {
            const hq = findHashQuery(input);
            setHashQuery(hq);
            if (hq) {
                dispatch(queryFiles({ chatId, query: hq.query }));
            }
        };

        const handleBlur = () => setShow(false);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!show || !files || files.length === 0) return;
            if (e.key === "ArrowDown") {
                setSelectedIndex((prev) => (prev + 1) % files.length);
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                setSelectedIndex((prev) => (prev - 1 + files.length) % files.length);
                e.preventDefault();
            } else if ((e.key === "Enter" || e.key === "Tab") && files[selectedIndex]) {
                selectFile(files[selectedIndex], e);
            } else if (e.key === "Escape") {
                setShow(false);
                e.preventDefault();
            }
        };

        // Only listen for click (cursor position changes); text changes
        // are handled by the useEffect on [promptValue] above.
        input.addEventListener('click', handleCursorMove);
        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);

        return () => {
            input.removeEventListener('click', handleCursorMove);
            input.removeEventListener('blur', handleBlur);
            input.removeEventListener('keydown', handleKeyDown);
        };
    }, [input, show, files, selectedIndex, hashQuery]);

    return show ? (
        <ToolTip
            ref={openPopupRef}
            delayHide={0}
            delayShow={0}
            globalCloseEvents={{ escape: true, clickOutsideAnchor: true }}
            imperativeModeOnly
            clickable
            className="scrollable file-mentions-container"
            place="top-start">
            <ul className="file-mentions">
                {files && files.map((file, index) => (
                    <li onClick={(e) => selectFile(file, e)}
                        onMouseDown={(e) => selectFile(file, e)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        key={index}
                        className={`item ${index === selectedIndex ? 'selected' : ''}`}>
                        <i className="icon codicon codicon-file"></i>
                        <span className="label">{relativeFilePath(file.path, workspaceFolders)}</span>
                    </li>
                ))}
            </ul>
        </ToolTip>
    ) : null;
});
