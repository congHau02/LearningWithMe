import { MAX_SCRATCHPAD_LENGTH, useMathScratchpad } from '../../hooks/useMathScratchpad';
import { useCurriculumModeStore } from '../../stores/useCurriculumModeStore';
import { getMathSymbolSnippets } from '../../utils/mathLatex';
import { MathRichText } from '../common/MathRichText';
import { PinToSlideIcon, ScratchpadIcon, SendToChatIcon } from '../icons';
import { MathSymbolQuickBar } from './MathSymbolQuickBar';

interface MathScratchpadPanelProps {
  tableId: string;
  canControl: boolean;
}

export function MathScratchpadPanel({ tableId, canControl }: MathScratchpadPanelProps) {
  const curriculumMode = useCurriculumModeStore((s) => s.curriculumMode);
  const {
    scratchpad,
    activeSlideId,
    draft,
    derivationSteps,
    selectedStepIdx,
    setSelectedStepIdx,
    actionNotice,
    textareaRef,
    flushSync,
    handleDraftChange,
    handleInsertSymbol,
    handlePushToChat,
    handlePinToSlide,
  } = useMathScratchpad(tableId, canControl);

  const hasContent = derivationSteps.length > 0;

  return (
    <div
      data-testid="math-scratchpad-panel"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScratchpadIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Sổ nháp bước giải</h3>
          <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {draft.length}/{MAX_SCRATCHPAD_LENGTH}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground" data-testid="scratchpad-editor-meta">
          {scratchpad.updatedByNickname
            ? `Cập nhật bởi ${scratchpad.updatedByNickname}`
            : canControl
              ? 'Đồng bộ trực tiếp với cả bàn'
              : 'Chỉ xem — Host / Co-Host chỉnh sửa'}
        </span>
      </div>

      {canControl ? (
        <MathSymbolQuickBar
          snippets={getMathSymbolSnippets(curriculumMode)}
          onInsert={handleInsertSymbol}
          label="Chèn nhanh ký hiệu toán vào Sổ nháp"
          testIdPrefix="scratchpad-math-sym"
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`scratchpad-editor-${tableId}`} className="text-[11px] font-medium text-muted-foreground">
            Các bước biến đổi (hỗ trợ $...$ và $$...$$)
          </label>
          <textarea
            id={`scratchpad-editor-${tableId}`}
            ref={textareaRef}
            data-testid="scratchpad-editor"
            readOnly={!canControl}
            maxLength={MAX_SCRATCHPAD_LENGTH}
            rows={7}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={() => flushSync(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            placeholder={'VD:\nBước 1: $x^2 - 5x + 6 = 0$\nBước 2: $$(x - 2)(x - 3) = 0$$'}
            className="min-h-40 w-full resize-y overflow-y-auto rounded-lg border border-border bg-background p-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary read-only:opacity-85"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Xem trước KaTeX (nhấn chọn bước để gửi/ghim)
          </span>
          <div
            data-testid="scratchpad-live-preview"
            className="min-h-40 max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background p-2.5 text-xs text-foreground"
          >
            {hasContent ? (
              derivationSteps.map((step, idx) => {
                const isSelected = selectedStepIdx === idx;
                return (
                  <button
                    key={`${idx}-${step.slice(0, 16)}`}
                    type="button"
                    data-testid={`scratchpad-step-${idx}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedStepIdx(isSelected ? null : idx)}
                    className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? 'border-primary bg-card text-foreground'
                        : 'border-border bg-card/60 text-foreground hover:border-primary/50'
                    }`}
                  >
                    <span className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      B{idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 break-words">
                      <MathRichText text={step} />
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="mt-8 text-center text-[11px] text-muted-foreground">
                Nhập từng dòng công thức ở khung bên trái để xem trước trực tiếp.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="scratchpad-push-chat-btn"
            disabled={!hasContent}
            onClick={handlePushToChat}
            className="botanical-cta inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px]"
          >
            <SendToChatIcon className="h-4 w-4" aria-hidden="true" />
            <span>Gửi bước giải vào Chat bàn</span>
          </button>
          <button
            type="button"
            data-testid="scratchpad-pin-slide-btn"
            disabled={!canControl || !activeSlideId || !hasContent}
            title={!activeSlideId ? 'Cần mở ít nhất 1 trang bài tập để ghim công thức' : 'Ghim công thức đã chọn lên Slide'}
            onClick={handlePinToSlide}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px]"
          >
            <PinToSlideIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Ghim công thức lên Slide</span>
          </button>
        </div>
        {actionNotice ? (
          <span role="status" data-testid="scratchpad-action-notice" className="text-[11px] font-medium text-ring">
            {actionNotice}
          </span>
        ) : null}
      </div>
    </div>
  );
}
