import { useEffect, useRef } from 'react';
import type { TableChatMessage } from '../../services/tableApi';
import { MathRichText } from '../common/MathRichText';

interface TableChatMessageListProps {
  messages: TableChatMessage[];
  selfUserId: string | null;
  fillHeight: boolean;
}

export function TableChatMessageList({ messages, selfUserId, fillHeight }: TableChatMessageListProps) {
  const messagesListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={messagesListRef}
      className={`${fillHeight ? 'min-h-16' : 'min-h-36'} flex-1 space-y-2 overflow-y-auto p-3 text-xs`}
    >
      {messages.length === 0 ? (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Trao đổi riêng với các bạn cùng bàn tại đây. Hỗ trợ công thức $LaTeX$.
        </p>
      ) : (
        messages.map((msg) => {
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
  );
}
