import {
  GRAPHICS_QUALITY_OPTIONS,
  getGraphicsQualityOptionState,
} from '../../game/graphics/graphicsQualityPolicy';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { PaletteIcon } from '../icons';
import { FloatingSegmentedControl } from './FloatingSegmentedControl';

export function ClassroomGraphicsControl() {
  const graphicsQuality = useStudyCafeDisplayStore((s) => s.graphicsQuality);
  const rendererKind = useStudyCafeDisplayStore((s) => s.rendererKind);
  const prefersReducedMotion = useStudyCafeDisplayStore((s) => s.prefersReducedMotion);
  const setGraphicsQuality = useStudyCafeDisplayStore((s) => s.setGraphicsQuality);
  const activeOption =
    GRAPHICS_QUALITY_OPTIONS.find((o) => o.id === graphicsQuality) ?? GRAPHICS_QUALITY_OPTIONS[0];

  return (
    <FloatingSegmentedControl
      groupAriaLabel="Mức chất lượng đồ họa"
      controlTestId="graphics-quality-control"
      triggerTestId="graphics-quality-popover-trigger"
      triggerAriaLabel={`Mức chất lượng đồ họa: ${activeOption.label}`}
      optionsRowTestId="graphics-quality-options-row"
      desktopLabel="Đồ họa"
      icon={<PaletteIcon className="h-3.5 w-3.5 text-botanical-emerald" aria-hidden="true" />}
      onSelect={setGraphicsQuality}
      options={GRAPHICS_QUALITY_OPTIONS.map((option) => {
        const { disabled, title } = getGraphicsQualityOptionState({
          tier: option.id,
          label: option.label,
          rendererKind,
          prefersReducedMotion,
        });
        return {
          id: option.id,
          label: option.label,
          ariaLabel: `Mức chất lượng đồ họa: ${option.label}`,
          title,
          testId: `graphics-quality-btn-${option.id}`,
          selected: graphicsQuality === option.id,
          disabled,
        };
      })}
    />
  );
}
