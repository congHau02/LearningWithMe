import { useRef, useState, type KeyboardEvent } from 'react';
import { useCurriculumModeStore } from '../../stores/useCurriculumModeStore';
import { CalculatorIcon } from '../icons';
import { SolverCalculusPanel } from './SolverCalculusPanel';
import { LinearSystemSolverPanel, PolynomialSolverPanel } from './SolverEquationPanels';
import { SolverNumberTheoryPanel } from './SolverNumberTheoryPanel';
import type { SolverOutput } from './SolverPrimitives';

type SolverMode = 'calculus' | 'number-theory' | 'polynomial' | 'linear';

export interface ScientificSolverCardProps {
  canControl: boolean;
  onInsertToScratchpad: (latexLine: string) => void;
}

export function ScientificSolverCard({ canControl, onInsertToScratchpad }: ScientificSolverCardProps) {
  const curriculumMode = useCurriculumModeStore((s) => s.curriculumMode);
  const [mode, setMode] = useState<SolverMode>('calculus');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const solverTabs: readonly { id: SolverMode; label: string }[] = [
    { id: 'calculus', label: curriculumMode === 'THCS' ? 'Biểu thức & Căn' : 'Giải tích' },
    { id: 'number-theory', label: 'Số học' },
    { id: 'polynomial', label: 'Phương trình' },
    { id: 'linear', label: 'Hệ PT' },
  ];

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((curr) => (curr === msg ? null : curr)), 2400);
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % solverTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + solverTabs.length) % solverTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = solverTabs.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    setMode(solverTabs[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    void navigator.clipboard?.writeText(text).then(
      () => showNotice('Đã sao chép kết quả.'),
      () => showNotice('Không thể truy cập clipboard.'),
    );
  };

  const handleInsert = (out: SolverOutput) => {
    if (!canControl || !out.latex || out.isError) return;
    onInsertToScratchpad(out.latex);
    showNotice('Đã chèn kết quả vào Sổ nháp bước giải.');
  };

  return (
    <section
      data-testid="scientific-solver-card"
      aria-label="Máy tính giải tích và đại số"
      className="botanical-bezel-outer rounded-2xl p-1.5"
    >
      <div className="botanical-bezel-inner flex flex-col gap-3 rounded-xl p-3 text-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalculatorIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">
              {curriculumMode === 'THCS' ? 'Máy tính Toán THCS & Số học' : 'Máy tính Giải tích & Đại số'}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Chế độ máy tính">
            {solverTabs.map(({ id, label }, idx) => {
              const isActive = mode === id;
              return (
                <button
                  key={id}
                  ref={(el) => { tabRefs.current[idx] = el; }}
                  id={`solver-tab-${id}`}
                  type="button"
                  role="tab"
                  data-testid={`solver-mode-${id}`}
                  aria-selected={isActive}
                  aria-controls={`solver-tabpanel-${id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setMode(id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`min-h-[44px] cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px] ${
                    isActive
                      ? 'border-primary bg-primary font-semibold text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="solver-tabpanel-calculus"
          role="tabpanel"
          aria-labelledby="solver-tab-calculus"
          hidden={mode !== 'calculus'}
          className={mode === 'calculus' ? 'block' : 'hidden'}
        >
          <SolverCalculusPanel canControl={canControl} curriculumMode={curriculumMode} onCopy={handleCopy} onInsert={handleInsert} />
        </div>

        {mode !== 'calculus' ? (
          <div id={`solver-tabpanel-${mode}`} role="tabpanel" aria-labelledby={`solver-tab-${mode}`}>
            {mode === 'number-theory' ? (
              <SolverNumberTheoryPanel canControl={canControl} onCopy={handleCopy} onInsert={handleInsert} />
            ) : mode === 'polynomial' ? (
              <PolynomialSolverPanel canControl={canControl} curriculumMode={curriculumMode} onCopy={handleCopy} onInsert={handleInsert} />
            ) : (
              <LinearSystemSolverPanel canControl={canControl} curriculumMode={curriculumMode} onCopy={handleCopy} onInsert={handleInsert} />
            )}
          </div>
        ) : null}

        {notice ? (
          <span role="status" data-testid="solver-action-notice" className="text-[11px] font-medium text-ring">
            {notice}
          </span>
        ) : null}
      </div>
    </section>
  );
}
