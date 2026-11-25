import { useCallback, useMemo, useState } from 'react';
import { formatApiError } from '../services/apiClient';
import { uploadHomeworkImage } from '../services/tableApi';
import { useCurriculumModeStore } from '../stores/useCurriculumModeStore';
import { useTableStore } from '../stores/useTableStore';
import { formatMathNumber } from '../utils/mathAlgebraSolver';
import { analyzeFunctionFeatures, findCurveIntersections } from '../utils/mathCalculus';
import { compileMathExpression } from '../utils/mathExpression';
import {
  DEFAULT_GRAPH_VIEWPORT,
  exportGraphToWebpFile,
  GRAPH_CURVE_COLORS,
  type GraphMarker,
  type GraphViewport,
  type PlottedCurve,
} from '../utils/mathGraphRenderer';

export type FunctionSlotId = 'f' | 'g' | 'h';

export interface FunctionSlotState {
  id: FunctionSlotId;
  label: string;
  expression: string;
  color: string;
  error: string | null;
}

const MAX_SLIDES = 5;
const INITIAL_EXPRESSIONS: Record<FunctionSlotId, string> = {
  f: 'x^2 - 4',
  g: 'x',
  h: '',
};

const SLOT_META: readonly { id: FunctionSlotId; label: string; color: string }[] = [
  { id: 'f', label: 'f(x)', color: GRAPH_CURVE_COLORS[0] },
  { id: 'g', label: 'g(x)', color: GRAPH_CURVE_COLORS[1] },
  { id: 'h', label: 'h(x)', color: GRAPH_CURVE_COLORS[2] },
];

export function useFunctionGrapher(tableId: string, canControl: boolean, onSwitchToBoard: () => void) {
  const slideCount = useTableStore((s) => s.homeworkSlides.length);
  const curriculumMode = useCurriculumModeStore((s) => s.curriculumMode);
  const [expressions, setExpressions] = useState<Record<FunctionSlotId, string>>(INITIAL_EXPRESSIONS);
  const [showDerivativeOfF, setShowDerivativeOfF] = useState(false);
  const [viewport, setViewport] = useState<GraphViewport>(DEFAULT_GRAPH_VIEWPORT);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const { slots, curves } = useMemo(() => {
    const nextSlots: FunctionSlotState[] = [];
    const nextCurves: PlottedCurve[] = [];

    for (const meta of SLOT_META) {
      const expr = expressions[meta.id];
      if (!expr.trim()) {
        nextSlots.push({ ...meta, expression: expr, error: null });
        continue;
      }
      const compiled = compileMathExpression(expr);
      if (!compiled.ok) {
        nextSlots.push({ ...meta, expression: expr, error: compiled.error });
        continue;
      }
      nextSlots.push({ ...meta, expression: expr, error: null });
      nextCurves.push({
        id: meta.id,
        label: meta.label,
        expression: compiled.normalized,
        color: meta.color,
        evaluate: compiled.evaluate,
      });
    }
    return { slots: nextSlots, curves: nextCurves };
  }, [expressions]);

  const markers = useMemo<GraphMarker[]>(() => {
    const result: GraphMarker[] = [];
    for (const curve of curves) {
      const features = analyzeFunctionFeatures(curve.evaluate, viewport.xMin, viewport.xMax, 280);
      if (features.yIntercept && features.yIntercept.y >= viewport.yMin && features.yIntercept.y <= viewport.yMax) {
        result.push({
          x: 0,
          y: features.yIntercept.y,
          kind: 'intercept',
          label: `${curve.id}(0)=${formatMathNumber(features.yIntercept.y, 2)}`,
          color: curve.color,
        });
      }
      if (viewport.yMin <= 0 && viewport.yMax >= 0) {
        for (const r of features.roots.slice(0, 4)) {
          result.push({
            x: r.x,
            y: 0,
            kind: 'root',
            label: `Nghiệm ${curve.id}: (${formatMathNumber(r.x, 2)}, 0)`,
            color: curve.color,
          });
        }
      }
      for (const ex of features.extrema.slice(0, 4)) {
        if (ex.y < viewport.yMin || ex.y > viewport.yMax) continue;
        result.push({
          x: ex.x,
          y: ex.y,
          kind: 'extremum',
          label: `${ex.kind === 'max' ? 'CĐ' : 'CT'} ${curve.id}: (${formatMathNumber(ex.x, 2)}, ${formatMathNumber(ex.y, 2)})`,
          color: curve.color,
        });
      }
    }

    const intersections: GraphMarker[] = [];
    for (let i = 0; i < curves.length; i += 1) {
      for (let j = i + 1; j < curves.length; j += 1) {
        const pts = findCurveIntersections(curves[i].evaluate, curves[j].evaluate, viewport.xMin, viewport.xMax, 240);
        for (const pt of pts.slice(0, 4)) {
          if (pt.y < viewport.yMin || pt.y > viewport.yMax) continue;
          intersections.push({
            x: pt.x,
            y: pt.y,
            kind: 'intersection',
            label: `${curves[i].id}∩${curves[j].id}: (${formatMathNumber(pt.x, 2)}, ${formatMathNumber(pt.y, 2)})`,
            color: GRAPH_CURVE_COLORS[2],
          });
        }
      }
    }
    return [...intersections, ...result];
  }, [curves, viewport.xMax, viewport.xMin, viewport.yMax, viewport.yMin]);

  const setFunctionExpression = useCallback((id: FunctionSlotId, value: string) => {
    setExpressions((prev) => ({ ...prev, [id]: value }));
  }, []);

  const zoomViewport = useCallback((factor: number, anchor?: { x: number; y: number }) => {
    setViewport((vp) => {
      const cx = anchor ? anchor.x : (vp.xMin + vp.xMax) / 2;
      const cy = anchor ? anchor.y : (vp.yMin + vp.yMax) / 2;
      const nextHalfX = Math.max(0.25, Math.min(200, ((vp.xMax - vp.xMin) / 2) * factor));
      const nextHalfY = Math.max(0.15, Math.min(200, ((vp.yMax - vp.yMin) / 2) * factor));
      return {
        xMin: cx - nextHalfX,
        xMax: cx + nextHalfX,
        yMin: cy - nextHalfY,
        yMax: cy + nextHalfY,
      };
    });
  }, []);

  const panViewport = useCallback((dxMath: number, dyMath: number) => {
    setViewport((vp) => ({
      xMin: vp.xMin - dxMath,
      xMax: vp.xMax - dxMath,
      yMin: vp.yMin - dyMath,
      yMax: vp.yMax - dyMath,
    }));
  }, []);

  const resetViewport = useCallback(() => setViewport(DEFAULT_GRAPH_VIEWPORT), []);

  const exportToHomeworkSlide = useCallback(async () => {
    if (!canControl || isExporting) return;
    if (slideCount >= MAX_SLIDES) {
      setExportStatus({ kind: 'err', text: 'Bàn học đã đạt tối đa 5 trang bài tập.' });
      return;
    }
    setExportStatus(null);
    setIsExporting(true);
    try {
      const webpFile = await exportGraphToWebpFile({
        viewport,
        curves,
        showDerivativeOfF: curriculumMode === 'THPT' && showDerivativeOfF,
        markers,
      });
      await uploadHomeworkImage(tableId, webpFile);
      setExportStatus({ kind: 'ok', text: 'Đã chèn đồ thị thành Slide bài tập.' });
      onSwitchToBoard();
    } catch (err) {
      setExportStatus({ kind: 'err', text: formatApiError(err, 'Không thể xuất đồ thị thành Slide.', true) });
    } finally {
      setIsExporting(false);
    }
  }, [canControl, curriculumMode, curves, isExporting, markers, onSwitchToBoard, showDerivativeOfF, slideCount, tableId, viewport]);

  return {
    slots,
    curves,
    markers,
    viewport,
    crosshair,
    setCrosshair,
    showDerivativeOfF,
    setShowDerivativeOfF,
    setFunctionExpression,
    zoomViewport,
    panViewport,
    resetViewport,
    isExporting,
    isDeckFull: slideCount >= MAX_SLIDES,
    exportStatus,
    exportToHomeworkSlide,
  };
}
