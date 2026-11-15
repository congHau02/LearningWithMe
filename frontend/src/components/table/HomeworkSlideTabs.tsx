import type { HomeworkSlide } from '../../services/tableApi';

interface HomeworkSlideTabsProps {
  slides: HomeworkSlide[];
  activeSlideId: string | null;
  canControl: boolean;
  onSelectSlide: (imageId: string) => void;
  onDeleteSlide: (imageId: string) => void;
}

/** Slide selector and delete tab strip for {@link HomeworkDeckPanel}. */
export function HomeworkSlideTabs({
  slides,
  activeSlideId,
  canControl,
  onSelectSlide,
  onDeleteSlide,
}: HomeworkSlideTabsProps) {
  if (slides.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {slides.map((slide, index) => {
        const isActive = activeSlideId === slide.imageId;
        return (
          <div key={slide.imageId} className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
            <button
              type="button"
              data-testid={`homework-slide-tab-${slide.imageId}`}
              disabled={!canControl}
              onClick={() => onSelectSlide(slide.imageId)}
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
                onClick={() => onDeleteSlide(slide.imageId)}
                className="border-l border-slate-700 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20"
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
