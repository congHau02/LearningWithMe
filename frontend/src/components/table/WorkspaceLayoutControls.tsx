import type { WorkspaceLayoutMode } from '../../hooks/useWorkspaceLayout';
import { ArrowUpDownIcon } from '../icons';

interface WorkspaceLayoutControlsProps {
  layoutMode: WorkspaceLayoutMode;
  onChangeLayout: (mode: WorkspaceLayoutMode) => void;
  onSwapPanels: () => void;
}

const LAYOUT_OPTIONS: ReadonlyArray<{
  mode: WorkspaceLayoutMode;
  testId: string;
  label: string;
  shortLabel: string;
  desktopOnly?: boolean;
}> = [
  { mode: 'VIDEO_FIRST', testId: 'layout-mode-video', label: 'Video trước', shortLabel: 'Video' },
  { mode: 'HOMEWORK_FIRST', testId: 'layout-mode-homework', label: 'Bài tập trước', shortLabel: 'Bài tập' },
  {
    mode: 'SPLIT_HORIZONTAL',
    testId: 'layout-mode-split',
    label: 'Chia đôi (Desktop)',
    shortLabel: 'Chia đôi',
    desktopOnly: true,
  },
];

/** Accessible 1-click layout switcher and swap control for Table Workspace panels. */
export function WorkspaceLayoutControls({
  layoutMode,
  onChangeLayout,
  onSwapPanels,
}: WorkspaceLayoutControlsProps) {
  return (
    <div
      data-testid="workspace-layout-controls"
      role="group"
      aria-label="Bố cục Video và Bảng bài tập"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-[#16221E]/80 px-3 py-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-medium text-muted-foreground">Bố cục:</span>
        {LAYOUT_OPTIONS.map((option) => {
          const isActive = layoutMode === option.mode;
          const visibilityClass = option.desktopOnly ? 'hidden lg:inline-flex' : 'inline-flex';
          return (
            <button
              key={option.mode}
              type="button"
              data-testid={option.testId}
              aria-pressed={isActive}
              onClick={() => onChangeLayout(option.mode)}
              className={`${visibilityClass} min-h-[44px] items-center rounded-lg border px-2.5 py-1 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[32px] ${
                isActive
                  ? 'border-primary/60 bg-primary/20 text-primary-foreground font-semibold'
                  : 'border-border bg-[#0F1714]/80 text-muted-foreground hover:bg-[#243630] hover:text-foreground'
              }`}
            >
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">{option.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="swap-workspace-panels-btn"
        aria-label="Đổi vị trí Video và Bảng bài tập"
        onClick={onSwapPanels}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 font-semibold text-primary transition hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[32px]"
      >
        <ArrowUpDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Đổi vị trí</span>
      </button>
    </div>
  );
}
