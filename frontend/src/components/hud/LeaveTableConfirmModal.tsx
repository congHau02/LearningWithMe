import { useEffect, useRef, useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useStudyPackExport } from '../../hooks/useStudyPackExport';
import { useTableStore } from '../../stores/useTableStore';
import { AlertCircleIcon, DownloadIcon } from '../icons';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';

interface LeaveTableConfirmModalProps {
  tableId: string | null;
  seatId: string | null;
  onConfirmLeave: () => void;
  onCancel: () => void;
}

export function LeaveTableConfirmModal({
  tableId,
  seatId,
  onConfirmLeave,
  onCancel,
}: LeaveTableConfirmModalProps) {
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [exportError, setExportError] = useState<string | null>(null);

  const homeworkSlides = useTableStore((s) => s.homeworkSlides);
  const scratchpadState = useTableStore((s) => s.scratchpadState);
  const members = useTableStore((s) => s.members);
  const storeTableId = useTableStore((s) => s.tableId);
  const effectiveTableId = tableId ?? storeTableId ?? 'ban-hoc';
  const { hasContent: hasStudyPack, exportingKind, handleExportPdf } = useStudyPackExport(effectiveTableId);
  const isExporting = exportingKind !== null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEscapeToClose(onCancel);
  useFocusTrap(dialogContainerRef);

  const slideCount = homeworkSlides.length;
  const hasScratchpad = scratchpadState.content.trim().length > 0;
  const isFinalLearner = members.length <= 1;

  const handleExportAndLeave = async () => {
    if (isExporting) return;
    setExportError(null);
    const ok = await handleExportPdf();
    if (!mountedRef.current) return;
    if (ok) {
      onConfirmLeave();
    } else {
      setExportError('Không thể tải file PDF lúc này. Bạn vẫn có thể bấm "Rời bàn ngay".');
    }
  };

  const summaryParts: string[] = [];
  if (slideCount > 0) summaryParts.push(`${slideCount} trang bài tập`);
  if (hasScratchpad) summaryParts.push('Sổ nháp bước giải');

  return (
    <div ref={dialogContainerRef} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <DoubleBezelCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-table-confirm-title"
        data-testid="leave-seat-confirm-dialog"
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto"
        innerClassName="p-5 sm:p-6"
      >
        <h2 id="leave-table-confirm-title" className="text-base font-semibold text-foreground">
          Xác nhận đứng dậy rời bàn?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bạn đang ngồi tại{' '}
          <span className="font-mono font-semibold text-primary">
            {tableId ?? 'bàn học'}
            {seatId ? ` (${seatId})` : ''}
          </span>
          . Nếu rời bàn bây giờ, nhân vật sẽ đứng dậy và đi lại tự do trong phòng.
        </p>

        {hasStudyPack ? (
          <div
            data-testid="leave-seat-study-pack-notice"
            className="mt-3.5 flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-foreground"
          >
            <p className="font-medium">
              Bàn học đang có <span className="font-semibold text-primary">{summaryParts.join(' và ')}</span>. Bạn có muốn lưu Study Pack (PDF) về máy trước khi rời đi?
            </p>
            {isFinalLearner ? (
              <p
                data-testid="leave-seat-final-learner-warning"
                className="flex items-start gap-2 rounded-lg border border-primary/50 bg-card/85 px-2.5 py-2 font-medium text-foreground"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Bạn là người cuối cùng tại bàn — khi rời đi, toàn bộ trang bài tập và sổ nháp tạm thời sẽ bị xóa vĩnh viễn!
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {exportError ? (
          <p role="alert" className="mt-2.5 rounded-lg border border-destructive/50 bg-destructive/20 px-3 py-2 text-xs text-destructive-foreground">
            {exportError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            data-testid="cancel-leave-seat-btn"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-botanical hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
          >
            Tiếp tục ngồi học
          </button>

          <button
            type="button"
            data-testid="confirm-leave-seat-btn"
            onClick={onConfirmLeave}
            className="min-h-11 rounded-xl border border-destructive/60 bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground transition-botanical hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
          >
            {hasStudyPack ? 'Rời bàn ngay' : 'Xác nhận rời bàn'}
          </button>

          {hasStudyPack ? (
            <button
              type="button"
              data-testid="export-and-leave-seat-btn"
              disabled={isExporting}
              onClick={() => void handleExportAndLeave()}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/50 bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-botanical hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:min-h-9"
            >
              <DownloadIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{isExporting ? 'Đang xuất...' : 'Tải vở bài giảng & Rời bàn'}</span>
            </button>
          ) : null}
        </div>
      </DoubleBezelCard>
    </div>
  );
}
