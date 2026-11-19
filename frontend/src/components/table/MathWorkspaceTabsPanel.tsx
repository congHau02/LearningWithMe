import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BoardIcon, GraphCurveIcon, ScratchpadIcon } from '../icons';
import { HomeworkDeckPanel } from './HomeworkDeckPanel';
import { MathGrapherSolverPanel } from './MathGrapherSolverPanel';
import { MathScratchpadPanel } from './MathScratchpadPanel';

export type MathWorkspaceTabId = 'board' | 'scratchpad' | 'grapher';

interface MathWorkspaceTabsPanelProps {
  tableId: string;
  canControl: boolean;
  dragHandle?: ReactNode;
}

const MATH_TABS: readonly {
  id: MathWorkspaceTabId;
  label: string;
  Icon: typeof BoardIcon;
}[] = [
  { id: 'board', label: 'Bảng giải bài', Icon: BoardIcon },
  { id: 'scratchpad', label: 'Sổ nháp bước giải', Icon: ScratchpadIcon },
  { id: 'grapher', label: 'Đồ thị f(x) & Máy tính', Icon: GraphCurveIcon },
];

/** 3-tab Math Workspace host that preserves mounted state across Board, Scratchpad, and Grapher tabs. */
export function MathWorkspaceTabsPanel({ tableId, canControl, dragHandle }: MathWorkspaceTabsPanelProps) {
  const [activeTab, setActiveTab] = useState<MathWorkspaceTabId>('board');
  const [hasVisitedGrapher, setHasVisitedGrapher] = useState(false);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTab = (next: MathWorkspaceTabId) => {
    if (next === 'grapher') setHasVisitedGrapher(true);
    setActiveTab(next);
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % MATH_TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + MATH_TABS.length) % MATH_TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = MATH_TABS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    selectTab(MATH_TABS[nextIdx].id);
    tabButtonRefs.current[nextIdx]?.focus();
  };

  return (
    <div data-testid="math-workspace-tabs-panel" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-1.5">
        {dragHandle}
        <div
          role="tablist"
          aria-label="Không gian giải toán bàn học"
          className="flex flex-1 flex-wrap items-center gap-1.5"
        >
          {MATH_TABS.map(({ id, label, Icon }, idx) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  tabButtonRefs.current[idx] = el;
                }}
                id={`math-tab-${id}`}
                type="button"
                role="tab"
                data-testid={`math-workspace-tab-${id}`}
                aria-selected={isActive}
                aria-controls={`math-tabpanel-${id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[36px] ${
                  isActive
                    ? 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                    : 'border-border bg-background font-medium text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="math-tabpanel-board"
        role="tabpanel"
        aria-labelledby="math-tab-board"
        hidden={activeTab !== 'board'}
        className={activeTab === 'board' ? 'block' : 'hidden'}
      >
        <HomeworkDeckPanel tableId={tableId} canControl={canControl} />
      </div>

      <div
        id="math-tabpanel-scratchpad"
        role="tabpanel"
        aria-labelledby="math-tab-scratchpad"
        hidden={activeTab !== 'scratchpad'}
        className={activeTab === 'scratchpad' ? 'block' : 'hidden'}
      >
        <MathScratchpadPanel tableId={tableId} canControl={canControl} />
      </div>

      <div
        id="math-tabpanel-grapher"
        role="tabpanel"
        aria-labelledby="math-tab-grapher"
        hidden={activeTab !== 'grapher'}
        className={activeTab === 'grapher' ? 'block' : 'hidden'}
      >
        {hasVisitedGrapher ? (
          <MathGrapherSolverPanel
            tableId={tableId}
            canControl={canControl}
            onSwitchToBoard={() => selectTab('board')}
          />
        ) : null}
      </div>
    </div>
  );
}
