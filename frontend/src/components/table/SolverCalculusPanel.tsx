import { useMemo, useState } from 'react';
import { formatMathNumber } from '../../utils/mathAlgebraSolver';
import { definiteIntegralSimpson, numericalDerivative } from '../../utils/mathCalculus';
import { compileMathExpression, evaluateConstantExpression } from '../../utils/mathExpression';
import {
  SOLVER_INPUT_CLASS,
  SolverOutputActions,
  stopSolverEsc,
  type SolverOutput,
  type SolverSubPanelProps,
} from './SolverPrimitives';

export function SolverCalculusPanel({ canControl, onCopy, onInsert }: SolverSubPanelProps) {
  const [exprInput, setExprInput] = useState('sin(pi/6) + ln(e^2) + sqrt(16)');
  const [calcFn, setCalcFn] = useState('x^2');
  const [x0Input, setX0Input] = useState('2');
  const [aInput, setAInput] = useState('0');
  const [bInput, setBInput] = useState('3');

  const exprResult = useMemo<SolverOutput>(() => {
    const res = evaluateConstantExpression(exprInput);
    if (!res.ok) return { summary: res.error, latex: '', isError: true };
    const formatted = formatMathNumber(res.value);
    return { summary: `= ${formatted}`, latex: `$${exprInput.trim()} = ${formatted}$` };
  }, [exprInput]);

  const calculusResult = useMemo<{ deriv: SolverOutput; integral: SolverOutput }>(() => {
    const compiled = compileMathExpression(calcFn);
    if (!compiled.ok) {
      const errOut: SolverOutput = { summary: compiled.error, latex: '', isError: true };
      return { deriv: errOut, integral: errOut };
    }
    const x0 = Number(x0Input);
    const dVal = Number.isFinite(x0) ? numericalDerivative(compiled.evaluate, x0) : Number.NaN;
    const deriv: SolverOutput = Number.isFinite(dVal)
      ? {
          summary: `f'(${formatMathNumber(x0)}) ≈ ${formatMathNumber(dVal)}`,
          latex: `$f'(${formatMathNumber(x0)}) \\approx ${formatMathNumber(dVal)}$ với $f(x) = ${compiled.normalized}$`,
        }
      : { summary: 'Không tính được đạo hàm tại x₀.', latex: '', isError: true };

    const a = Number(aInput);
    const b = Number(bInput);
    const intRes = definiteIntegralSimpson(compiled.evaluate, a, b);
    const integral: SolverOutput = intRes.ok
      ? {
          summary: `∫[${formatMathNumber(a)}, ${formatMathNumber(b)}] ≈ ${formatMathNumber(intRes.value)}`,
          latex: `$$\\int_{${formatMathNumber(a)}}^{${formatMathNumber(b)}} (${compiled.normalized})\\,dx \\approx ${formatMathNumber(intRes.value)}$$`,
        }
      : { summary: intRes.error, latex: '', isError: true };

    return { deriv, integral };
  }, [aInput, bInput, calcFn, x0Input]);

  return (
    <div className="flex flex-col gap-2.5" data-testid="solver-calculus-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="solver-const-expr" className="text-[11px] font-medium text-muted-foreground">
          Tính biểu thức khoa học (sin, cos, tan, exp, ln, log, sqrt, abs, pi, e)
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            id="solver-const-expr"
            data-testid="solver-expr-input"
            type="text"
            value={exprInput}
            onChange={(e) => setExprInput(e.target.value)}
            onKeyDown={stopSolverEsc}
            className={`${SOLVER_INPUT_CLASS} min-w-44 flex-1`}
          />
          <span
            data-testid="solver-expr-result"
            className={`rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs ${
              exprResult.isError ? 'text-rose-300' : 'text-ring'
            }`}
          >
            {exprResult.summary}
          </span>
          <SolverOutputActions
            output={exprResult}
            canControl={canControl}
            copyTestId="solver-expr-copy-btn"
            insertTestId="solver-expr-insert-btn"
            onCopy={onCopy}
            onInsert={onInsert}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-background/70 p-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:col-span-2">
          <span>Hàm số f(x) để tính đạo hàm & tích phân (Simpson)</span>
          <input
            data-testid="solver-calc-fn-input"
            type="text"
            value={calcFn}
            onChange={(e) => setCalcFn(e.target.value)}
            onKeyDown={stopSolverEsc}
            className={SOLVER_INPUT_CLASS}
          />
        </label>

        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
          <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Đạo hàm tại x₀ =</span>
            <input
              data-testid="solver-deriv-x0"
              type="text"
              inputMode="decimal"
              value={x0Input}
              onChange={(e) => setX0Input(e.target.value)}
              onKeyDown={stopSolverEsc}
              className={`${SOLVER_INPUT_CLASS} w-20`}
            />
          </label>
          <span
            data-testid="solver-deriv-result"
            className={`font-mono text-xs ${calculusResult.deriv.isError ? 'text-rose-300' : 'text-primary'}`}
          >
            {calculusResult.deriv.summary}
          </span>
          <SolverOutputActions
            output={calculusResult.deriv}
            canControl={canControl}
            copyTestId="solver-deriv-copy-btn"
            insertTestId="solver-deriv-insert-btn"
            onCopy={onCopy}
            onInsert={onInsert}
          />
        </div>

        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
          <div className="flex items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
            <span>Tích phân từ</span>
            <input
              data-testid="solver-int-a"
              aria-label="Cận dưới a"
              type="text"
              inputMode="decimal"
              value={aInput}
              onChange={(e) => setAInput(e.target.value)}
              onKeyDown={stopSolverEsc}
              className={`${SOLVER_INPUT_CLASS} w-16`}
            />
            <span>đến</span>
            <input
              data-testid="solver-int-b"
              aria-label="Cận trên b"
              type="text"
              inputMode="decimal"
              value={bInput}
              onChange={(e) => setBInput(e.target.value)}
              onKeyDown={stopSolverEsc}
              className={`${SOLVER_INPUT_CLASS} w-16`}
            />
          </div>
          <span
            data-testid="solver-int-result"
            className={`font-mono text-xs ${calculusResult.integral.isError ? 'text-rose-300' : 'text-ring'}`}
          >
            {calculusResult.integral.summary}
          </span>
          <SolverOutputActions
            output={calculusResult.integral}
            canControl={canControl}
            copyTestId="solver-int-copy-btn"
            insertTestId="solver-int-insert-btn"
            onCopy={onCopy}
            onInsert={onInsert}
          />
        </div>
      </div>
    </div>
  );
}
