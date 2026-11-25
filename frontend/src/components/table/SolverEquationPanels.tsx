import { useMemo, useState } from 'react';
import { solveCubic, solveLinearSystem, solveQuadratic } from '../../utils/mathAlgebraSolver';
import {
  parseSolverNum,
  SOLVER_ACTION_FOCUS,
  SOLVER_INPUT_CLASS,
  SolverOutputActions,
  stopSolverEsc,
  type SolverOutput,
  type SolverSubPanelProps,
} from './SolverPrimitives';

export function PolynomialSolverPanel({ canControl, onCopy, onInsert }: SolverSubPanelProps) {
  const [degree, setDegree] = useState<2 | 3>(2);
  const [a, setA] = useState('1');
  const [b, setB] = useState('-5');
  const [c, setC] = useState('6');
  const [d, setD] = useState('-2');

  const result = useMemo<SolverOutput>(() => {
    const na = parseSolverNum(a);
    const nb = parseSolverNum(b);
    const nc = parseSolverNum(c);
    if (degree === 2) {
      const sol = solveQuadratic(na, nb, nc);
      return {
        summary: sol.summary,
        latex: `$$${na}x^2 ${nb >= 0 ? '+' : ''} ${nb}x ${nc >= 0 ? '+' : ''} ${nc} = 0 \\implies ${sol.latex}$$`,
      };
    }
    const nd = parseSolverNum(d);
    const sol = solveCubic(na, nb, nc, nd);
    return {
      summary: sol.summary,
      latex: `$$${na}x^3 ${nb >= 0 ? '+' : ''} ${nb}x^2 ${nc >= 0 ? '+' : ''} ${nc}x ${nd >= 0 ? '+' : ''} ${nd} = 0 \\implies ${sol.latex}$$`,
    };
  }, [a, b, c, d, degree]);

  return (
    <div className="flex flex-col gap-2" data-testid="solver-polynomial-panel">
      <div className="flex flex-wrap items-center gap-1.5">
        {([2, 3] as const).map((deg) => (
          <button
            key={deg}
            type="button"
            data-testid={`solver-poly-deg-${deg}`}
            aria-pressed={degree === deg}
            onClick={() => setDegree(deg)}
            className={`min-h-[44px] cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium sm:min-h-[34px] ${SOLVER_ACTION_FOCUS} ${
              degree === deg ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {deg === 2 ? 'Bậc 2 (ax²+bx+c=0)' : 'Bậc 3 (ax³+bx²+cx+d=0)'}
          </button>
        ))}
      </div>

      <div className={`grid gap-2 ${degree === 2 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {[
          { label: 'a', val: a, set: setA },
          { label: 'b', val: b, set: setB },
          { label: 'c', val: c, set: setC },
          ...(degree === 3 ? [{ label: 'd', val: d, set: setD }] : []),
        ].map(({ label, val, set }) => (
          <label key={label} className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
            <span>Hệ số {label}</span>
            <input data-testid={`solver-poly-${label}`} type="text" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} onKeyDown={stopSolverEsc} className={SOLVER_INPUT_CLASS} />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
        <span data-testid="solver-poly-result" className="font-mono text-xs text-foreground">{result.summary}</span>
        <SolverOutputActions output={result} canControl={canControl} copyTestId="solver-poly-copy-btn" insertTestId="solver-poly-use-btn" onCopy={onCopy} onInsert={onInsert} />
      </div>
    </div>
  );
}

interface LinearRow { coeffs: [string, string, string]; rhs: string; }

export function LinearSystemSolverPanel({ canControl, onCopy, onInsert }: SolverSubPanelProps) {
  const [size, setSize] = useState<2 | 3>(2);
  const [rows, setRows] = useState<LinearRow[]>([
    { coeffs: ['2', '1', '0'], rhs: '5' },
    { coeffs: ['1', '-1', '0'], rhs: '1' },
    { coeffs: ['0', '1', '2'], rhs: '4' },
  ]);

  const updateCoeff = (r: number, c: number, val: string) =>
    setRows((prev) => prev.map((row, ri) => (ri === r ? { ...row, coeffs: row.coeffs.map((v, ci) => (ci === c ? val : v)) as [string, string, string] } : row)));

  const updateRhs = (r: number, val: string) =>
    setRows((prev) => prev.map((row, ri) => (ri === r ? { ...row, rhs: val } : row)));

  const result = useMemo<SolverOutput>(() => {
    const active = rows.slice(0, size);
    const sol = solveLinearSystem(active.map((r) => r.coeffs.slice(0, size).map(parseSolverNum)), active.map((r) => parseSolverNum(r.rhs)));
    return { summary: sol.summary, latex: `$$\\text{Hệ } ${size}\\times${size} \\implies ${sol.latex}$$` };
  }, [rows, size]);

  const varLabels = size === 2 ? ['x', 'y'] : ['x', 'y', 'z'];

  return (
    <div className="flex flex-col gap-2" data-testid="solver-linear-panel">
      <div className="flex items-center gap-1.5">
        {([2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`solver-linear-size-${n}`}
            aria-pressed={size === n}
            onClick={() => setSize(n)}
            className={`min-h-[44px] cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium sm:min-h-[34px] ${SOLVER_ACTION_FOCUS} ${
              size === n ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            Hệ {n}×{n}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.slice(0, size).map((row, r) => (
          <div key={r} className={`grid gap-1.5 ${size === 2 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {varLabels.map((v, c) => (
              <input key={`${r}-${v}`} data-testid={`solver-lin-r${r}-c${c}`} aria-label={`Phương trình ${r + 1} hệ số ${v}`} type="text" inputMode="decimal" value={row.coeffs[c]} onChange={(e) => updateCoeff(r, c, e.target.value)} onKeyDown={stopSolverEsc} placeholder={v} className={SOLVER_INPUT_CLASS} />
            ))}
            <input data-testid={`solver-lin-r${r}-rhs`} aria-label={`Phương trình ${r + 1} vế phải`} type="text" inputMode="decimal" value={row.rhs} onChange={(e) => updateRhs(r, e.target.value)} onKeyDown={stopSolverEsc} placeholder="=" className={SOLVER_INPUT_CLASS} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
        <span data-testid="solver-linear-result" className="font-mono text-xs text-foreground">{result.summary}</span>
        <SolverOutputActions output={result} canControl={canControl} copyTestId="solver-linear-copy-btn" insertTestId="solver-linear-use-btn" onCopy={onCopy} onInsert={onInsert} />
      </div>
    </div>
  );
}
