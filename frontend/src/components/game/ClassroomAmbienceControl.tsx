import { AMBIENCE_MOOD_OPTIONS } from '../../game/graphics/graphicsQualityPolicy';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { SparklesIcon } from '../icons';
import { FloatingSegmentedControl } from './FloatingSegmentedControl';

export function ClassroomAmbienceControl() {
  const ambienceMood = useStudyCafeDisplayStore((s) => s.ambienceMood);
  const setAmbienceMood = useStudyCafeDisplayStore((s) => s.setAmbienceMood);
  const activeOption =
    AMBIENCE_MOOD_OPTIONS.find((o) => o.id === ambienceMood) ?? AMBIENCE_MOOD_OPTIONS[0];

  return (
    <FloatingSegmentedControl
      groupAriaLabel="Bầu không khí quán"
      controlTestId="ambience-mood-control"
      triggerTestId="ambience-mood-popover-trigger"
      triggerAriaLabel={`Bầu không khí quán: ${activeOption.label}`}
      optionsRowTestId="ambience-mood-options-row"
      desktopLabel="Ánh sáng"
      icon={<SparklesIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
      onSelect={setAmbienceMood}
      options={AMBIENCE_MOOD_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        ariaLabel: `Bầu không khí quán: ${option.label}`,
        title: `Bầu không khí quán: ${option.label}`,
        testId: `ambience-mood-btn-${option.id}`,
        selected: ambienceMood === option.id,
      }))}
    />
  );
}
