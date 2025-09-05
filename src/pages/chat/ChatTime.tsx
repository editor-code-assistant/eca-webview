import './ChatTime.scss';

interface Props {
    ms: number,
}

export function ChatTime(props: Props) {
    const secs = (props.ms / 1000).toFixed(1);

    return (
        <span className="time">{secs}s</span>
    );
}
