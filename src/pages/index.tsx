import { Chat } from "./chat/Chat";
import type { WebviewMessage } from '../webviewProtocol';

declare global {
  interface Window {
    mediaUrl: string;
    postMessageToEditor?: (message: WebviewMessage) => void;
    __ecaWebTransport?: {
      send: (message: WebviewMessage) => void;
    };
  }
}

export default function GUI() {
    return (
        <Chat />
    );
}
