import { useStudyPackExport } from '../../hooks/useStudyPackExport';
import { DownloadIcon } from '../icons';

interface StudyPackExportButtonsProps {
  tableId: string;
}

/**
 * Client-side 1-click Study Pack export controls for any SEATED learner (Host, Co-Host, or Member).
 */
export function StudyPackExportButtons({ tableId }: StudyPackExportButtonsProps) {
  const { activeSlide, hasContent, exportingKind, handleExportPng, handleExportPdf } =
    useStudyPackExport(tableId);

  return (
    <div
      data-testid="study-pack-export-bar"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/60 px-2.5 py-1.5"
    >
      <span className="text-[11px] font-medium text-muted-foreground">
        Lưu vở bài giảng về máy (0 KB máy chủ)
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="export-slide-png-btn"
          disabled={!activeSlide || exportingKind !== null}
          onClick={() => void handleExportPng()}
          title={activeSlide ? 'Tải trang bài tập hiện tại dạng PNG' : 'Cần mở ít nhất 1 trang bài tập để tải PNG'}
          className="transition-botanical inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/90 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[34px]"
        >
          <DownloadIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{exportingKind === 'png' ? 'Đang xuất...' : 'Lưu PNG'}</span>
        </button>
        <button
          type="button"
          data-testid="export-study-pack-pdf-btn"
          disabled={!hasContent || exportingKind !== null}
          onClick={() => void handleExportPdf()}
          title={hasContent ? 'Xuất toàn bộ các trang bài tập và Sổ nháp ra PDF' : 'Chưa có trang bài tập hoặc bước giải để xuất'}
          className="transition-botanical inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-primary/50 bg-primary/20 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[34px]"
        >
          <DownloadIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{exportingKind === 'pdf' ? 'Đang xuất...' : 'Xuất Study Pack (PDF)'}</span>
        </button>
      </div>
    </div>
  );
}
