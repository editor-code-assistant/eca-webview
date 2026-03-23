import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import './ApprovalActions.scss';

interface ApprovalActionsProps {
    waitingApproval: boolean;
    onApprove: () => void;
    onApproveAndRemember: () => void;
    onReject: () => void;
}

/** Minimum drag distance (px) to trigger an action */
const SWIPE_THRESHOLD = 80;

/**
 * Shared approval actions component for tool call cards.
 *
 * Desktop: button rows with descriptions and keyboard shortcuts.
 * Mobile (≤767px): swipeable pill (RIGHT = approve, LEFT = reject)
 * with a compact "Accept & remember" link below.
 */
export function ApprovalActions({ waitingApproval, onApprove, onApproveAndRemember, onReject }: ApprovalActionsProps) {
    const x = useMotionValue(0);

    // Map drag offset to underlay opacity: right (positive x) → approve green, left (negative x) → reject red
    const approveOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
    const rejectOpacity = useTransform(x, [0, -SWIPE_THRESHOLD], [0, 1]);
    // Background tint follows the drag
    const pillBg = useTransform(
        x,
        [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD * 0.3, 0, SWIPE_THRESHOLD * 0.3, SWIPE_THRESHOLD * 1.5],
        [
            'rgba(241, 76, 76, 0.25)',    // reject red
            'rgba(241, 76, 76, 0.08)',
            'rgba(255, 255, 255, 0.04)',  // neutral
            'rgba(115, 201, 145, 0.08)',
            'rgba(115, 201, 145, 0.25)',  // approve green
        ],
    );

    const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
        const swipeDistance = info.offset.x;
        const velocity = info.velocity.x;

        // Right swipe (positive) = Approve — boost with velocity
        if (swipeDistance > SWIPE_THRESHOLD || (swipeDistance > 40 && velocity > 300)) {
            onApprove();
            return;
        }

        // Left swipe (negative) = Reject — boost with velocity
        if (swipeDistance < -SWIPE_THRESHOLD || (swipeDistance < -40 && velocity < -300)) {
            onReject();
            return;
        }

        // Below threshold → pill snaps back automatically via dragSnapToOrigin
    };

    return (
        <AnimatePresence>
            {waitingApproval && (
                <motion.div
                    className="approval-actions"
                    initial={{ opacity: 0, scale: 0.96, height: 0 }}
                    animate={{ opacity: 1, scale: 1, height: 'auto' }}
                    exit={{ opacity: 0, scale: 0.96, height: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28, opacity: { duration: 0.15 } }}
                    style={{ overflow: 'hidden' }}
                >
                    {/* ——— Desktop layout: button rows ——— */}
                    <div className="approval-desktop">
                        <div className="approval-option">
                            <button onClick={onApprove} className="approve-btn">Accept</button>
                            <span className="approval-description">for this session</span>
                            <span className="approval-shortcut">(Enter)</span>
                        </div>
                        <div className="approval-option">
                            <button onClick={onApproveAndRemember} className="approve-remember-btn">Accept and remember</button>
                            <span className="approval-description">for this session</span>
                            <span className="approval-shortcut">(Shift + Enter)</span>
                        </div>
                        <div className="approval-option">
                            <button onClick={onReject} className="reject-btn">Reject</button>
                            <span className="approval-description">and tell ECA what to do differently</span>
                            <span className="approval-shortcut">(Esc)</span>
                        </div>
                    </div>

                    {/* ——— Mobile layout: swipe card + remember button ——— */}
                    <div className="approval-mobile">
                        <div className="approval-swipe-container">
                            {/* Underlay indicators revealed during drag */}
                            <div className="swipe-underlay">
                                <motion.div className="swipe-indicator reject-indicator" style={{ opacity: rejectOpacity }}>
                                    <i className="codicon codicon-close" />
                                    <span>Reject</span>
                                </motion.div>
                                <motion.div className="swipe-indicator approve-indicator" style={{ opacity: approveOpacity }}>
                                    <span>Approve</span>
                                    <i className="codicon codicon-check" />
                                </motion.div>
                            </div>

                            {/* Draggable pill */}
                            <motion.div
                                className="swipe-pill"
                                drag="x"
                                dragSnapToOrigin
                                dragElastic={0.6}
                                dragMomentum={false}
                                onDragEnd={handleDragEnd}
                                style={{ x, backgroundColor: pillBg }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="swipe-hint-left">
                                    <i className="codicon codicon-arrow-left" />
                                    <span>Reject</span>
                                </span>
                                <span className="swipe-pill-label">swipe</span>
                                <span className="swipe-hint-right">
                                    <span>Approve</span>
                                    <i className="codicon codicon-arrow-right" />
                                </span>
                            </motion.div>
                        </div>

                        {/* Compact remember button below swipe */}
                        <button className="mobile-remember-btn" onClick={onApproveAndRemember}>
                            <i className="codicon codicon-pin" />
                            Accept &amp; remember for this session
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
