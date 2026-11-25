import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { setActiveRoomStompSession } from '../services/roomStompClient';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

const mockGetContext = () =>
  ({
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

describe('HomeworkAnnotationCanvas & Board Toolbar (P5-T2)', () => {
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
        homeworkSlides: [
          {
            imageId: 'img-1',
            fileName: 'img-1.webp',
            url: '/api/v1/ephemeral-files/img-1.webp',
            uploadedByUserId: 'host-1',
            uploadedAtEpoch: 1000,
            strokes: [],
          },
          {
            imageId: 'img-2',
            fileName: 'img-2.webp',
            url: '/api/v1/ephemeral-files/img-2.webp',
            uploadedByUserId: 'host-1',
            uploadedAtEpoch: 2000,
            strokes: [],
          },
        ],
        activeSlideId: 'img-1',
      },
      'host-1',
    );
  });

  it('starts with no tool selected, toggles active tool off on second click, and preserves pre-selected color/size', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    const penBtn = screen.getByTestId('board-tool-PEN');
    const eraserBtn = screen.getByTestId('board-tool-ERASER');
    const laserBtn = screen.getByTestId('board-tool-LASER');
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

    // Default state: no tool selected, default cursor, touch scrolling allowed, pointer drag does nothing
    expect(penBtn).toHaveAttribute('aria-pressed', 'false');
    expect(eraserBtn).toHaveAttribute('aria-pressed', 'false');
    expect(laserBtn).toHaveAttribute('aria-pressed', 'false');
    expect(canvas.className).toContain('cursor-default');
    expect(canvas.className).not.toContain('touch-none');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 80 });
    expect(sendBoardDraw).not.toHaveBeenCalled();

    // Pre-selecting color and line width does not auto-enable PEN
    fireEvent.click(screen.getByTestId('board-color-#38bdf8'));
    fireEvent.change(screen.getByTestId('board-size-select'), { target: { value: '12' } });
    expect(penBtn).toHaveAttribute('aria-pressed', 'false');

    // Click PEN -> activates tool, locks touch scrolling for drawing, and uses pre-selected color/size
    fireEvent.click(penBtn);
    expect(penBtn).toHaveAttribute('aria-pressed', 'true');
    expect(canvas.className).toContain('cursor-crosshair');
    expect(canvas.className).toContain('touch-none');

    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 120, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 120, clientY: 80 });
    expect(sendBoardDraw).toHaveBeenCalledTimes(1);
    expect(sendBoardDraw).toHaveBeenLastCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({ tool: 'PEN', color: '#38bdf8', lineWidth: 12 }),
      }),
    );

    // Switching slides preserves actively chosen tool
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'HOMEWORK_SLIDE_SELECTED',
          tableId: 'table-1',
          actorUserId: 'host-1',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'host-1',
          coHostUserIds: [],
          isFreeCollab: false,
          activeSlideId: 'img-2',
          timestampEpoch: 4000,
        },
        'host-1',
      );
    });
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'true');

    // Clicking active tool again toggles it off -> back to view mode
    sendBoardDraw.mockClear();
    fireEvent.click(screen.getByTestId('board-tool-PEN'));
    expect(screen.getByTestId('board-tool-PEN')).toHaveAttribute('aria-pressed', 'false');
    expect(canvas.className).toContain('cursor-default');
    expect(canvas.className).not.toContain('touch-none');

    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 120, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 120, clientY: 80 });
    expect(sendBoardDraw).not.toHaveBeenCalled();

    // Also verifies toggling off another tool (LASER) stops emitting LASER_MOVE
    fireEvent.click(laserBtn);
    expect(laserBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(laserBtn);
    expect(laserBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerMove(canvas, { pointerId: 4, clientX: 100, clientY: 100 });
    expect(sendBoardDraw).not.toHaveBeenCalled();
  });

  it('draws PEN stroke with [0.0, 1.0] normalized coordinates, erases by strokeId, and clears slide', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    fireEvent.click(screen.getByTestId('board-tool-PEN'));
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 400,
      height: 200,
      right: 500,
      bottom: 300,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 200 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 300, clientY: 200 });

    expect(sendBoardDraw).toHaveBeenCalledTimes(1);
    const addPayload = sendBoardDraw.mock.calls[0][1];
    expect(addPayload.action).toBe('ADD_STROKE');
    expect(addPayload.slideId).toBe('img-1');
    expect(addPayload.stroke.tool).toBe('PEN');
    expect(addPayload.stroke.points).toEqual([
      { x: 0.25, y: 0.25 },
      { x: 0.5, y: 0.5 },
    ]);

    // Simulate server broadcast back into store
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'BOARD_DRAW',
          tableId: 'table-1',
          actorUserId: 'host-1',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'host-1',
          coHostUserIds: [],
          isFreeCollab: false,
          slideId: 'img-1',
          drawAction: 'ADD_STROKE',
          stroke: addPayload.stroke,
          timestampEpoch: 3000,
        },
        'host-1',
      );
    });
    expect(useTableStore.getState().homeworkSlides[0].strokes).toHaveLength(1);

    // Switch to ERASER and click near the stroke -> emits ERASE_STROKE with exact strokeId
    fireEvent.click(screen.getByTestId('board-tool-ERASER'));
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 250, clientY: 175 });

    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'ERASE_STROKE',
      strokeId: addPayload.stroke.id,
    });

    // Click CLEAR_SLIDE -> requires 2nd confirmation click before emitting CLEAR_SLIDE
    fireEvent.click(screen.getByTestId('board-clear-slide-btn'));
    expect(sendBoardDraw).not.toHaveBeenCalledWith('table-1', { slideId: 'img-1', action: 'CLEAR_SLIDE' });
    fireEvent.click(screen.getByTestId('board-clear-confirm-btn'));
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'CLEAR_SLIDE',
    });
  });

  it('isolates WASD, ArrowUp, and Escape when typing TEXT annotation and commits on Enter', () => {
    const leaveSpy = vi.fn();
    useGameStore.setState({ requestLeaveSeat: leaveSpy });

    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    fireEvent.click(screen.getByTestId('board-tool-TEXT'));
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 500,
      right: 500,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 250, clientY: 250 });
    const textInput = screen.getByTestId('homework-text-input') as HTMLInputElement;

    fireEvent.keyDown(textInput, { key: 'w' });
    fireEvent.keyDown(textInput, { key: 'ArrowUp' });
    expect(leaveSpy).not.toHaveBeenCalled();

    fireEvent.change(textInput, { target: { value: 'a^2 + b^2 = c^2' } });
    fireEvent.keyDown(textInput, { key: 'Enter' });

    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        slideId: 'img-1',
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'TEXT',
          text: 'a^2 + b^2 = c^2',
          points: [{ x: 0.5, y: 0.5 }],
        }),
      }),
    );

    // Escape while typing cancels text placement without leaving seat
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 100, clientY: 100 });
    const textInput2 = screen.getByTestId('homework-text-input');
    fireEvent.keyDown(textInput2, { key: 'Escape' });
    expect(screen.queryByTestId('homework-text-input')).toBeNull();
    expect(leaveSpy).not.toHaveBeenCalled();
  });

  it('hides drawing toolbar and blocks pointer drawing for read-only Table Member', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={false} />);

    expect(screen.queryByTestId('homework-board-toolbar')).toBeNull();
    const canvas = screen.getByTestId('homework-annotation-canvas');
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 150, clientY: 150 });
    expect(sendBoardDraw).not.toHaveBeenCalled();
  });
});
