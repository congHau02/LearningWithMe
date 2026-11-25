import { useEffect, type ReactNode } from 'react';
import { MAX_HOMEWORK_SLIDES, useHomeworkSlideUpload } from '../../hooks/useHomeworkSlideUpload';
import { useHomeworkUndoRedo } from '../../hooks/useHomeworkUndoRedo';
import { sendBoardDraw, sendHomeworkSlideAction } from '../../services/tableStompClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTableStore } from '../../stores/useTableStore';
import type { BoardTool } from '../../utils/homeworkCanvasMath';
import { CameraIcon, UploadIcon } from '../icons';
import { HomeworkAnnotationCanvas } from './HomeworkAnnotationCanvas';
import { CLEAR_VIEW_BOARD_TOOLS, HomeworkBoardToolbar } from './HomeworkBoardToolbar';
import { HomeworkCropRotateModal } from './HomeworkCropRotateModal';
import { HomeworkSlideTabs } from './HomeworkSlideTabs';
import { HomeworkTemplatePicker } from './HomeworkTemplatePicker';
import { StudyPackExportButtons } from './StudyPackExportButtons';

interface HomeworkDeckPanelProps {
  tableId: string;
  canControl: boolean;
  clearView?: boolean;
  dragHandle?: ReactNode;
}

export function HomeworkDeckPanel({
  tableId,
  canControl,
  clearView = false,
  dragHandle,
}: HomeworkDeckPanelProps) {
  const slides = useTableStore((s) => s.homeworkSlides);
  const activeSlideId = useTableStore((s) => s.activeSlideId);
  const tool = useTableStore((s) => s.boardTool);
  const color = useTableStore((s) => s.boardColor);
  const lineWidth = useTableStore((s) => s.boardLineWidth);
  const geoMarkType = useTableStore((s) => s.boardGeoMarkType);
  const snapEnabled = useTableStore((s) => s.boardSnapEnabled);
  const vertexLetter = useTableStore((s) => s.boardVertexLetter);
  const setTool = useTableStore((s) => s.setBoardTool);
  const setColor = useTableStore((s) => s.setBoardColor);
  const setLineWidth = useTableStore((s) => s.setBoardLineWidth);
  const setGeoMarkType = useTableStore((s) => s.setBoardGeoMarkType);
  const setSnapEnabled = useTableStore((s) => s.setBoardSnapEnabled);
  const setVertexLetter = useTableStore((s) => s.setBoardVertexLetter);
  const selfUserId = useAuthStore((s) => s.userId);

  const shouldClearHiddenTool = clearView && tool !== null && !CLEAR_VIEW_BOARD_TOOLS.has(tool);
  const effectiveTool: BoardTool | null = shouldClearHiddenTool ? null : tool;

  useEffect(() => {
    if (shouldClearHiddenTool) {
      setTool(null);
    }
  }, [shouldClearHiddenTool, setTool]);

  const activeSlide = activeSlideId ? (slides.find((s) => s.imageId === activeSlideId) ?? null) : null;
  const isDeckFull = slides.length >= MAX_HOMEWORK_SLIDES;

  const {
    fileInputRef,
    cameraInputRef,
    isUploading,
    errorMsg,
    setErrorMsg,
    pendingUploadFile,
    confirmPendingUpload,
    uploadFullPendingFile,
    cancelPendingUpload,
    handleFileChange,
    handlePasteEvent,
    handleCreateTemplate,
  } = useHomeworkSlideUpload({ tableId, canControl, isDeckFull });

  const { canUndo, canRedo, handleUndo, handleRedo, clearRedoForSlide } = useHomeworkUndoRedo({
    tableId,
    slideId: activeSlide?.imageId ?? null,
    strokes: activeSlide?.strokes ?? [],
    canControl,
    selfUserId,
  });

  return (
    <div
      data-testid="homework-deck-panel"
      tabIndex={0}
      onPaste={handlePasteEvent}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/80 p-3 focus:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {dragHandle}
          <h3 className="text-sm font-semibold text-foreground">Bảng bài tập</h3>
          <span
            data-testid="homework-slide-counter"
            className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {slides.length}/{MAX_HOMEWORK_SLIDES}
          </span>
        </div>

        {canControl ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl + V để dán ảnh</span>
            <input ref={fileInputRef} data-testid="homework-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
            <input ref={cameraInputRef} data-testid="homework-camera-input" type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              data-testid="homework-camera-btn"
              aria-label={isUploading ? 'Đang tải...' : 'Chụp bài tập bằng camera sau'}
              disabled={isUploading || isDeckFull}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Đang tải...' : <><CameraIcon className="h-4 w-4" aria-hidden="true" /><span>Chụp bài tập</span></>}
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

      {canControl && !clearView ? (
        <HomeworkTemplatePicker disabled={isUploading || isDeckFull} onCreateTemplate={handleCreateTemplate} />
      ) : null}

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

      <StudyPackExportButtons tableId={tableId} />

      {activeSlide ? (
        <div className="flex flex-col gap-2">
          {canControl ? (
            <HomeworkBoardToolbar
              tool={effectiveTool} color={color} lineWidth={lineWidth} clearView={clearView} canUndo={canUndo} canRedo={canRedo}
              strokes={activeSlide.strokes ?? []} geoMarkType={geoMarkType} snapEnabled={snapEnabled} vertexLetter={vertexLetter}
              onToolChange={setTool} onColorChange={setColor} onLineWidthChange={setLineWidth}
              onGeoMarkTypeChange={setGeoMarkType} onSnapToggle={() => setSnapEnabled(!snapEnabled)} onVertexLetterChange={setVertexLetter}
              onUndo={handleUndo} onRedo={handleRedo}
              onClearSlide={() => {
                clearRedoForSlide(activeSlide.imageId);
                sendBoardDraw(tableId, { slideId: activeSlide.imageId, action: 'CLEAR_SLIDE' });
              }}
            />
          ) : null}
          <HomeworkAnnotationCanvas
            tableId={tableId} slideId={activeSlide.imageId} imageUrl={activeSlide.url} fileName={activeSlide.fileName}
            strokes={activeSlide.strokes ?? []} canControl={canControl} selfUserId={selfUserId}
            tool={effectiveTool} color={color} lineWidth={lineWidth}
            geoMarkType={geoMarkType} snapEnabled={snapEnabled} vertexLetter={vertexLetter}
            onStrokeError={setErrorMsg} onNewStrokeCommitted={() => clearRedoForSlide(activeSlide.imageId)}
            onVertexCommitted={() => setVertexLetter(null)}
          />
        </div>
      ) : (
        <div data-testid="homework-empty-state" className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-background/40 px-4 text-center text-xs text-muted-foreground">
          {canControl
            ? clearView
              ? 'Chưa có trang bài tập nào. Chụp ảnh bài tập, tải ảnh (.jpg, .png, .webp) hoặc nhấn Ctrl + V để dán.'
              : 'Chưa có trang bài tập nào. Chọn mẫu giấy nháp toán ở trên, tải ảnh (.jpg, .png, .webp) hoặc nhấn Ctrl + V để dán.'
            : 'Chưa có trang bài tập nào được chia sẻ tại bàn này.'}
        </div>
      )}

      {pendingUploadFile && canControl ? (
        <HomeworkCropRotateModal
          file={pendingUploadFile}
          onCancel={cancelPendingUpload}
          onUseFull={(rotationDeg) => void uploadFullPendingFile(rotationDeg)}
          onConfirm={(rotationDeg, crop) => void confirmPendingUpload(rotationDeg, crop)}
        />
      ) : null}
    </div>
  );
}
