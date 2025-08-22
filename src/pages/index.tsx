import { Chat } from "./chat/Chat";

declare global {
  interface Window {
    mediaUrl: string;
  }
}

export default function GUI() {
    return (
        <Chat />
    );
}
