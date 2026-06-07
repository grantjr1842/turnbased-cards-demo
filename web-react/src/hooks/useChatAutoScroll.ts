import { useEffect, type RefObject } from "react";

export function useChatAutoScroll(params: {
  chatLogRef: RefObject<HTMLDivElement | null>;
  latestChatMessageId: string | null;
}) {
  const { chatLogRef, latestChatMessageId } = params;

  useEffect(() => {
    const container = chatLogRef.current;
    if (!container || !latestChatMessageId) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [chatLogRef, latestChatMessageId]);
}
