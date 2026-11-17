export interface SpeakingEqualizerProps {
  speaking: boolean;
  micLive?: boolean;
  compact?: boolean;
  testId?: string;
  label?: string;
}

const EQUALIZER_BARS = [
  { heightClass: 'h-2', idleScaleClass: 'scale-y-50' },
  { heightClass: 'h-3', idleScaleClass: 'scale-y-40' },
  { heightClass: 'h-1.5', idleScaleClass: 'scale-y-50' },
] as const;

/**
 * Fixed-size 3-bar equalizer slot that animates exclusively via opacity, color,
 * and transform so toggling speaking state produces zero layout shift (CLS = 0).
 */
export function SpeakingEqualizer({
  speaking,
  micLive = false,
  compact = false,
  testId,
  label,
}: SpeakingEqualizerProps) {
  const containerClasses = compact
    ? 'inline-flex h-3.5 w-4 shrink-0 items-end justify-center gap-0.5'
    : 'inline-flex h-5 w-6 shrink-0 items-end justify-center gap-0.5 rounded border px-1 py-0.5';

  const stateClasses = speaking
    ? compact
      ? 'opacity-100'
      : 'border-emerald-500/40 bg-emerald-500/20 opacity-100'
    : micLive
      ? compact
        ? 'opacity-35'
        : 'border-border/80 bg-card/70 opacity-40'
      : compact
        ? 'opacity-15'
        : 'border-border/60 bg-card/50 opacity-20';

  const barColor = speaking ? 'bg-emerald-400' : 'bg-muted-foreground/40';

  return (
    <span
      data-testid={testId}
      data-speaking={speaking ? 'true' : 'false'}
      role={speaking && label ? 'img' : undefined}
      aria-label={speaking && label ? label : undefined}
      aria-hidden={!speaking || !label || undefined}
      className={`${containerClasses} ${stateClasses} transition-opacity duration-150`}
    >
      {EQUALIZER_BARS.map((bar, index) => (
        <span
          key={index}
          className={`${bar.heightClass} w-0.5 origin-bottom rounded transition-transform duration-150 ${barColor} ${
            speaking ? 'scale-y-100 animate-pulse' : bar.idleScaleClass
          }`}
        />
      ))}
    </span>
  );
}
