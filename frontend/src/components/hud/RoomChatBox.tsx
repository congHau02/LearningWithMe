import React, { useEffect, useRef, useState } from 'react';
import { sendRoomChatMessage } from '../../services/roomStompClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { MathRichText } from '../common/MathRichText';
import { ChatIcon, XIcon } from '../icons';

export interface RoomChatBoxProps {
  initialOpen?: boolean;
  onSend?: (content: string) => void;
}

const QUICK_EMOJIS = ['👋', '🎉', '☕', '🔥', '💡', '❤️'] as const;

export const RoomChatBox: React.FC<RoomChatBoxProps> = ({ initialOpen = false, onSend }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [text, setText] = useState('');
  const messagesListRef = useRef<HTMLDivElement>(null);

  const roomId = useGameStore((s) => s.roomId);
  const recentMessages = useGameStore((s) => s.recentMessages);
  const selfUserId = useAuthStore((s) => s.userId);

  useEffect(() => {
    const el = messagesListRef.current;
    if (isOpen && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [recentMessages, isOpen]);

  const handleSendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (onSend) {
      onSend(trimmed);
    } else {
      sendRoomChatMessage(roomId, trimmed);
    }
    setText('');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(text);
  };

  return (
    <div className="fixed bottom-3 right-3 z-30 select-none font-sans sm:right-4">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 cursor-pointer sm:min-h-9"
        >
          <ChatIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>Phòng học ({recentMessages.length})</span>
        </button>
      ) : (
        <div className="flex h-96 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 text-foreground shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-background/85 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <ChatIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-xs font-semibold text-foreground">Room Chat</h3>
                <p className="font-mono text-[10px] text-muted-foreground">{roomId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-8"
              aria-label="Thu nhỏ chat"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Messages list */}
          <div ref={messagesListRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {recentMessages.length === 0 ? (
              <p className="mt-8 text-center text-[11px] text-muted-foreground">
                Chưa có tin nhắn nào trong phòng. Hãy gửi lời chào nhé!
              </p>
            ) : (
              recentMessages.map((msg) => {
                const isSelf = selfUserId && msg.userId === selfUserId;
                const timeStr = msg.createdAtEpoch
                  ? new Date(msg.createdAtEpoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                  >
                    <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className={isSelf ? 'font-semibold text-primary' : 'font-semibold text-emerald-400'}>
                        {isSelf ? 'Bạn' : msg.nickname}
                      </span>
                      {timeStr && <span>• {timeStr}</span>}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs break-words shadow-sm ${
                        isSelf
                          ? 'rounded-tr-none border border-primary/40 bg-primary/20 text-foreground'
                          : 'rounded-tl-none border border-border bg-background/80 text-foreground'
                      }`}
                    >
                      <MathRichText text={msg.content} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick emoji reactions */}
          <div className="flex items-center justify-between gap-1 border-t border-border bg-background/60 px-2 py-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendMessage(emoji)}
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded text-sm transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-8"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input form */}
          <form onSubmit={onSubmit} className="flex flex-col gap-1 border-t border-border bg-background/85 p-2.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="Nhập tin nhắn toàn phòng"
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsOpen(false);
                  }
                }}
                placeholder="Nhập tin nhắn (tối đa 200 ký tự)..."
                className="min-h-11 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="min-h-11 min-w-11 cursor-pointer rounded-lg border border-primary/40 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8 sm:min-w-0"
              >
                Gửi
              </button>
            </div>
            <div className="text-right font-mono text-[10px] text-muted-foreground">
              {text.length}/200
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
