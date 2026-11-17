import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { formatApiError } from '../../services/apiClient';
import { uploadHomeworkImage } from '../../services/tableApi';
import { sendBoardDraw, sendHomeworkSlideAction } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import { compressImageToWebp } from '../../utils/homeworkImageCompression';
import type { BoardTool } from '../../utils/homeworkCanvasMath';
import { CameraIcon, UploadIcon } from '../icons';
import { HomeworkAnnotationCanvas } from './HomeworkAnnotationCanvas';
import { HomeworkBoardToolbar } from './HomeworkBoardToolbar';
import { HomeworkSlideTabs } from './HomeworkSlideTabs';

const MAX_SLIDES = 5;

const extractImageFile = (data: DataTransfer | null | undefined): File | null => {
  const item = Array.from(data?.items ?? []).find((entry) => entry.type.startsWith('image/'));
  return item ? item.getAsFile() : null;
};

interface HomeworkDeckPanelProps {
  tableId: string;
  canControl: boolean;
  dragHandle?: ReactNode;
}

export function HomeworkDeckPanel({ tableId, canControl, dragHandle }: HomeworkDeckPanelProps) {
  const slides = useTableStore((s) => s.homeworkSlides);
  const activeSlideId = useTableStore((s) => s.activeSlideId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
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
      className="flex flex-col gap-3 rounded-xl border border-border bg-[#16221E]/80 p-3 outline-none focus:border-primary/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {dragHandle}
          <h3 className="text-sm font-semibold text-foreground">Bảng bài tập</h3>
          <span
            data-testid="homework-slide-counter"
            className="rounded-md border border-border bg-[#0F1714] px-2 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {slides.length}/{MAX_SLIDES}
          </span>
        </div>

        {canControl ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl + V để dán ảnh</span>
            <input
              ref={fileInputRef}
              data-testid="homework-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              data-testid="homework-camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              data-testid="homework-camera-btn"
              aria-label={isUploading ? 'Đang tải...' : 'Chụp bài tập bằng camera sau'}
              disabled={isUploading || isDeckFull}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Đang tải...' : <><CameraIcon className="h-4 w-4" aria-hidden="true" /><span className="sr-only">📷</span><span>Chụp bài tập</span></>}
            </button>
            <button
              type="button"
              data-testid="homework-upload-btn"
              disabled={isUploading || isDeckFull}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Đang tải...' : <><UploadIcon className="h-4 w-4" aria-hidden="true" /><span>{isDeckFull ? 'Đã đủ 5 trang' : 'Tải ảnh bài tập'}</span></>}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Chỉ Host / Co-Host được đổi trang</span>
        )}
      </div>

      {errorMsg ? (
        <p data-testid="homework-upload-error" role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200">
          {errorMsg}
        </p>
      ) : null}

      <HomeworkSlideTabs
        slides={slides}
        activeSlideId={activeSlide?.imageId ?? null}
        canControl={canControl}
        onSelectSlide={(imageId) => sendHomeworkSlideAction(tableId, { action: 'SELECT', imageId })}
        onDeleteSlide={(imageId) => sendHomeworkSlideAction(tableId, { action: 'DELETE', imageId })}
      />

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
            imageUrl={activeSlide.url} fileName={activeSlide.fileName}
            strokes={activeSlide.strokes ?? []} canControl={canControl}
            tool={tool} color={color} lineWidth={lineWidth}
            onStrokeError={setErrorMsg}
          />
        </div>
      ) : (
        <div
          data-testid="homework-empty-state"
          className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-[#0F1714]/40 px-4 text-center text-xs text-muted-foreground"
        >
          {canControl
            ? 'Chưa có trang bài tập nào. Chọn ảnh (.jpg, .png, .webp) hoặc bấm vào đây và nhấn Ctrl + V để dán.'
            : 'Chưa có trang bài tập nào được chia sẻ tại bàn này.'}
        </div>
      )}
    </div>
  );
}
