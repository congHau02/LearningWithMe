import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { setActiveRoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';

const mockGetContext = () =>
  ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

function seedTableWithSlides(withSlide: boolean) {
  useAuthStore.setState({ userId: 'host-1', nickname: 'HostUser' });
  useGameStore.getState().resetGame();
  useTableStore.getState().leaveTable();
  useTableStore.getState().applyWorkspaceSnapshot(
    {
      roomId: 'main-library',
      tableId: 'table-1',
      hostUserId: 'host-1',
      coHostUserIds: [],
      isFreeCollab: false,
      sosBanner: null,
      videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
      members: [],
      homeworkSlides: withSlide
        ? [
            {
              imageId: 'img-1',
              fileName: 'bai-tap-1.webp',
              url: '/api/v1/ephemeral-files/bai-tap-1.webp',
              uploadedByUserId: 'host-1',
              uploadedAtEpoch: 1000,
              strokes: [],
            },
          ]
        : [],
      activeSlideId: withSlide ? 'img-1' : null,
    },
    'host-1',
  );
}

describe('P10-T10: Clear View homework board', () => {
  const sendBoardDraw = vi.fn();
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    sendBoardDraw.mockReset();
    HTMLCanvasElement.prototype.getContext = vi.fn(mockGetContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    setActiveRoomStompSession({
      sendBoardDraw,
      sendHomeworkSlideAction: vi.fn(),
    } as unknown as Parameters<typeof setActiveRoomStompSession>[0]);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
    vi.restoreAllMocks();
  });

  it('hides math template picker in Clear View while keeping camera, upload, slide tabs, and empty state', () => {
    seedTableWithSlides(false);
    const { rerender } = render(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={true} />);

    expect(screen.queryByTestId('math-template-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('homework-camera-btn')).toBeInTheDocument();
    expect(screen.getByTestId('homework-upload-btn')).toBeInTheDocument();
    expect(screen.getByTestId('homework-empty-state')).toBeInTheDocument();

    // Full view keeps math template picker
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={false} />);
    expect(screen.getByTestId('math-template-picker')).toBeInTheDocument();

    // With slide in Clear View: slide tabs stay visible, template picker stays hidden
    act(() => {
      seedTableWithSlides(true);
    });
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={true} />);
    expect(screen.queryByTestId('math-template-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('homework-slide-tab-img-1')).toBeInTheDocument();
  });

  it('shows icon-only PEN, LINE, DASHED_LINE, ERASER, LASER, Undo, 3 swatches, and 2-step Clear slide in Clear View while keeping full toolbar in full view', () => {
    seedTableWithSlides(true);
    const { rerender } = render(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={true} />);

    const penBtn = screen.getByTestId('board-tool-PEN');
    const lineBtn = screen.getByTestId('board-tool-LINE');
    const dashedBtn = screen.getByTestId('board-tool-DASHED_LINE');
    const eraserBtn = screen.getByTestId('board-tool-ERASER');
    const laserBtn = screen.getByTestId('board-tool-LASER');
    const undoBtn = screen.getByTestId('board-undo-btn');
    const clearBtn = screen.getByTestId('board-clear-slide-btn');

    for (const [btn, expectedName] of [
      [penBtn, 'Bút'],
      [lineBtn, 'Đoạn thẳng'],
      [dashedBtn, 'Nét đứt'],
      [eraserBtn, 'Tẩy'],
      [laserBtn, 'Laser'],
      [undoBtn, 'Hoàn tác nét vẽ của bạn (Ctrl+Z)'],
      [clearBtn, 'Xóa trang'],
    ] as const) {
      expect(btn).toHaveAttribute('aria-label', expectedName);
      expect(btn).toHaveAttribute('title', expectedName);
      expect(btn.textContent?.trim()).toBe('');
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
      expect(btn.className).not.toContain('sm:min-h-[34px]');
      expect(btn.className).not.toContain('sm:min-w-[34px]');
    }

    // 3 high-contrast ink swatches exposed in Clear View
    expect(screen.getByTestId('board-color-#ef4444')).toBeInTheDocument();
    expect(screen.getByTestId('board-color-#38bdf8')).toBeInTheDocument();
    expect(screen.getByTestId('board-color-#22c55e')).toBeInTheDocument();
    expect(screen.queryByTestId('board-color-#facc15')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-color-#f8fafc')).not.toBeInTheDocument();

    // Hidden tools & controls in Clear View
    for (const hiddenTool of ['HIGHLIGHTER', 'ARROW', 'RECT', 'CIRCLE', 'CIRCLE_CENTER', 'TRIANGLE', 'GEO_MARK', 'VERTEX_LABEL', 'TEXT', 'LATEX']) {
      expect(screen.queryByTestId(`board-tool-${hiddenTool}`)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('board-redo-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-size-select')).not.toBeInTheDocument();

    // Clear slide requires explicit 2-step confirmation before emitting CLEAR_SLIDE
    fireEvent.click(clearBtn);
    expect(sendBoardDraw).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('board-clear-confirm-btn'));
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', { slideId: 'img-1', action: 'CLEAR_SLIDE' });

    // Full view restores all tools, undo/redo, colors, and size select
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={false} />);
    expect(screen.getByTestId('board-tool-RECT')).toBeInTheDocument();
    expect(screen.getByTestId('board-tool-LATEX')).toBeInTheDocument();
    expect(screen.getByTestId('board-undo-btn')).toBeInTheDocument();
    expect(screen.getByTestId('board-redo-btn')).toBeInTheDocument();
    expect(screen.getByTestId('board-size-select')).toBeInTheDocument();
    expect(screen.getByTestId('board-color-#facc15')).toBeInTheDocument();
    expect(screen.getByTestId('board-clear-slide-btn').textContent).toContain('Xóa trang');
  });

  it('clears hidden tools to null when Clear View turns on, keeps null/color/size, and preserves ERASER/LASER', () => {
    if (typeof globalThis.PointerEvent === 'undefined') {
      (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    seedTableWithSlides(true);
    const { rerender } = render(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={false} />);

    // Turning on Clear View while no tool is active keeps no tool selected
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={true} />);
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('board-tool-ERASER')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('board-tool-LASER')).toHaveAttribute('aria-pressed', 'false');

    // Customize color & size and pick a tool hidden in Clear View (RECT)
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={false} />);
    fireEvent.click(screen.getByTestId('board-color-#38bdf8'));
    fireEvent.change(screen.getByTestId('board-size-select'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('board-tool-RECT'));
    expect(screen.getByTestId('board-tool-RECT')).toHaveAttribute('aria-pressed', 'true');

    // Switch Clear View ON -> hidden tool clears to null instead of forcing PEN
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={true} />);
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'false');

    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 120, clientY: 80, pointerId: 1 });
    expect(sendBoardDraw).not.toHaveBeenCalled();

    // Selecting PEN in Clear View uses the preserved color (#38bdf8) and size (12)
    fireEvent.click(screen.getByTestId('board-tool-PEN'));
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 120, clientY: 80, pointerId: 1 });

    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        slideId: 'img-1',
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'PEN',
          color: '#38bdf8',
          lineWidth: 12,
        }),
      }),
    );

    // Clicking PEN again in Clear View toggles it off
    fireEvent.click(screen.getByTestId('board-tool-PEN'));
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'false');

    // If LASER is selected in full view and Clear View turns on, it stays LASER
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={false} />);
    fireEvent.click(screen.getByTestId('board-tool-LASER'));
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={true} clearView={true} />);
    expect(screen.getByTestId('board-tool-LASER')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps canControl permissions unchanged in Clear View (hides camera, upload, and toolbar for viewers)', () => {
    seedTableWithSlides(true);
    render(<HomeworkDeckPanel tableId="table-1" canControl={false} clearView={true} />);

    expect(screen.queryByTestId('homework-camera-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('homework-upload-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('math-template-picker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('homework-board-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-clear-slide-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('homework-slide-tab-img-1')).toBeInTheDocument();
    expect(screen.getByTestId('homework-annotation-canvas')).toBeInTheDocument();
  });

  it('preserves color/size, clears hidden tools to null, and keeps LASER when toggling Clear View in TableWorkspaceShell', () => {
    if (typeof globalThis.PointerEvent === 'undefined') {
      (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    useVoiceStore.getState().resetVoice();
    seedTableWithSlides(true);
    useGameStore.setState({
      roomId: 'main-library',
      connectionStatus: 'CONNECTED',
      characterState: 'SEATED',
      currentTableId: 'table-1',
      currentSeatId: 'T1_S1',
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });

    render(<TableWorkspaceShell />);

    // Desktop starts in Full View
    expect(screen.getByTestId('clear-view-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('math-template-picker')).toBeInTheDocument();

    // Pick custom color, size, and a hidden tool (RECT) in Full View
    fireEvent.click(screen.getByTestId('board-color-#22c55e'));
    fireEvent.change(screen.getByTestId('board-size-select'), { target: { value: '18' } });
    fireEvent.click(screen.getByTestId('board-tool-RECT'));

    // Toggle Clear View ON -> remounts HomeworkDeckPanel in Clear View pane with hidden tool cleared
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(screen.getByTestId('clear-view-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('math-template-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-label', 'Bút');
    expect(screen.getByTestId('board-clear-slide-btn')).toHaveAttribute('aria-label', 'Xóa trang');
    expect(screen.queryByTestId('board-tool-RECT')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-size-select')).not.toBeInTheDocument();

    // Selecting PEN and drawing in Clear View preserves the color (#22c55e) and size (18) chosen before toggling
    fireEvent.click(screen.getByTestId('board-tool-PEN'));
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'true');
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 60, pointerId: 1 });

    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        slideId: 'img-1',
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'PEN',
          color: '#22c55e',
          lineWidth: 18,
        }),
      }),
    );

    // Toggle Clear View OFF, pick LASER, toggle ON again -> LASER is preserved
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    fireEvent.click(screen.getByTestId('board-tool-LASER'));
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(screen.getByTestId('board-tool-LASER')).toHaveAttribute('aria-pressed', 'true');
  });
});
