import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { sendTableSosToggle } from '../../services/tableStompClient';
import { AlertCircleIcon } from '../icons';
import {
  MAX_SOS_TOPIC_LENGTH,
  sosBannerResolver,
  type SosBannerFormValues,
} from './tableFormSchemas';

export { MAX_SOS_TOPIC_LENGTH };

interface SosBannerControlProps {
  tableId: string;
  sosBanner: string | null;
  canControl: boolean;
}

export function SosBannerControl({ tableId, sosBanner, canControl }: SosBannerControlProps) {
  const [isComposing, setIsComposing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SosBannerFormValues>({
    resolver: sosBannerResolver,
    defaultValues: { topic: '' },
  });

  const onSubmit = (values: SosBannerFormValues) => {
    sendTableSosToggle(tableId, { active: true, topic: values.topic });
    reset();
    setIsComposing(false);
  };

  const handleDeactivate = () => {
    reset();
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
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/30 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-200 animate-pulse">
            <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>SOS</span>
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
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Bật SOS cầu cứu</span>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-testid="sos-compose-form"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card/95 p-2.5 text-xs"
    >
      <input
        type="text"
        data-testid="sos-topic-input"
        {...register('topic')}
        maxLength={MAX_SOS_TOPIC_LENGTH}
        placeholder="VD: Cần giúp Tích phân từng phần"
        aria-label="Chủ đề cần hỗ trợ SOS"
        className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        data-testid="sos-activate-btn"
        className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Phát tín hiệu SOS
      </button>
      <button
        type="button"
        data-testid="sos-cancel-btn"
        onClick={() => {
          setIsComposing(false);
          reset();
        }}
        className="rounded-lg border border-border px-2.5 py-1.5 text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Hủy
      </button>
      {errors.topic?.message ? (
        <p data-testid="sos-topic-error" className="w-full text-[11px] font-medium text-rose-400">
          {errors.topic.message}
        </p>
      ) : null}
    </form>
  );
}
