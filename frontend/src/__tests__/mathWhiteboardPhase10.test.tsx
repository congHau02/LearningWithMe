import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { setActiveRoomStompSession } from '../services/roomStompClient';
import * as tableApi from '../services/tableApi';
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
  }) as unknown as CanvasRenderingContext2D;

const mockCanvasRect = (canvas: HTMLCanvasElement) =>
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

describe('P10-T3: Math Whiteboard Upgrade (Templates, Geometry, LaTeX & Per-Author Undo/Redo)', () => {
  const sendBoardDraw = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof globalThis.PointerEvent === 'undefined') {
      (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    sendBoardDraw.mockReset();
    HTMLCanvasElement.prototype.getContext = vi.fn(mockGetContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback, mime?: string) => {
      cb(new Blob(['RIFF\x10\x00\x00\x00WEBP'], { type: mime ?? 'image/webp' }));
    });
    setActiveRoomStompSession({
      sendBoardDraw,
      sendHomeworkSlideAction: vi.fn(),
    } as unknown as Parameters<typeof setActiveRoomStompSession>[0]);

    useAuthStore.setState({ userId: 'host-1', nickname: 'MathHost' });
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
            fileName: 'math-oxy.webp',
            url: '/api/v1/ephemeral-files/math-oxy.webp',
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

  it('creates instant 1280x720 webp math templates in 1 click via ephemeral upload pipeline', async () => {
    const uploadSpy = vi.spyOn(tableApi, 'uploadHomeworkImage').mockResolvedValue({
      imageId: 'img-tpl',
      fileName: 'math-oxy.webp',
      url: '/api/v1/ephemeral-files/math-oxy.webp',
      uploadedByUserId: 'host-1',
      uploadedAtEpoch: 2000,
      strokes: [],
    });

    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    fireEvent.click(screen.getByTestId('math-template-OXY_AXES'));

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1));
    const [calledTableId, uploadedFile] = uploadSpy.mock.calls[0];
    expect(calledTableId).toBe('table-1');
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.type).toBe('image/webp');
    expect(uploadedFile.name).toBe('math-oxy.webp');
  });

  it('draws LINE, ARROW, RECT, and CIRCLE strokes with 2 normalized [0.0, 1.0] points', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    mockCanvasRect(canvas);

    for (const shape of ['LINE', 'ARROW', 'RECT', 'CIRCLE'] as const) {
      sendBoardDraw.mockClear();
      fireEvent.click(screen.getByTestId(`board-tool-${shape}`));
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 140, clientY: 120 });
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 340, clientY: 220 });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 340, clientY: 220 });

      expect(sendBoardDraw).toHaveBeenCalledTimes(1);
      const payload = sendBoardDraw.mock.calls[0][1];
      expect(payload.action).toBe('ADD_STROKE');
      expect(payload.stroke.tool).toBe(shape);
      expect(payload.stroke.authorUserId).toBe('host-1');
      expect(payload.stroke.points).toEqual([
        { x: 0.1, y: 0.1 },
        { x: 0.6, y: 0.6 },
      ]);
    }
  });

  it('places LATEX stroke using 1-click symbol toolbar + live KaTeX preview and renders overlay', () => {
    const leaveSpy = vi.fn();
    useGameStore.setState({ requestLeaveSeat: leaveSpy });

    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    mockCanvasRect(canvas);

    fireEvent.click(screen.getByTestId('board-tool-LATEX'));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 300, clientY: 200 });

    const input = screen.getByTestId('homework-latex-input') as HTMLInputElement;
    fireEvent.click(screen.getByTestId('latex-symbol-frac'));
    expect(input.value).toContain('\\frac{a}{b}');

    const preview = screen.getByTestId('homework-latex-preview');
    expect(preview.innerHTML).toContain('katex');

    // Escape key while editing isolates from seat-leave
    fireEvent.keyDown(input, { key: 'w' });
    expect(leaveSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('homework-latex-confirm'));
    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        slideId: 'img-1',
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'LATEX',
          text: '\\frac{a}{b}',
          points: [{ x: 0.5, y: 0.5 }],
        }),
      }),
    );

    // Broadcast back into store -> renders in KaTeX overlay
    const sentStroke = sendBoardDraw.mock.calls[0][1].stroke;
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
          coHostUserIds: ['cohost-2'],
          isFreeCollab: false,
          slideId: 'img-1',
          drawAction: 'ADD_STROKE',
          stroke: sentStroke,
          timestampEpoch: 3000,
        },
        'host-1',
      );
    });
    expect(screen.getByTestId(`latex-stroke-${sentStroke.id}`).innerHTML).toContain('katex');
  });

  it('performs Per-Author Undo (Ctrl+Z) and Redo (Ctrl+Y) without reverting tablemate strokes', () => {
    act(() => {
      useTableStore.setState({
        homeworkSlides: [
          {
            imageId: 'img-1',
            fileName: 'math-oxy.webp',
            url: '/api/v1/ephemeral-files/math-oxy.webp',
            uploadedByUserId: 'host-1',
            uploadedAtEpoch: 1000,
            strokes: [
              {
                id: 's-host-1',
                tool: 'LINE',
                color: '#ef4444',
                lineWidth: 3,
                points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
                authorUserId: 'host-1',
              },
              {
                id: 's-cohost-1',
                tool: 'CIRCLE',
                color: '#22c55e',
                lineWidth: 3,
                points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.7 }],
                authorUserId: 'cohost-2',
              },
            ],
          },
        ],
      });
    });

    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    // Ctrl+Z skips cohost-2's newer stroke and undoes host-1's own stroke
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    // Rapid second Ctrl+Z before server echo must not emit duplicate UNDO_STROKE
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(sendBoardDraw).toHaveBeenCalledTimes(1);
    expect(sendBoardDraw).toHaveBeenCalledWith('table-1', {
      slideId: 'img-1',
      action: 'UNDO_STROKE',
      strokeId: 's-host-1',
    });

    // Apply server broadcast for UNDO_STROKE
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
          coHostUserIds: ['cohost-2'],
          isFreeCollab: false,
          slideId: 'img-1',
          drawAction: 'UNDO_STROKE',
          erasedStrokeId: 's-host-1',
          timestampEpoch: 4000,
        },
        'host-1',
      );
    });
    expect(useTableStore.getState().homeworkSlides[0].strokes?.map((s) => s.id)).toEqual(['s-cohost-1']);

    // Ctrl+Y restores host-1's stroke via ADD_STROKE
    sendBoardDraw.mockClear();
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        slideId: 'img-1',
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({ id: 's-host-1', authorUserId: 'host-1' }),
      }),
    );
  });

  it('enforces Botanical Night Studio active tool contrast (#E5A93C / #0F1714) and zero legacy slate/sky classes', () => {
    const { container } = render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);
    const penBtn = screen.getByTestId('board-tool-PEN');
    expect(penBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(penBtn);
    expect(penBtn.className).toContain('bg-primary');
    expect(penBtn.className).toContain('text-primary-foreground');
    expect(penBtn.className).not.toContain('bg-primary/25');

    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    for (const el of container.querySelectorAll('*')) {
      if (typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    }
  });
});
