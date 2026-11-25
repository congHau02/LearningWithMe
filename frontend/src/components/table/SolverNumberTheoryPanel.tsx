import { useMemo, useState } from 'react';
import { computeGcdLcm, factorizePrime } from '../../utils/mathNumberTheory';
import {
  SOLVER_INPUT_CLASS,
  SolverOutputActions,
  stopSolverEsc,
  type SolverOutput,
  type SolverSubPanelProps,
} from './SolverPrimitives';

export function SolverNumberTheoryPanel({ canControl, onCopy, onInsert }: SolverSubPanelProps) {
  const [primeInput, setPrimeInput] = useState('360');
  const [gcdInput, setGcdInput] = useState('24, 36');

  const primeOut = useMemo<SolverOutput>(() => {
    const trimmed = primeInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      return { summary: 'Nhập số nguyên dương ≥ 2.', latex: '', isError: true };
    }
    const res = factorizePrime(Number(trimmed));
    if (!res.ok) return { summary: res.error, latex: '', isError: true };
    return { summary: res.text, latex: `$${res.latex}$` };
  }, [primeInput]);

  const gcdOut = useMemo<SolverOutput>(() => {
    const tokens = gcdInput
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.some((t) => !/^\d+$/.test(t))) {
      return { summary: 'Nhập 2–6 số nguyên dương (VD: 24, 36).', latex: '', isError: true };
    }
    const res = computeGcdLcm(tokens.map(Number));
    if (!res.ok) return { summary: res.error, latex: '', isError: true };
    return { summary: res.text, latex: `$${res.latex}$` };
  }, [gcdInput]);

  return (
    <div className="flex flex-col gap-2.5" data-testid="solver-number-theory-panel">
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/70 p-2.5">
        <label htmlFor="solver-prime-input" className="text-[11px] font-medium text-muted-foreground">
          Phân tích ra thừa số nguyên tố
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            id="solver-prime-input"
            data-testid="solver-prime-input"
            type="text"
            inputMode="numeric"
            value={primeInput}
            onChange={(e) => setPrimeInput(e.target.value)}
            onKeyDown={stopSolverEsc}
            placeholder="VD: 360"
            className={`${SOLVER_INPUT_CLASS} w-28`}
          />
          <span
            data-testid="solver-prime-result"
            className={`min-w-0 flex-1 rounded-md border px-2.5 py-1.5 font-mono text-xs ${
              primeOut.isError ? 'border-destructive/50 bg-destructive/20 text-destructive-foreground' : 'border-border bg-card text-ring'
            }`}
          >
            {primeOut.summary}
          </span>
          <SolverOutputActions
            output={primeOut}
            canControl={canControl}
            copyTestId="solver-prime-copy-btn"
            insertTestId="solver-prime-insert-btn"
            onCopy={onCopy}
            onInsert={onInsert}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/70 p-2.5">
        <label htmlFor="solver-gcd-input" className="text-[11px] font-medium text-muted-foreground">
          Tìm ƯCLN và BCNN (nhập 2–6 số, cách nhau bởi dấu phẩy)
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            id="solver-gcd-input"
            data-testid="solver-gcd-input"
            type="text"
            value={gcdInput}
            onChange={(e) => setGcdInput(e.target.value)}
            onKeyDown={stopSolverEsc}
            placeholder="VD: 24, 36"
            className={`${SOLVER_INPUT_CLASS} w-36`}
          />
          <span
            data-testid="solver-gcd-result"
            className={`min-w-0 flex-1 rounded-md border px-2.5 py-1.5 font-mono text-xs ${
              gcdOut.isError ? 'border-destructive/50 bg-destructive/20 text-destructive-foreground' : 'border-border bg-card text-primary'
            }`}
          >
            {gcdOut.summary}
          </span>
          <SolverOutputActions
            output={gcdOut}
            canControl={canControl}
            copyTestId="solver-gcd-copy-btn"
            insertTestId="solver-gcd-insert-btn"
            onCopy={onCopy}
            onInsert={onInsert}
          />
        </div>
      </div>
    </div>
  );
}
