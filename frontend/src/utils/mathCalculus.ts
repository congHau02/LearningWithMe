export interface Point2D {
  x: number;
  y: number;
}

export interface ExtremumPoint extends Point2D {
  kind: 'max' | 'min';
}

export interface FunctionFeatures {
  yIntercept: Point2D | null;
  roots: Point2D[];
  extrema: ExtremumPoint[];
}

export type IntegralResult =
  | { ok: true; value: number; segments: number }
  | { ok: false; error: string };

const MAX_FEATURES_PER_KIND = 12;

export function numericalDerivative(fn: (x: number) => number, x0: number, h = 1e-4): number {
  const f1 = fn(x0 + h);
  const fm1 = fn(x0 - h);
  const f2 = fn(x0 + 2 * h);
  const fm2 = fn(x0 - 2 * h);

  if (Number.isFinite(f1) && Number.isFinite(fm1) && Number.isFinite(f2) && Number.isFinite(fm2)) {
    return (-f2 + 8 * f1 - 8 * fm1 + fm2) / (12 * h);
  }
  if (Number.isFinite(f1) && Number.isFinite(fm1)) {
    return (f1 - fm1) / (2 * h);
  }
  return Number.NaN;
}

export function definiteIntegralSimpson(
  fn: (x: number) => number,
  a: number,
  b: number,
  segments = 200,
): IntegralResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { ok: false, error: 'Cận tích phân a và b phải là số hữu hạn.' };
  }
  if (a === b) return { ok: true, value: 0, segments: 0 };

  const n = Math.max(2, segments % 2 === 0 ? segments : segments + 1);
  const h = (b - a) / n;
  const fa = fn(a);
  const fb = fn(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    return { ok: false, error: 'Hàm số không xác định tại cận tích phân.' };
  }

  let sum = fa + fb;
  for (let i = 1; i < n; i += 1) {
    const y = fn(a + i * h);
    if (!Number.isFinite(y)) {
      return { ok: false, error: 'Hàm số có điểm gián đoạn trong khoảng lấy tích phân.' };
    }
    sum += (i % 2 === 0 ? 2 : 4) * y;
  }

  const value = (h / 3) * sum;
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Không thể tính giá trị tích phân hữu hạn.' };
  }
  return { ok: true, value, segments: n };
}

function bisectZero(fn: (x: number) => number, left: number, right: number, iterations = 32): number | null {
  let lo = left;
  let hi = right;
  let fLo = fn(lo);
  const fHi = fn(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (Math.abs(fLo) < 1e-10) return lo;
  if (Math.abs(fHi) < 1e-10) return hi;
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) * 0.5;
    const fMid = fn(mid);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < 1e-10) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  const root = (lo + hi) * 0.5;
  const residual = fn(root);
  // Reject vertical asymptote sign flips (e.g. tan(x), 1/x)
  if (!Number.isFinite(residual) || Math.abs(residual) > 1e-2) return null;
  return root;
}

function dedupeByX<T extends Point2D>(points: T[], tol: number): T[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const unique: T[] = [];
  for (const pt of sorted) {
    const prev = unique[unique.length - 1];
    if (!prev || Math.abs(pt.x - prev.x) > tol) {
      unique.push(pt);
    }
  }
  return unique.slice(0, MAX_FEATURES_PER_KIND);
}

function snapZero(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : v;
}

export function analyzeFunctionFeatures(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  samples = 360,
): FunctionFeatures {
  const span = xMax - xMin;
  if (!Number.isFinite(span) || span <= 0) {
    return { yIntercept: null, roots: [], extrema: [] };
  }

  let yIntercept: Point2D | null = null;
  if (xMin <= 0 && xMax >= 0) {
    const y0 = fn(0);
    if (Number.isFinite(y0)) {
      yIntercept = { x: 0, y: snapZero(y0) };
    }
  }

  const step = span / samples;
  const tol = Math.max(1e-3, span * 0.004);
  const roots: Point2D[] = [];
  const extrema: ExtremumPoint[] = [];

  let prevX = xMin;
  let prevY = fn(prevX);
  let prevD = numericalDerivative(fn, prevX);

  for (let i = 1; i <= samples; i += 1) {
    const currX = xMin + i * step;
    const currY = fn(currX);
    const currD = numericalDerivative(fn, currX);

    if (Number.isFinite(prevY) && Number.isFinite(currY)) {
      if (Math.abs(currY) < 1e-7) {
        roots.push({ x: snapZero(currX), y: 0 });
      } else if (prevY * currY < 0) {
        const rx = bisectZero(fn, prevX, currX);
        if (rx !== null) roots.push({ x: snapZero(rx), y: 0 });
      }
    }

    if (Number.isFinite(prevD) && Number.isFinite(currD) && prevD * currD < 0) {
      const ex = bisectZero((t) => numericalDerivative(fn, t), prevX, currX, 24);
      if (ex !== null) {
        const ey = fn(ex);
        if (Number.isFinite(ey)) {
          extrema.push({
            x: snapZero(ex),
            y: snapZero(ey),
            kind: prevD > 0 ? 'max' : 'min',
          });
        }
      }
    }

    prevX = currX;
    prevY = currY;
    prevD = currD;
  }

  return {
    yIntercept,
    roots: dedupeByX(roots, tol),
    extrema: dedupeByX(extrema, tol),
  };
}

export function findCurveIntersections(
  fnA: (x: number) => number,
  fnB: (x: number) => number,
  xMin: number,
  xMax: number,
  samples = 320,
): Point2D[] {
  const span = xMax - xMin;
  if (!Number.isFinite(span) || span <= 0) return [];

  const diff = (x: number) => fnA(x) - fnB(x);
  const step = span / samples;
  const tol = Math.max(1e-3, span * 0.004);
  const points: Point2D[] = [];

  let prevX = xMin;
  let prevDiff = diff(prevX);

  for (let i = 1; i <= samples; i += 1) {
    const currX = xMin + i * step;
    const currDiff = diff(currX);

    if (Number.isFinite(prevDiff) && Number.isFinite(currDiff)) {
      if (Math.abs(currDiff) < 1e-7) {
        const y = fnA(currX);
        if (Number.isFinite(y)) points.push({ x: snapZero(currX), y: snapZero(y) });
      } else if (prevDiff * currDiff < 0) {
        const ix = bisectZero(diff, prevX, currX);
        if (ix !== null) {
          const y = fnA(ix);
          if (Number.isFinite(y)) points.push({ x: snapZero(ix), y: snapZero(y) });
        }
      }
    }

    prevX = currX;
    prevDiff = currDiff;
  }

  return dedupeByX(points, tol);
}
