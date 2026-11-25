import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { setActiveRoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

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
    setLineDash: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

const mockCanvasRect = (canvas: HTMLCanvasElement) =>
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 400,
    right: 400,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

describe('P12-T3 UI: Euclidean Geometry Toolbar, Snapping, Vertex Labels & Undo/Redo', () => {
  const sendBoardDraw = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof globalThis.PointerEvent === 'undefined') {
      (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    sendBoardDraw.mockReset();
    HTMLCanvasElement.prototype.getContext = vi.fn(mockGetContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    setActiveRoomStompSession({
      sendBoardDraw,
      sendHomeworkSlideAction: vi.fn(),
    } as unknown as Parameters<typeof setActiveRoomStompSession>[0]);

    useAuthStore.setState({ userId: 'host-1', nickname: 'MathTeacher' });
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table-1',
        hostUserId: 'host-1',
        coHostUserIds: ['cohost-2'],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [],
        homeworkSlides: [
          {
            imageId: 'img-1',
            fileName: 'hinh-hoc.webp',
            url: '/api/v1/ephemeral-files/hinh-hoc.webp',
            uploadedByUserId: 'host-1',
            uploadedAtEpoch: 1000,
            strokes: [],
          },
        ],
        activeSlideId: 'img-1',
      },
      'host-1',
    );
  });

  it('draws CIRCLE_CENTER, DASHED_LINE, and TRIANGLE strokes with Shift/touch snap constraint', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    mockCanvasRect(canvas);

    // 1. Center-Radius Circle
    fireEvent.click(screen.getByTestId('board-tool-CIRCLE_CENTER'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 280, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 280, clientY: 200 });
    expect(sendBoardDraw).toHaveBeenLastCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'CIRCLE_CENTER',
          points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }],
        }),
      }),
    );

    // 2. Dashed Line with touch Snap Toggle ON constrains near-horizontal drag to exact 0 degrees
    fireEvent.click(screen.getByTestId('board-snap-toggle'));
    expect(screen.getByTestId('board-snap-toggle')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('board-tool-DASHED_LINE'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 80, clientY: 160 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 240, clientY: 168 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 240, clientY: 168 });
    const dashedStroke = sendBoardDraw.mock.calls.at(-1)?.[1]?.stroke;
    expect(dashedStroke.tool).toBe('DASHED_LINE');
    expect(dashedStroke.points[0]).toEqual({ x: 0.2, y: 0.4 });
    expect(dashedStroke.points[1].y).toBeCloseTo(0.4, 4);

    // 3. Triangle with snap produces proportional 3-vertex triangle
    fireEvent.click(screen.getByTestId('board-tool-TRIANGLE'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 80, clientY: 80 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 240, clientY: 180 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 240, clientY: 180 });
    const triStroke = sendBoardDraw.mock.calls.at(-1)?.[1]?.stroke;
    expect(triStroke.tool).toBe('TRIANGLE');
    expect(triStroke.points).toHaveLength(3);
  });

  it('places 1-tap GEO_MARK strokes and auto-incrementing VERTEX_LABEL skipping existing labels', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    mockCanvasRect(canvas);

    // Select GEO_MARK -> ANGLE_ARC_2 and tap once
    fireEvent.click(screen.getByTestId('board-tool-GEO_MARK'));
    fireEvent.click(screen.getByTestId('geo-mark-ANGLE_ARC_2'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
    expect(sendBoardDraw).toHaveBeenLastCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'GEO_MARK',
          text: 'ANGLE_ARC_2',
        }),
      }),
    );

    // Pre-populate slide with A and C -> next auto vertex should be B
    act(() => {
      useTableStore.setState((s) => ({
        homeworkSlides: s.homeworkSlides.map((sl) => ({
          ...sl,
          strokes: [
            { id: 'v-a', tool: 'TEXT', color: '#E6ECE8', lineWidth: 16, text: 'A', points: [{ x: 0.1, y: 0.1 }], authorUserId: 'host-1' },
            { id: 'v-c', tool: 'TEXT', color: '#E6ECE8', lineWidth: 16, text: 'C', points: [{ x: 0.3, y: 0.3 }], authorUserId: 'cohost-2' },
          ],
        })),
      }));
    });

    fireEvent.click(screen.getByTestId('board-tool-VERTEX_LABEL'));
    expect(screen.getByTestId('vertex-letter-auto')).toHaveTextContent('B');
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 200 });
    expect(sendBoardDraw).toHaveBeenLastCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'TEXT',
          text: 'B',
          points: [{ x: 0.5, y: 0.5 }],
        }),
      }),
    );

    // Manual override to H, then resets to auto
    fireEvent.click(screen.getByTestId('vertex-letter-H'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 280, clientY: 280 });
    expect(sendBoardDraw).toHaveBeenLastCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'TEXT',
          text: 'H',
        }),
      }),
    );
  });

  it('supports Eraser and per-author Ctrl+Z/Ctrl+Y on Euclidean strokes and uses Botanical Night tokens', () => {
    act(() => {
      useTableStore.setState((s) => ({
        homeworkSlides: s.homeworkSlides.map((sl) => ({
          ...sl,
          strokes: [
            {
              id: 'host-tri',
              tool: 'TRIANGLE',
              color: '#22c55e',
              lineWidth: 3,
              points: [{ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.7, y: 0.7 }],
              authorUserId: 'host-1',
            },
            {
              id: 'peer-dashed',
              tool: 'DASHED_LINE',
              color: '#38bdf8',
              lineWidth: 3,
              points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }],
              authorUserId: 'cohost-2',
            },
          ],
        })),
      }));
    });

    const { container } = render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    mockCanvasRect(canvas);

    // Per-author Ctrl+Z skips peer-dashed and undoes host-tri
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'UNDO_STROKE',
      strokeId: 'host-tri',
    });

    // Eraser hits peer-dashed on its line segment
    sendBoardDraw.mockClear();
    fireEvent.click(screen.getByTestId('board-tool-ERASER'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 120, clientY: 40 });
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'ERASE_STROKE',
      strokeId: 'peer-dashed',
    });

    // Shift-key endpoint snapping on LINE connects near existing triangle vertex (0.2, 0.2) -> (0.7, 0.7)
    sendBoardDraw.mockClear();
    fireEvent.click(screen.getByTestId('board-tool-LINE'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 83, clientY: 82, shiftKey: true });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 282, clientY: 278, shiftKey: true });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 282, clientY: 278, shiftKey: true });
    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'LINE',
          points: [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.7 }],
        }),
      }),
    );

    // Botanical Night Studio zero legacy classes check
    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    for (const el of container.querySelectorAll('*')) {
      if (typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    }
  });
});
