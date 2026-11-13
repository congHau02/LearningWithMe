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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomId = useGameStore((s) => s.roomId);
  const recentMessages = useGameStore((s) => s.recentMessages);
  const selfUserId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
    <div className="fixed bottom-4 right-4 z-30 font-sans select-none">
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
        <div className="w-80 sm:w-88 h-96 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
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
              className="text-slate-400 hover:text-slate-100 p-1 text-xs cursor-pointer rounded hover:bg-slate-700/50"
              aria-label="Thu nhỏ chat"
            >
              ✕
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {recentMessages.length === 0 ? (
              <p className="text-center text-slate-500 text-[11px] mt-8">Chưa có tin nhắn nào trong phòng. Hãy gửi lời chào nhé!</p>
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
            <div ref={messagesEndRef} />
          </div>

          {/* Quick emoji reactions */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/40 border-t border-slate-800/80 gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendMessage(emoji)}
                className="hover:scale-125 transition-transform text-sm cursor-pointer p-0.5"
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
                placeholder="Nhập tin nhắn (tối đa 200 ký tự)..."
                className="flex-1 bg-slate-900 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-sky-500 placeholder:text-slate-500"
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
