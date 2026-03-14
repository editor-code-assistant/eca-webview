import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import './ChatCollapsableMessage.scss';

interface Props {
    className: string,
    header: (toggleOpen: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void) => React.ReactNode,
    content?: React.ReactNode,
    defaultOpen?: boolean,
}

export const ChatCollapsableMessage = memo(({ header, content, className, defaultOpen }: Props) => {
    const [open, setOpen] = useState(defaultOpen || false);

    const toggleOpen = (_event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        setOpen(!open);
    }

    return (
        <div className={`collapsable ${open ? 'open' : ''} ${className}`}>
            <div onClick={toggleOpen} className="header">
                <motion.i
                    className="chrevron codicon codicon-chevron-right"
                    animate={{ rotate: open ? 90 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    onClick={toggleOpen}
                />
                {header(toggleOpen)}
            </div>
            <AnimatePresence initial={defaultOpen}>
                {open && (
                    <motion.div
                        className="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.15 } }}
                        style={{ overflow: "hidden" }}
                    >
                        {content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

});
