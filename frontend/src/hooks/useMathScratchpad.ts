import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  sendBoardDraw,
  sendTableChatMessage,
  sendTableScratchpadUpdate,
} from '../services/tableStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useTableStore } from '../stores/useTableStore';
import {
  applyMathSymbolToElement,
  extractActiveScratchpadStep,
  extractLatexFormulaForSlide,
  splitDerivationSteps,
} from '../utils/mathLatex';
import { MAX_TABLE_CHAT_LENGTH } from '../components/table/tableFormSchemas';

export const MAX_SCRATCHPAD_LENGTH = 4000;
const SYNC_DEBOUNCE_MS = 250;

export function useMathScratchpad(tableId: string, canControl: boolean) {
  const scratchpad = useTableStore((s) => s.scratchpadState);
  const activeSlideId = useTableStore((s) => s.activeSlideId);
  const slides = useTableStore((s) => s.homeworkSlides);
  const selfUserId = useAuthStore((s) => s.userId);

  const [draft, setDraft] = useState(scratchpad.content);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSentRef = useRef<string>(scratchpad.content);
  const localDirtyRef = useRef<boolean>(false);

  useEffect(() => {
    const isSelfEcho = Boolean(selfUserId && scratchpad.updatedByUserId === selfUserId);
    if (isSelfEcho) {
      if (scratchpad.content === lastSentRef.current && debounceRef.current === null) {
        localDirtyRef.current = false;
      }
      if (!localDirtyRef.current) {
        setDraft(scratchpad.content);
        lastSentRef.current = scratchpad.content;
      }
      return;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    localDirtyRef.current = false;
    setDraft(scratchpad.content);
    lastSentRef.current = scratchpad.content;
  }, [scratchpad.content, scratchpad.updatedAtEpoch, scratchpad.updatedByUserId, selfUserId]);

  useEffect(() => () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (!actionNotice) return;
    const id = window.setTimeout(() => setActionNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [actionNotice]);

  const flushSync = useCallback((nextContent: string) => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!canControl || nextContent === lastSentRef.current) return;
    lastSentRef.current = nextContent;
    sendTableScratchpadUpdate(tableId, nextContent);
  }, [canControl, tableId]);

  const handleDraftChange = useCallback((nextContent: string) => {
    const clamped = nextContent.slice(0, MAX_SCRATCHPAD_LENGTH);
    setDraft(clamped);
    setSelectedStepIdx(null);
    if (!canControl) return;
    localDirtyRef.current = true;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      lastSentRef.current = clamped;
      sendTableScratchpadUpdate(tableId, clamped);
    }, SYNC_DEBOUNCE_MS);
  }, [canControl, tableId]);

  const derivationSteps = useMemo(() => splitDerivationSteps(draft), [draft]);

  const resolveActiveStep = useCallback((): string => {
    if (selectedStepIdx !== null && derivationSteps[selectedStepIdx]) {
      return derivationSteps[selectedStepIdx];
    }
    const el = textareaRef.current;
    return extractActiveScratchpadStep(
      draft,
      el?.selectionStart ?? draft.length,
      el?.selectionEnd ?? draft.length,
    );
  }, [derivationSteps, draft, selectedStepIdx]);

  const handleInsertSymbol = useCallback((latex: string) => {
    if (!canControl) return;
    applyMathSymbolToElement(textareaRef.current, draft, latex, MAX_SCRATCHPAD_LENGTH, handleDraftChange);
  }, [canControl, draft, handleDraftChange]);

  const handlePushToChat = useCallback(() => {
    const step = resolveActiveStep();
    if (!step) return;
    const truncated = step.length > MAX_TABLE_CHAT_LENGTH;
    sendTableChatMessage(tableId, step.slice(0, MAX_TABLE_CHAT_LENGTH));
    setActionNotice(
      truncated
        ? 'Bước giải dài hơn 200 ký tự — đã rút gọn để gửi vào Chat bàn.'
        : 'Đã gửi bước giải vào Chat bàn.',
    );
  }, [resolveActiveStep, tableId]);

  const handlePinToSlide = useCallback(() => {
    if (!canControl || !activeSlideId) return;
    const formula = extractLatexFormulaForSlide(resolveActiveStep());
    if (!formula) return;
    const activeSlide = slides.find((s) => s.imageId === activeSlideId);
    const existingLatexCount = (activeSlide?.strokes ?? []).filter((st) => st.tool === 'LATEX').length;
    const y = Math.min(0.86, 0.16 + (existingLatexCount % 6) * 0.12);
    const strokeId = `latex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    sendBoardDraw(tableId, {
      slideId: activeSlideId,
      action: 'ADD_STROKE',
      stroke: {
        id: strokeId,
        tool: 'LATEX',
        color: '#E6ECE8',
        lineWidth: 18,
        points: [{ x: 0.12, y }],
        text: formula,
        authorUserId: selfUserId ?? undefined,
      },
    });
    setActionNotice('Đã ghim công thức lên Slide hiện tại.');
  }, [activeSlideId, canControl, resolveActiveStep, selfUserId, slides, tableId]);

  return {
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
  };
}
