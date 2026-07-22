import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TooltipRefProps } from 'react-tooltip';
import './SelectBox.scss';
import { ToolTip } from './ToolTip';

interface ISelectBox {
    id: string,
    className?: string,
    options: string[];
    defaultOption?: string;
    onSelected: (option: string) => void;
    title?: string;
}

export const SelectBox = memo(({ id, options, defaultOption, onSelected, className, title }: ISelectBox) => {
    const ref = useRef<TooltipRefProps>(null);
    const optionRefs = useRef<(HTMLSpanElement | null)[]>([]);
    // Typeahead state: chars typed while the dropdown is open accumulate in
    // `buffer` and match options by prefix; `timer` clears it after a pause.
    const typeahead = useRef<{ buffer: string; timer?: ReturnType<typeof setTimeout> }>({ buffer: '' });
    const [selected, setSelected] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const currentOption = defaultOption || options[0];

    // When dropdown opens, highlight the current active option
    useEffect(() => {
        typeahead.current.buffer = '';
        if (selected) {
            const activeIndex = options.indexOf(currentOption);
            setHighlightedIndex(activeIndex >= 0 ? activeIndex : 0);
        } else {
            setHighlightedIndex(-1);
        }
    }, [selected]);

    // Clear any pending typeahead reset timer on unmount
    useEffect(() => {
        const state = typeahead.current;
        return () => {
            if (state.timer) {
                clearTimeout(state.timer);
            }
        };
    }, []);

    // Scroll highlighted option into view
    useEffect(() => {
        if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
            optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    const onSelectedOption = useCallback((option: string) => {
        onSelected(option);
        ref.current?.close();
        setSelected(false);
    }, [onSelected]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!selected) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => (i + 1) % options.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => (i - 1 + options.length) % options.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                    onSelectedOption(options[highlightedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                ref.current?.close();
                setSelected(false);
                break;
            default:
                // Typeahead: like a native <select>, typing jumps to the next
                // option starting with the typed prefix.
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    const state = typeahead.current;
                    if (state.timer) {
                        clearTimeout(state.timer);
                    }
                    state.buffer += e.key.toLowerCase();
                    state.timer = setTimeout(() => { state.buffer = ''; }, 700);

                    // Repeating the same char ("ooo") cycles through options
                    // starting with it; a growing prefix ("gpt") keeps
                    // narrowing from the currently highlighted option.
                    const repeated = state.buffer.length > 1 && [...state.buffer].every(c => c === state.buffer[0]);
                    const prefix = repeated ? state.buffer[0] : state.buffer;
                    const from = prefix.length === 1 ? highlightedIndex + 1 : highlightedIndex;
                    for (let offset = 0; offset < options.length; offset++) {
                        const index = (from + offset + options.length) % options.length;
                        if (options[index].toLowerCase().startsWith(prefix)) {
                            setHighlightedIndex(index);
                            break;
                        }
                    }
                }
                break;
        }
    }, [selected, highlightedIndex, options, onSelectedOption]);

    return (
        <div className={`select-box${className ? ` ${className}` : ''}`}>
            <button
                onClick={() => setSelected(!selected)}
                onKeyDown={handleKeyDown}
                data-tooltip-id={id}
                title={title}
                className={`select-box-button ${selected ? 'selected' : ''}`}
            >
                {currentOption}
            </button>
            <ToolTip id={id}
                ref={ref}
                delayHide={0}
                delayShow={0}
                globalCloseEvents={{ escape: true, clickOutsideAnchor: true }}
                closeEvents={{ click: true }}
                openOnClick
                className="select-tooltip scrollable"
                clickable
                place="top-start">
                {options.map((option, index) => (
                    <span onClick={() => onSelectedOption(option)}
                        ref={el => { optionRefs.current[index] = el; }}
                        key={`select-option-${option}`}
                        className={`option${option === currentOption ? ' active' : ''}${index === highlightedIndex ? ' highlighted' : ''}`}>
                        {option}
                    </span>
                ))}
            </ToolTip>
        </div>
    );
});
