import { AMBIENCE_MOOD_OPTIONS } from '../../game/graphics/graphicsQualityPolicy';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';

export function ClassroomAmbienceControl() {
  const ambienceMood = useStudyCafeDisplayStore((s) => s.ambienceMood);
  const setAmbienceMood = useStudyCafeDisplayStore((s) => s.setAmbienceMood);

  return (
    <div
      role="group"
      aria-label="Bầu không khí quán"
      data-testid="ambience-mood-control"
      className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-border/80 bg-secondary/80 p-0.5 text-[11px]"
    >
      <span className="hidden px-2 font-medium text-muted-foreground md:inline">
        Ánh sáng
      </span>
      {AMBIENCE_MOOD_OPTIONS.map((option) => {
        const isSelected = ambienceMood === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            title={`Bầu không khí quán: ${option.label}`}
            data-testid={`ambience-mood-btn-${option.id}`}
            onClick={() => setAmbienceMood(option.id)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:min-w-0 sm:px-2 sm:py-0.5 ${
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
