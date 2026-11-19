import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { formatApiError } from '../services/apiClient';
import { uploadHomeworkImage } from '../services/tableApi';
import { compressImageToWebp } from '../utils/homeworkImageCompression';
import { generateMathTemplateFile, type MathTemplateId } from '../utils/mathSlideTemplates';

export const MAX_HOMEWORK_SLIDES = 5;

const extractImageFile = (data: DataTransfer | null | undefined): File | null => {
  const item = Array.from(data?.items ?? []).find((entry) => entry.type.startsWith('image/'));
  return item ? item.getAsFile() : null;
};

interface UseHomeworkSlideUploadOptions {
  tableId: string;
  canControl: boolean;
  isDeckFull: boolean;
}

export function useHomeworkSlideUpload({
  tableId,
  canControl,
  isDeckFull,
}: UseHomeworkSlideUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runSlideUpload = useCallback(async (buildWebpFile: () => Promise<File>) => {
    if (!canControl || isUploading) return;
    if (isDeckFull) {
      setErrorMsg(`Bàn học đã đạt tối đa ${MAX_HOMEWORK_SLIDES} trang bài tập.`);
      return;
    }
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const webpFile = await buildWebpFile();
      await uploadHomeworkImage(tableId, webpFile);
    } catch (err) {
      setErrorMsg(formatApiError(err, 'Không thể tải ảnh bài tập lên.', true));
    } finally {
      setIsUploading(false);
    }
  }, [canControl, isDeckFull, isUploading, tableId]);

  const processAndUpload = useCallback(
    (rawFile: File) => runSlideUpload(() => compressImageToWebp(rawFile, { maxDimension: 1920, quality: 0.85 })),
    [runSlideUpload],
  );

  const handleCreateTemplate = useCallback(
    (templateId: MathTemplateId) => void runSlideUpload(() => generateMathTemplateFile(templateId)),
    [runSlideUpload],
  );

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

  return {
    fileInputRef,
    cameraInputRef,
    isUploading,
    errorMsg,
    setErrorMsg,
    handleFileChange,
    handlePasteEvent,
    handleCreateTemplate,
  };
}
