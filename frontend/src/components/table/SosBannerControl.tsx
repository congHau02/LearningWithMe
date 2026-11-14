import { useState, type FormEvent } from 'react';
import { sendTableSosToggle } from '../../services/roomStompClient';

export const MAX_SOS_TOPIC_LENGTH = 80;

interface SosBannerControlProps {
  tableId: string;
  sosBanner: string | null;
  canControl: boolean;
}

export function SosBannerControl({ tableId, sosBanner, canControl }: SosBannerControlProps) {
  const [isComposing, setIsComposing] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = topicInput.trim();
    if (!trimmed) {
      setError('Vui lòng nhập chủ đề cần hỗ trợ');
      return;
    }
    if (trimmed.length > MAX_SOS_TOPIC_LENGTH) {
      setError(`Chủ đề tối đa ${MAX_SOS_TOPIC_LENGTH} ký tự`);
      return;
    }
    setError(null);
    sendTableSosToggle(tableId, { active: true, topic: trimmed });
    setTopicInput('');
    setIsComposing(false);
  };

  const handleDeactivate = () => {
    setError(null);
    sendTableSosToggle(tableId, { active: false });
  };

  if (sosBanner) {
    return (
      <div
        data-testid="active-sos-banner"
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/60 bg-amber-500/15 px-3.5 py-2 text-xs shadow-[0_0_20px_rgba(245,158,11,0.22)]"
      >
        <div className="flex items-center gap-2 text-amber-100">
          <span className="inline-flex items-center rounded-md bg-amber-500/30 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-200 animate-pulse">
            🆘 SOS
          </span>
          <span className="font-semibold">{sosBanner}</span>
        </div>
        {canControl ? (
          <button
            type="button"
            data-testid="sos-deactivate-btn"
            onClick={handleDeactivate}
            className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-100 transition hover:bg-amber-500/35"
          >
            Tắt SOS
          </button>
        ) : null}
      </div>
    );
  }

  if (!canControl) {
    return null;
  }

  if (!isComposing) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          data-testid="sos-open-form-btn"
          onClick={() => setIsComposing(true)}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
        >
          🆘 Bật SOS cầu cứu
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="sos-compose-form"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5 text-xs"
    >
      <input
        type="text"
        data-testid="sos-topic-input"
        value={topicInput}
        onChange={(e) => {
          setTopicInput(e.target.value);
          if (error) setError(null);
        }}
        maxLength={MAX_SOS_TOPIC_LENGTH}
        placeholder="VD: Cần giúp Tích phân từng phần"
        aria-label="Chủ đề cần hỗ trợ SOS"
        className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
      />
      <button
        type="submit"
        data-testid="sos-activate-btn"
        className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-amber-400"
      >
        Phát tín hiệu SOS
      </button>
      <button
        type="button"
        data-testid="sos-cancel-btn"
        onClick={() => {
          setIsComposing(false);
          setError(null);
        }}
        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 transition hover:bg-slate-800"
      >
        Hủy
      </button>
      {error ? (
        <p data-testid="sos-topic-error" className="w-full text-[11px] font-medium text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
