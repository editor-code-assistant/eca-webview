import type { ITooltip, TooltipRefProps } from "react-tooltip";
import { Tooltip } from "react-tooltip";
import './ToolTip.css';
import type { RefAttributes } from "react";

export function ToolTip(props: (ITooltip & RefAttributes<TooltipRefProps>)) {
    const className = `${props.className ?? ''} eca-tooltip`.trim();
    return (
        <Tooltip
            {...props}
            className={className}
            noArrow
            opacity={1}
            delayHide={props.delayHide ?? 0}
            delayShow={props.delayShow ?? 500} />
    );
}
