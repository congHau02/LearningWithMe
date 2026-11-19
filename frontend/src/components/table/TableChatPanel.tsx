import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { sendTableChatMessage } from '../../services/tableStompClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTableStore } from '../../stores/useTableStore';
import { CHAT_MATH_SNIPPETS, applyMathSymbolToElement } from '../../utils/mathLatex';
import { MathRichText } from '../common/MathRichText';
import { ChatIcon } from '../icons';
import { MathSymbolQuickBar } from './MathSymbolQuickBar';
import {
  MAX_TABLE_CHAT_LENGTH,
  tableChatResolver,
  type TableChatFormValues,
} from './tableFormSchemas';

export interface TableChatPanelProps {
  tableId: string;
  onSend?: (content: string) => void;
  fillHeight?: boolean;
  clearView?: boolean;
}

const TABLE_QUICK_EMOJIS = ['👍', '💡', '🔥', '👏', '❓', '☕'] as const;

export const TableChatPanel: React.FC<TableChatPanelProps> = ({ tableId, onSend, fillHeight = false, clearView = false }) => {
  const messagesListRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const recentMessages = useTableStore((s) => s.recentMessages);
  const selfUserId = useAuthStore((s) => s.userId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<TableChatFormValues>({
    resolver: tableChatResolver,
    mode: 'onChange',
    defaultValues: { content: '' },
  });

  const currentContent = watch('content') ?? '';
  const contentField = register('content');

  useEffect(() => {
    const el = messagesListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
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

  const handleInsertMathSymbol = (latex: string) => {
    applyMathSymbolToElement(
      chatInputRef.current,
      currentContent,
      latex,
      MAX_TABLE_CHAT_LENGTH,
      (value) => setValue('content', value, { shouldDirty: true, shouldValidate: true }),
    );
  };

  return (
    <div
      data-testid="table-chat-panel"
      className={`flex flex-col overflow-hidden rounded-xl border border-border bg-[#16221E]/95 text-[#E6ECE8] ${
        fillHeight ? 'h-full min-h-0 flex-1' : 'min-h-[27rem] sm:h-[25rem] sm:min-h-[24rem]'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background/85 px-3 py-2">
        <div className="flex items-center gap-2">
          <ChatIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-xs font-semibold text-foreground">Table Chat</h3>
        </div>
        <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {recentMessages.length}/50
        </span>
      </div>

      <div
        ref={messagesListRef}
        className={`${fillHeight ? 'min-h-16' : 'min-h-36'} flex-1 space-y-2 overflow-y-auto p-3 text-xs`}
      >
        {recentMessages.length === 0 ? (
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Trao đổi riêng với các bạn cùng bàn tại đây. Hỗ trợ công thức $LaTeX$.
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
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className={isSelf ? 'font-semibold text-primary' : 'font-semibold text-emerald-400'}>
                    {isSelf ? 'Bạn' : msg.nickname}
                  </span>
                  {timeStr ? <span>• {timeStr}</span> : null}
                </div>
                <div
                  className={`max-w-[85%] break-words rounded-xl px-2.5 py-1.5 text-xs ${
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

      <div className="flex shrink-0 items-center justify-between gap-1 border-t border-border bg-background/60 px-2 py-1">
        {TABLE_QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => dispatchMessage(emoji)}
            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded text-sm transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary sm:min-h-[30px] sm:min-w-[30px]"
            aria-label={`Table reaction ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {!clearView ? (
        <MathSymbolQuickBar
          snippets={CHAT_MATH_SNIPPETS}
          onInsert={handleInsertMathSymbol}
          label="Chèn nhanh ký hiệu toán vào Chat bàn"
          testIdPrefix="table-chat-math-sym"
          compact
        />
      ) : null}

      <form
        onSubmit={handleSubmit((values) => dispatchMessage(values.content))}
        noValidate
        className="flex shrink-0 flex-col gap-1 border-t border-border bg-background/85 p-2"
      >
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            data-testid="table-chat-input"
            aria-label="Nhập tin nhắn trong bàn"
            {...contentField}
            ref={(el) => {
              contentField.ref(el);
              chatInputRef.current = el;
            }}
            maxLength={MAX_TABLE_CHAT_LENGTH}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            placeholder="Nhắn tin hoặc gõ $x^2 + 1$ (tối đa 200 ký tự)..."
            className="min-h-[44px] flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:min-h-[34px]"
          />
          <button
            type="submit"
            data-testid="table-chat-send-btn"
            disabled={!currentContent.trim()}
            className="min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border border-primary/40 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[34px]"
          >
            Gửi
          </button>
        </div>
        <div className="text-right font-mono text-[10px] text-muted-foreground">{currentContent.length}/200</div>
      </form>
    </div>
  );
};
