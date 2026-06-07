import { memo } from "react";
import type { RefObject } from "react";
import type { ChatMessageView } from "./tableRoomModel";

interface TableRoomChatPanelProps {
  chatMessageViews: ChatMessageView[];
  chatLogRef: RefObject<HTMLDivElement | null>;
  chatInputRef: RefObject<HTMLInputElement | null>;
  chatText: string;
  setChatText: (value: string) => void;
  onSubmitChat: (message: string) => void;
}

function TableRoomChatPanelBase({
  chatMessageViews,
  chatLogRef,
  chatInputRef,
  chatText,
  setChatText,
  onSubmitChat,
}: TableRoomChatPanelProps) {
  return (
    <aside className="chat-panel">
      <div className="chat-log" ref={chatLogRef}>
        {chatMessageViews.length === 0 ? (
          <div className="chat-empty-state">
            <span>Table chat</span>
            <strong>No messages yet</strong>
          </div>
        ) : (
          chatMessageViews.map((message) => (
            <p key={message.id}>
              <strong>{message.senderName}</strong>
              {message.text}
            </p>
          ))
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitChat(chatText);
        }}
      >
        <input
          ref={chatInputRef}
          value={chatText}
          onChange={(event) => setChatText(event.target.value)}
          placeholder="Type a chat message..."
          aria-label="Chat input"
        />
        <button type="submit">Send</button>
      </form>
    </aside>
  );
}

export const TableRoomChatPanel = memo(TableRoomChatPanelBase);
