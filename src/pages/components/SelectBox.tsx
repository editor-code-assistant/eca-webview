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
    const [selected, setSelected] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const currentOption = defaultOption || options[0];

    // When dropdown opens, highlight the current active option
    useEffect(() => {
        if (selected) {
            const activeIndex = options.indexOf(currentOption);
            setHighlightedIndex(activeIndex >= 0 ? activeIndex : 0);
        } else {
            setHighlightedIndex(-1);
        }
    }, [selected]);

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
