import { memo, useRef, useState } from 'react';
import { TooltipRefProps } from 'react-tooltip';
import './SelectBox.scss';
import { ToolTip } from './ToolTip';

interface ISelectBox {
    id: string,
    className?: string,
    options: string[];
    defaultOption?: string;
    onSelected: (option: string) => void;
}

export const SelectBox = memo(({ id, options, defaultOption, onSelected, className }: ISelectBox) => {
    const ref = useRef<TooltipRefProps>(null);
    const [selected, setSelected] = useState(false);

    const onSelectedOption = (option: string) => {
        onSelected(option);
        ref.current?.close();
        setSelected(false);
    };

    return (
        <div style={{ display: 'inline-block' }} className={className}>
            <button onClick={() => setSelected(!selected)} data-tooltip-id={id} className={`select-box-button ${selected ? 'selected' : ''}`}>{defaultOption || options[0]}</button>
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
                {options.map((option) => (
                    <span onClick={() => onSelectedOption(option)}
                        key={`select-option-${option}`}
                        className="option">
                        {option}
                    </span>
                ))}
            </ToolTip>
        </div>
    );
});
