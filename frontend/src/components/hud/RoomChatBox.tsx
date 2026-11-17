import React, { useEffect, useRef, useState } from 'react';
import { sendRoomChatMessage } from '../../services/roomStompClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';

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
          className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 text-slate-100 px-3.5 py-2 rounded-full border border-slate-700/80 shadow-lg transition active:scale-95 text-xs font-medium cursor-pointer"
        >
          <span>💬</span>
          <span>Phòng học ({recentMessages.length})</span>
        </button>
      ) : (
        <div className="flex h-96 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-200 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <div>
                <h3 className="text-xs font-semibold text-slate-100">Room Chat</h3>
                <p className="text-[10px] text-slate-400 font-mono">{roomId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded text-xs text-slate-300 hover:bg-slate-700/50 hover:text-slate-100"
              aria-label="Thu nhỏ chat"
            >
              ✕
            </button>
          </div>

          {/* Messages list */}
          <div ref={messagesListRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {recentMessages.length === 0 ? (
              <p className="mt-8 text-center text-[11px] text-slate-400">Chưa có tin nhắn nào trong phòng. Hãy gửi lời chào nhé!</p>
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
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                      <span className={isSelf ? 'text-sky-400 font-medium' : 'text-emerald-400 font-medium'}>
                        {isSelf ? 'Bạn' : msg.nickname}
                      </span>
                      {timeStr && <span>• {timeStr}</span>}
                    </div>
                    <div
                      className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs break-words ${
                        isSelf
                          ? 'bg-sky-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick emoji reactions */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/40 border-t border-slate-800/80 gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendMessage(emoji)}
                className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded text-sm transition-transform hover:scale-125 sm:min-h-7 sm:min-w-7"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input form */}
          <form onSubmit={onSubmit} className="p-2.5 bg-slate-800/80 border-t border-slate-700/60 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
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
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer"
              >
                Gửi
              </button>
            </div>
            <div className="text-right text-[10px] text-slate-400">
              {text.length}/200
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
