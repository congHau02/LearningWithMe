import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { formatApiError } from '../../services/apiClient';
import { resolveEphemeralFileUrl, uploadHomeworkImage } from '../../services/tableApi';
import { sendBoardDraw, sendHomeworkSlideAction } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import { compressImageToWebp } from '../../utils/homeworkImageCompression';
import type { BoardTool } from '../../utils/homeworkCanvasMath';
import { HomeworkAnnotationCanvas } from './HomeworkAnnotationCanvas';
import { HomeworkBoardToolbar } from './HomeworkBoardToolbar';

const MAX_SLIDES = 5;

const extractImageFile = (data: DataTransfer | null | undefined): File | null => {
  const item = Array.from(data?.items ?? []).find((entry) => entry.type.startsWith('image/'));
  return item ? item.getAsFile() : null;
};

interface HomeworkDeckPanelProps {
  tableId: string;
  canControl: boolean;
}

export function HomeworkDeckPanel({ tableId, canControl }: HomeworkDeckPanelProps) {
  const slides = useTableStore((s) => s.homeworkSlides);
  const activeSlideId = useTableStore((s) => s.activeSlideId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tool, setTool] = useState<BoardTool>('PEN');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);

  const activeSlide = activeSlideId ? (slides.find((s) => s.imageId === activeSlideId) ?? null) : null;
  const isDeckFull = slides.length >= MAX_SLIDES;

  const processAndUpload = useCallback(async (rawFile: File) => {
    if (!canControl || isUploading) return;
    if (isDeckFull) {
      setErrorMsg('Bàn học đã đạt tối đa 5 trang bài tập.');
      return;
    }
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const webpFile = await compressImageToWebp(rawFile, { maxDimension: 1920, quality: 0.85 });
      await uploadHomeworkImage(tableId, webpFile);
    } catch (err) {
      setErrorMsg(formatApiError(err, 'Không thể tải ảnh bài tập lên.', true));
    } finally {
      setIsUploading(false);
    }
  }, [canControl, isDeckFull, isUploading, tableId]);

  const uploadRef = useRef(processAndUpload);
  uploadRef.current = processAndUpload;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processAndUpload(file);
  };

  const handlePasteEvent = useCallback((e: { clipboardData: DataTransfer | null; defaultPrevented: boolean; preventDefault: () => void }) => {
    if (!canControl || e.defaultPrevented) return;
    const file = extractImageFile(e.clipboardData);
    if (file) {
      e.preventDefault();
      void uploadRef.current(file);
    }
  }, [canControl]);

  useEffect(() => {
    if (!canControl) return;
    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [canControl, handlePasteEvent]);

  return (
    <div
      data-testid="homework-deck-panel"
      tabIndex={0}
      onPaste={handlePasteEvent}
      className="flex flex-col gap-3 rounded-xl border border-border bg-slate-900/80 p-3 outline-none focus:border-sky-500/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Bảng bài tập</h3>
          <span
            data-testid="homework-slide-counter"
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300"
          >
            {slides.length}/{MAX_SLIDES}
          </span>
        </div>

        {canControl ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-400 sm:inline">Ctrl + V để dán ảnh</span>
            <input
              ref={fileInputRef}
              data-testid="homework-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              data-testid="homework-upload-btn"
              disabled={isUploading || isDeckFull}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Đang tải...' : isDeckFull ? 'Đã đủ 5 trang' : 'Tải ảnh bài tập'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Chỉ Host / Co-Host được đổi trang</span>
        )}
      </div>

      {errorMsg ? (
        <p data-testid="homework-upload-error" role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200">
          {errorMsg}
        </p>
      ) : null}

      {slides.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {slides.map((slide, index) => {
            const isActive = activeSlide?.imageId === slide.imageId;
            return (
              <div key={slide.imageId} className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                <button
                  type="button"
                  data-testid={`homework-slide-tab-${slide.imageId}`}
                  disabled={!canControl}
                  onClick={() => sendHomeworkSlideAction(tableId, { action: 'SELECT', imageId: slide.imageId })}
                  className={`px-2.5 py-1 text-xs font-medium transition ${
                    isActive ? 'bg-sky-500/25 text-sky-200' : 'text-slate-300 hover:bg-slate-700/60'
                  } disabled:cursor-default`}
                >
                  Trang {index + 1}
                </button>
                {canControl ? (
                  <button
                    type="button"
                    data-testid={`homework-slide-delete-${slide.imageId}`}
                    aria-label={`Xóa trang ${index + 1}`}
                    onClick={() => sendHomeworkSlideAction(tableId, { action: 'DELETE', imageId: slide.imageId })}
                    className="border-l border-slate-700 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {activeSlide ? (
        <div className="flex flex-col gap-2">
          {canControl ? (
            <HomeworkBoardToolbar
              tool={tool}
              color={color}
              lineWidth={lineWidth}
              onToolChange={setTool}
              onColorChange={setColor}
              onLineWidthChange={setLineWidth}
              onClearSlide={() => sendBoardDraw(tableId, { slideId: activeSlide.imageId, action: 'CLEAR_SLIDE' })}
            />
          ) : null}
          <HomeworkAnnotationCanvas
            tableId={tableId} slideId={activeSlide.imageId}
            imageUrl={resolveEphemeralFileUrl(activeSlide.url)} fileName={activeSlide.fileName}
            strokes={activeSlide.strokes ?? []} canControl={canControl}
            tool={tool} color={color} lineWidth={lineWidth}
          />
        </div>
      ) : (
        <div
          data-testid="homework-empty-state"
          className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 text-center text-xs text-slate-400"
        >
          {canControl
            ? 'Chưa có trang bài tập nào. Chọn ảnh (.jpg, .png, .webp) hoặc bấm vào đây và nhấn Ctrl + V để dán.'
            : 'Chưa có trang bài tập nào được chia sẻ tại bàn này.'}
        </div>
      )}
    </div>
  );
}
