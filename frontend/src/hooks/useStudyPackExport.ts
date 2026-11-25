import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import {
  exportActiveSlideAsPng,
  exportStudyPackAsPdf,
  hasStudyPackContent,
} from '../utils/studyPackExporter';

/** Open the safeguard modal if the Table has slides/scratchpad, otherwise leave immediately. */
export function initiateSafeLeaveSeat(): void {
  const { homeworkSlides, scratchpadState } = useTableStore.getState();
  if (hasStudyPackContent(homeworkSlides, scratchpadState.content)) {
    useGameStore.getState().openLeaveConfirm();
    return;
  }
  useGameStore.getState().requestLeaveSeat();
}

export function useStudyPackExport(tableId: string) {
  const slides = useTableStore((s) => s.homeworkSlides);
  const activeSlideId = useTableStore((s) => s.activeSlideId);
  const scratchpadState = useTableStore((s) => s.scratchpadState);
  const setPermissionToast = useTableStore((s) => s.setPermissionToast);
  const token = useAuthStore((s) => s.token);
  const [exportingKind, setExportingKind] = useState<'png' | 'pdf' | null>(null);

  const activeSlideIndex = activeSlideId
    ? slides.findIndex((s) => s.imageId === activeSlideId)
    : -1;
  const activeSlide = activeSlideIndex >= 0 ? slides[activeSlideIndex] : null;
  const hasContent = hasStudyPackContent(slides, scratchpadState.content);

  const handleExportPng = async (): Promise<boolean> => {
    if (!activeSlide || exportingKind !== null) return false;
    setExportingKind('png');
    try {
      const fileName = await exportActiveSlideAsPng({
        tableId,
        slide: activeSlide,
        slideIndex: activeSlideIndex,
        token,
      });
      setPermissionToast(`Đã tải ảnh trang bài tập (${fileName})`);
      return true;
    } catch {
      setPermissionToast('Không thể xuất ảnh PNG của trang bài tập.');
      return false;
    } finally {
      setExportingKind(null);
    }
  };

  const handleExportPdf = async (): Promise<boolean> => {
    if (!hasContent || exportingKind !== null) return false;
    setExportingKind('pdf');
    try {
      const fileName = await exportStudyPackAsPdf({
        tableId,
        slides,
        scratchpadState,
        token,
      });
      setPermissionToast(`Đã xuất vở bài giảng Study Pack (${fileName})`);
      return true;
    } catch {
      setPermissionToast('Không thể xuất file PDF Study Pack.');
      return false;
    } finally {
      setExportingKind(null);
    }
  };

  return {
    activeSlide,
    hasContent,
    exportingKind,
    handleExportPng,
    handleExportPdf,
  };
}
