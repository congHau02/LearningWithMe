import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    drawImage: vi.fn(),
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
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

function seedSeatedTable(canControl: boolean, withSlide = true) {
  const userId = canControl ? 'u-host' : 'u-member';
  useAuthStore.setState({ userId, token: 'jwt-test', nickname: canControl ? 'HostUser' : 'MemberUser' });
  useGameStore.getState().resetGame();
  useVoiceStore.getState().resetVoice();
  useTableStore.getState().leaveTable();
  useGameStore.setState({
    roomId: 'main-library',
    connectionStatus: 'CONNECTED',
    characterState: 'SEATED',
    currentTableId: 'table-1',
    currentSeatId: 'T1_S1',
  });
  useTableStore.getState().applyWorkspaceSnapshot(
    {
      roomId: 'main-library',
      tableId: 'table-1',
      hostUserId: 'u-host',
      coHostUserIds: [],
      isFreeCollab: false,
      sosBanner: null,
      videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
      members: [],
      homeworkSlides: withSlide
        ? [
            {
              imageId: 'img-1',
              fileName: 'bai-tap.webp',
              url: '/api/v1/ephemeral-files/bai-tap.webp',
              uploadedByUserId: 'u-host',
              uploadedAtEpoch: 1000,
              strokes: [
                {
                  id: 's-host-1',
                  tool: 'PEN',
                  color: '#ef4444',
                  lineWidth: 3,
                  points: [
                    { x: 0.1, y: 0.1 },
                    { x: 0.3, y: 0.3 },
                  ],
                  authorUserId: 'u-host',
                },
              ],
            },
          ]
        : [],
      activeSlideId: withSlide ? 'img-1' : null,
    },
    userId,
  );
}

describe('P12-T4 UI: Rotate & Crop, Local Zoom/Pan & Hardened Clear View', () => {
  const sendBoardDraw = vi.fn();
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    if (typeof globalThis.PointerEvent === 'undefined') {
      (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    sendBoardDraw.mockReset();
    HTMLCanvasElement.prototype.getContext = vi.fn(mockGetContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    setActiveRoomStompSession({
      sendBoardDraw,
      sendHomeworkSlideAction: vi.fn(),
    } as unknown as Parameters<typeof setActiveRoomStompSession>[0]);
    URL.createObjectURL = vi.fn(() => 'blob:crop-preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens 90° Rotate & Crop modal on file select/paste, applies rotation & crop before .webp upload, and supports 1-tap full image', async () => {
    const rotateSpy = vi.fn();
    const scaleSpy = vi.fn();
    const translateSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    const fakeCanvas = origCreate('canvas');
    fakeCanvas.getContext = (() => ({
      ...mockGetContext(),
      rotate: rotateSpy,
      scale: scaleSpy,
      translate: translateSpy,
    })) as unknown as typeof fakeCanvas.getContext;
    fakeCanvas.toBlob = ((cb: BlobCallback) => {
      cb(new Blob(['RIFF1234WEBP'], { type: 'image/webp' }));
    }) as unknown as typeof fakeCanvas.toBlob;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag.toLowerCase() === 'canvas' ? fakeCanvas : origCreate(tag),
    );
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1000, height: 2000, close: vi.fn() }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        imageId: 'img-new',
        fileName: 'img-new.webp',
        url: '/api/v1/ephemeral-files/img-new.webp',
        uploadedByUserId: 'u-host',
        uploadedAtEpoch: 5000,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    seedSeatedTable(true, false);
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    const fileInput = screen.getByTestId('homework-file-input') as HTMLInputElement;
    const rawFile = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'bt.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [rawFile] } });

    expect(screen.getByTestId('homework-crop-rotate-modal')).toBeInTheDocument();
    expect(screen.getByTestId('crop-rotation-label')).toHaveTextContent('0°');

    fireEvent.click(screen.getByTestId('crop-rotate-right-btn'));
    expect(screen.getByTestId('crop-rotation-label')).toHaveTextContent('90°');

    const cropStage = screen.getByTestId('crop-preview-stage');
    vi.spyOn(cropStage, 'getBoundingClientRect').mockReturnValue({
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
    fireEvent.pointerDown(cropStage, { pointerId: 1, clientX: 40, clientY: 20 });
    fireEvent.pointerMove(cropStage, { pointerId: 1, clientX: 240, clientY: 120 });
    fireEvent.pointerUp(cropStage, { pointerId: 1, clientX: 240, clientY: 120 });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-confirm-btn'));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(rotateSpy).toHaveBeenCalledWith((90 * Math.PI) / 180);
    // 1000x2000 rotated 90° => 2000x1000; crop width=(240-40)/400=0.5 => 1000px, height=(120-20)/200=0.5 => 500px
    expect(fakeCanvas.width).toBe(1000);
    expect(fakeCanvas.height).toBe(500);
    expect(screen.queryByTestId('homework-crop-rotate-modal')).not.toBeInTheDocument();

    // Ctrl+V paste -> 1-tap "Dùng nguyên ảnh" fast path
    const pastedFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'paste.png', { type: 'image/png' });
    fireEvent.paste(screen.getByTestId('homework-deck-panel'), {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => pastedFile }] },
    });
    expect(screen.getByTestId('homework-crop-rotate-modal')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-use-full-btn'));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('zooms & pans locally for any SEATED learner and inverse-projects strokes & laser to exact [0.0, 1.0] coordinates', () => {
    seedSeatedTable(true, true);
    const { rerender } = render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    const stage = screen.getByTestId('homework-viewport-stage');
    const canvas = screen.getByTestId('homework-annotation-canvas');
    const rect = {
      left: 100,
      top: 50,
      width: 400,
      height: 200,
      right: 500,
      bottom: 250,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    };
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect);

    expect(screen.getByTestId('homework-zoom-level')).toHaveTextContent('1.0×');
    fireEvent.click(screen.getByTestId('homework-zoom-in-btn'));
    fireEvent.click(screen.getByTestId('homework-zoom-in-btn'));
    expect(screen.getByTestId('homework-zoom-level')).toHaveTextContent('2.0×');
    expect(sendBoardDraw).not.toHaveBeenCalled();

    // At 2.0x centered on 400x200 => panX = -200, panY = -100.
    // Pointer at (300, 150) (center of stage) -> exact (0.5, 0.5); (100, 50) -> (0.25, 0.25)
    fireEvent.click(screen.getByTestId('board-tool-LINE'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 150 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 300, clientY: 150 });

    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'LINE',
          points: [
            { x: 0.25, y: 0.25 },
            { x: 0.5, y: 0.5 },
          ],
        }),
      }),
    );

    // Laser pointer also inverse-projects while zoomed
    sendBoardDraw.mockClear();
    fireEvent.click(screen.getByTestId('board-tool-LASER'));
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 500, clientY: 250 });
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'LASER_MOVE',
      point: { x: 0.75, y: 0.75 },
    });

    // Reset button returns zoom to 1.0×
    fireEvent.click(screen.getByTestId('homework-zoom-reset-btn'));
    expect(screen.getByTestId('homework-zoom-level')).toHaveTextContent('1.0×');

    // Wheel zoom in & 2-finger pinch cancels accidental 1-finger draft stroke
    fireEvent.wheel(stage, { deltaY: -120, clientX: 300, clientY: 150 });
    expect(screen.getByTestId('homework-zoom-level')).toHaveTextContent('1.3×');

    sendBoardDraw.mockClear();
    fireEvent.pointerDown(canvas, { pointerId: 10, clientX: 200, clientY: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 11, clientX: 240, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 11, clientX: 280, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 10, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 11, clientX: 280, clientY: 100 });
    expect(sendBoardDraw).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('homework-zoom-reset-btn'));
    expect(screen.getByTestId('homework-zoom-level')).toHaveTextContent('1.0×');

    // Read-only Member also gets local Zoom & Pan controls
    seedSeatedTable(false, true);
    rerender(<HomeworkDeckPanel tableId="table-1" canControl={false} />);
    expect(screen.getByTestId('homework-zoom-in-btn')).toBeEnabled();
    fireEvent.click(screen.getByTestId('homework-zoom-in-btn'));
    expect(screen.getByTestId('homework-zoom-level')).toHaveTextContent('1.5×');
  });

  it('guards Clear Slide behind 2-step confirmation (canceling on Escape or timeout) and exposes collapsible math strip in Clear View chat', () => {
    vi.useFakeTimers();
    const leaveSpy = vi.fn();
    seedSeatedTable(true, true);
    useGameStore.setState({ requestLeaveSeat: leaveSpy });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });

    render(<TableWorkspaceShell />);

    // Clear View active at 375px: Undo, 3 swatches, LINE, DASHED_LINE & snap toggle visible; chat math strip collapsed until toggled
    expect(screen.getByTestId('board-undo-btn')).toBeEnabled();
    expect(screen.getByTestId('board-tool-LINE')).toBeInTheDocument();
    expect(screen.getByTestId('board-tool-DASHED_LINE')).toBeInTheDocument();
    expect(screen.getByTestId('board-snap-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('board-color-#ef4444')).toHaveAttribute('aria-label', 'Màu Đỏ');
    expect(screen.queryByTestId('table-chat-math-sym-bar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('table-chat-math-toggle-btn'));
    expect(screen.getByTestId('table-chat-math-sym-bar')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('table-chat-math-sym-triangle'));
    expect((screen.getByTestId('table-chat-input') as HTMLInputElement).value).toContain('\\triangle');

    // Step 1 of Clear Slide opens inline confirm, Escape cancels without leaving seat
    fireEvent.click(screen.getByTestId('board-clear-slide-btn'));
    expect(screen.getByTestId('board-clear-confirm-btn')).toBeInTheDocument();
    expect(sendBoardDraw).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('board-clear-confirm-btn')).not.toBeInTheDocument();
    expect(leaveSpy).not.toHaveBeenCalled();
    expect(sendBoardDraw).not.toHaveBeenCalled();

    // Auto-timeout cancels confirmation after 4s
    fireEvent.click(screen.getByTestId('board-clear-slide-btn'));
    expect(screen.getByTestId('board-clear-confirm-btn')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByTestId('board-clear-confirm-btn')).not.toBeInTheDocument();

    // Undo works directly in Clear View
    fireEvent.click(screen.getByTestId('board-undo-btn'));
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'UNDO_STROKE',
      strokeId: 's-host-1',
    });
  });
});
