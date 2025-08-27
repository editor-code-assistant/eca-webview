import { Chat } from "./chat/Chat";

declare global {
  interface Window {
    mediaUrl: string;
    postMessageToEditor?: (message: any) => void;
  }
}

export default function GUI() {
    return (
        <Chat />
    );
}
