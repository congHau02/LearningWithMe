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
          <div key={slide.imageId} className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              data-testid={`homework-slide-tab-${slide.imageId}`}
              disabled={!canControl}
              onClick={() => onSelectSlide(slide.imageId)}
              className={`min-h-11 px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:px-2.5 ${
                isActive ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
                className="min-h-11 min-w-11 border-l border-border px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-8"
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
