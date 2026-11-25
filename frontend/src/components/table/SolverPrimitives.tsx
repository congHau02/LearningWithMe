import type { KeyboardEvent } from 'react';
import { bigRatToNumber, parseBigRat } from '../../utils/mathExact';
import type { CurriculumMode } from '../../utils/mathLatex';
import { CopyIcon, ScratchpadIcon } from '../icons';

export interface SolverOutput {
  summary: string;
  latex: string;
  isError?: boolean;
}

export interface SolverSubPanelProps {
  canControl: boolean;
  curriculumMode?: CurriculumMode;
  onCopy: (latex: string) => void;
  onInsert: (out: SolverOutput) => void;
}

export const SOLVER_INPUT_CLASS =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export const SOLVER_ACTION_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-botanical';

export const stopSolverEsc = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.currentTarget.blur();
  }
};

export function parseSolverNum(raw: string): number {
  const rat = parseBigRat(raw);
  if (rat) return bigRatToNumber(rat);
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : 0;
}

export function SolverOutputActions({
  output,
  canControl,
  copyTestId,
  insertTestId,
  onCopy,
  onInsert,
}: {
  output: SolverOutput;
  canControl: boolean;
  copyTestId: string;
  insertTestId: string;
  onCopy: (latex: string) => void;
  onInsert: (out: SolverOutput) => void;
}) {
  const disabled = Boolean(output.isError || !output.latex);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        data-testid={copyTestId}
        aria-label="Sao chép kết quả"
        disabled={disabled}
        onClick={() => onCopy(output.latex)}
        className={`inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md border border-border bg-background px-2 text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[34px] sm:min-w-[34px] ${SOLVER_ACTION_FOCUS}`}
      >
        <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid={insertTestId}
        disabled={disabled || !canControl}
        title={canControl ? 'Chèn kết quả vào Sổ nháp bước giải' : 'Chỉ Host / Co-Host được chèn vào Sổ nháp'}
        onClick={() => onInsert(output)}
        className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[34px] ${SOLVER_ACTION_FOCUS}`}
      >
        <ScratchpadIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Chèn vào Sổ nháp</span>
      </button>
    </div>
  );
}
