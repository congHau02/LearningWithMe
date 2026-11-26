import type { HomeworkSlide } from '../services/tableApi';

/** Pure zero-dependency check for Study Pack exports & leave-seat safeguards. */
export function hasStudyPackContent(
  slides: ReadonlyArray<HomeworkSlide>,
  scratchpadContent: string | null | undefined,
): boolean {
  return slides.length > 0 || Boolean(scratchpadContent && scratchpadContent.trim().length > 0);
}
