import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Homework Laser Pointer (P5-T3)', () => {
  const sendBoardDraw = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00.000Z'));
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throttles LASER_MOVE to 10Hz (100ms) with [0.0, 1.0] normalized coordinates', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={true} />);

    fireEvent.click(screen.getByTestId('board-tool-LASER'));
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

    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 150 });
    expect(sendBoardDraw).toHaveBeenCalledTimes(1);
    expect(sendBoardDraw).toHaveBeenLastCalledWith('table-1', {
      slideId: 'img-1',
      action: 'LASER_MOVE',
      point: { x: 0.25, y: 0.25 },
    });

    // Within 100ms window -> throttled immediately, schedules trailing-edge flush
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 200 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(canvas, { clientX: 350, clientY: 220 });
    expect(sendBoardDraw).toHaveBeenCalledTimes(1);

    // At +100ms -> trailing-edge flush sends the final resting coordinate
    vi.advanceTimersByTime(25);
    expect(sendBoardDraw).toHaveBeenCalledTimes(2);
    expect(sendBoardDraw).toHaveBeenLastCalledWith('table-1', {
      slideId: 'img-1',
      action: 'LASER_MOVE',
      point: { x: 0.625, y: 0.6 },
    });

    // Next move after >= 100ms -> sends immediately
    vi.advanceTimersByTime(105);
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 250 });
    expect(sendBoardDraw).toHaveBeenCalledTimes(3);
    expect(sendBoardDraw).toHaveBeenLastCalledWith('table-1', {
      slideId: 'img-1',
      action: 'LASER_MOVE',
      point: { x: 0.75, y: 0.75 },
    });
  });

  it('renders normalized laser pointer with nickname, auto-hides after idle TTL, and clears on slide switch', () => {
    render(<HomeworkDeckPanel tableId="table-1" canControl={false} />);

    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'LASER_MOVE',
          tableId: 'table-1',
          actorUserId: 'host-1',
          targetUserId: null,
          requesterNickname: 'Gia sư',
          action: null,
          hostUserId: 'host-1',
          coHostUserIds: [],
          isFreeCollab: false,
          slideId: 'img-1',
          drawAction: 'LASER_MOVE',
          laserPointer: {
            userId: 'host-1',
            nickname: 'Gia sư',
            slideId: 'img-1',
            x: 0.4,
            y: 0.6,
          },
          timestampEpoch: Date.now(),
        },
        'member-1',
      );
    });

    const pointer = screen.getByTestId('laser-pointer-host-1');
    expect(pointer).toHaveTextContent('Gia sư');
    expect(pointer).toHaveStyle({ left: '40%', top: '60%' });

    // Auto-hide after idle timeout (1500ms)
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.queryByTestId('laser-pointer-host-1')).not.toBeInTheDocument();

    // Re-show and verify immediate clear on slide switch
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'LASER_MOVE',
          tableId: 'table-1',
          actorUserId: 'host-1',
          targetUserId: null,
          requesterNickname: 'Gia sư',
          action: null,
          hostUserId: 'host-1',
          coHostUserIds: [],
          isFreeCollab: false,
          slideId: 'img-1',
          drawAction: 'LASER_MOVE',
          laserPointer: {
            userId: 'host-1',
            nickname: 'Gia sư',
            slideId: 'img-1',
            x: 0.2,
            y: 0.3,
          },
          timestampEpoch: Date.now(),
        },
        'member-1',
      );
    });
    expect(screen.getByTestId('laser-pointer-host-1')).toBeInTheDocument();

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
          timestampEpoch: Date.now(),
        },
        'member-1',
      );
    });
    expect(screen.queryByTestId('laser-pointer-host-1')).not.toBeInTheDocument();
  });
});
