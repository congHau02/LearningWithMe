import {
  GRAPHICS_QUALITY_OPTIONS,
  getGraphicsQualityOptionState,
} from '../../game/graphics/graphicsQualityPolicy';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';

export function ClassroomGraphicsControl() {
  const graphicsQuality = useStudyCafeDisplayStore((s) => s.graphicsQuality);
  const rendererKind = useStudyCafeDisplayStore((s) => s.rendererKind);
  const prefersReducedMotion = useStudyCafeDisplayStore((s) => s.prefersReducedMotion);
  const setGraphicsQuality = useStudyCafeDisplayStore((s) => s.setGraphicsQuality);

  return (
    <div
      role="group"
      aria-label="Mức chất lượng đồ họa"
      data-testid="graphics-quality-control"
      className="inline-flex items-center gap-0.5 rounded-xl border border-border/80 bg-secondary/80 p-0.5 text-[11px]"
    >
      <span className="hidden px-2 font-medium text-muted-foreground md:inline">
        Đồ họa
      </span>
      {GRAPHICS_QUALITY_OPTIONS.map((option) => {
        const isSelected = graphicsQuality === option.id;
        const { disabled, title } = getGraphicsQualityOptionState({
          tier: option.id,
          label: option.label,
          rendererKind,
          prefersReducedMotion,
        });
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            title={title}
            data-testid={`graphics-quality-btn-${option.id}`}
            onClick={() => setGraphicsQuality(option.id)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-7 sm:min-w-0 sm:px-2 sm:py-0.5 ${
              isSelected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
