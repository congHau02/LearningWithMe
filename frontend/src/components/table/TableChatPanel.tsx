import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { sendTableChatMessage } from '../../services/tableStompClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTableStore } from '../../stores/useTableStore';
import {
  MAX_TABLE_CHAT_LENGTH,
  tableChatResolver,
  type TableChatFormValues,
} from './tableFormSchemas';

export interface TableChatPanelProps {
  tableId: string;
  onSend?: (content: string) => void;
}

const TABLE_QUICK_EMOJIS = ['👍', '💡', '🔥', '👏', '❓', '☕'] as const;

export const TableChatPanel: React.FC<TableChatPanelProps> = ({ tableId, onSend }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recentMessages = useTableStore((s) => s.recentMessages);
  const selfUserId = useAuthStore((s) => s.userId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm<TableChatFormValues>({
    resolver: tableChatResolver,
    mode: 'onChange',
    defaultValues: { content: '' },
  });

  const currentContent = watch('content') ?? '';

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [recentMessages]);

  const dispatchMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (onSend) {
      onSend(trimmed);
    } else {
      sendTableChatMessage(tableId, trimmed);
    }
    reset({ content: '' });
  };

  return (
    <div
      data-testid="table-chat-panel"
      className="flex h-72 flex-col overflow-hidden rounded-xl border border-border bg-slate-900/80 text-slate-200"
    >
      <div className="flex items-center justify-between border-b border-border/70 bg-slate-800/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs">💬</span>
          <h3 className="text-xs font-semibold text-slate-100">Table Chat</h3>
        </div>
        <span className="rounded bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {recentMessages.length}/50
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
        {recentMessages.length === 0 ? (
          <p className="mt-6 text-center text-[11px] text-slate-500">
            Trao đổi riêng với các bạn cùng bàn tại đây.
          </p>
        ) : (
          recentMessages.map((msg) => {
            const isSelf = Boolean(selfUserId && msg.userId === selfUserId);
            const timeStr = msg.createdAtEpoch
              ? new Date(msg.createdAtEpoch).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className={isSelf ? 'font-medium text-sky-400' : 'font-medium text-emerald-400'}>
                    {isSelf ? 'Bạn' : msg.nickname}
                  </span>
                  {timeStr ? <span>• {timeStr}</span> : null}
                </div>
                <div
                  className={`max-w-[85%] break-words rounded-xl px-2.5 py-1.5 text-xs ${
                    isSelf
                      ? 'rounded-tr-none bg-sky-600 text-white'
                      : 'rounded-tl-none border border-slate-700/60 bg-slate-800 text-slate-100'
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

      <div className="flex items-center justify-between gap-1 border-t border-slate-800/80 bg-slate-800/40 px-3 py-1">
        {TABLE_QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => dispatchMessage(emoji)}
            className="cursor-pointer p-0.5 text-sm transition-transform hover:scale-125"
            aria-label={`Table reaction ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit((values) => dispatchMessage(values.content))}
        noValidate
        className="flex flex-col gap-1 border-t border-border/70 bg-slate-800/70 p-2"
      >
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            data-testid="table-chat-input"
            {...register('content')}
            maxLength={MAX_TABLE_CHAT_LENGTH}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            placeholder="Nhắn tin trong bàn (tối đa 200 ký tự)..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <button
            type="submit"
            data-testid="table-chat-send-btn"
            disabled={!currentContent.trim()}
            className="cursor-pointer rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
        <div className="text-right text-[10px] text-slate-400">{currentContent.length}/200</div>
      </form>
    </div>
  );
};
