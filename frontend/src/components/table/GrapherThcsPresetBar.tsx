interface GrapherThcsPresetBarProps {
  onSelectPreset: (fExpr: string) => void;
}

const THCS_PRESETS = [
  { id: 'linear', label: 'y = ax + b', fExpr: '2x + 1', title: 'Hàm số bậc nhất y = 2x + 1' },
  { id: 'parabola', label: 'y = ax²', fExpr: '0.5*x^2', title: 'Parabol y = 0.5x² (Toán 9)' },
] as const;

export function GrapherThcsPresetBar({ onSelectPreset }: GrapherThcsPresetBarProps) {
  return (
    <div
      data-testid="grapher-thcs-presets"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="text-[11px] font-medium text-muted-foreground">Mẫu THCS:</span>
      {THCS_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          data-testid={`grapher-preset-${preset.id}`}
          title={preset.title}
          onClick={() => onSelectPreset(preset.fExpr)}
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-foreground transition-botanical hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[30px] sm:text-[11px]"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
