import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { sendBoardDraw } from '../services/tableStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;

describe('P8-T4 Frontend Homework Slide Auth, Stroke Point Cap & Rate Limit UX', () => {
  const sendBoardDrawSpy = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof globalThis.PointerEvent === 'undefined') {
      (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    sendBoardDrawSpy.mockReset();
    setActiveRoomStompSession({
      sendBoardDraw: sendBoardDrawSpy,
      sendHomeworkSlideAction: vi.fn(),
    } as unknown as RoomStompSession);

    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host-p8t4',
      nickname: 'HostUser',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });
    useGameStore.setState({
      characterState: 'SEATED',
      roomId: 'main-library',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
      connectionStatus: 'CONNECTED',
    });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-host',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'u-host',
            nickname: 'HostUser',
            avatarId: 'avatar_01',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now() - 10_000,
            connected: true,
          },
        ],
        homeworkSlides: [
          {
            imageId: 'img-1',
            fileName: 'img-1.webp',
            url: '/api/v1/ephemeral-files/img-1.webp',
            uploadedByUserId: 'u-host',
            uploadedAtEpoch: 1000,
            strokes: [],
          },
        ],
        activeSlideId: 'img-1',
      },
      'u-host',
    );
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  it('surfaces structured error when authenticated slide fetch returns 403 ProblemDetail', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:unused');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          type: 'https://studytogether.com/problems/not-seated-at-table',
          title: 'Not Seated At Table',
          status: 403,
          detail: "Learner is not seated at table 'table_01'",
        }),
      }),
    );

    render(<HomeworkDeckPanel tableId="table_01" canControl={true} />);

    await waitFor(() => expect(screen.getByTestId('homework-image-error')).toBeInTheDocument());
    expect(screen.getByTestId('homework-image-error')).toHaveTextContent("Learner is not seated at table 'table_01'");
    expect(screen.queryByTestId('homework-active-image')).toBeNull();
  });

  it('rejects strokes with more than 500 points on canvas commit and direct sendBoardDraw with structured error', () => {
    render(<HomeworkDeckPanel tableId="table_01" canControl={true} />);

    fireEvent.click(screen.getByTestId('board-tool-PEN'));
    const canvas = screen.getByTestId('homework-annotation-canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 1000,
      right: 1000,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 1, clientY: 1 });
    for (let i = 1; i <= 500; i += 1) {
      fireEvent.pointerMove(canvas, {
        pointerId: 1,
        clientX: (i * 4) % 990 + 5,
        clientY: (Math.floor(i / 20) * 10) + 5,
      });
    }
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 500, clientY: 500 });

    expect(sendBoardDrawSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('homework-upload-error')).toHaveTextContent('500');

    const overLimitPoints = Array.from({ length: 501 }, (_, idx) => ({
      x: Number(((idx % 100) / 100).toFixed(3)),
      y: 0.5,
    }));
    const sent = sendBoardDraw('table_01', {
      slideId: 'img-1',
      action: 'ADD_STROKE',
      stroke: {
        id: 'stroke-oversized',
        tool: 'PEN',
        color: '#ef4444',
        lineWidth: 3,
        points: overLimitPoints,
      },
    });
    expect(sent).toBe(false);
    expect(sendBoardDrawSpy).not.toHaveBeenCalled();
    expect(useTableStore.getState().permissionToast).toContain('500');
  });

  it('displays Table rate-limit toast without crashing the seated session', () => {
    render(<TableWorkspaceShell />);

    act(() => {
      useTableStore.getState().setPermissionToast("Too many 'video.sync' requests. Please wait a moment.");
    });

    expect(screen.getByTestId('table-permission-toast')).toHaveTextContent('video.sync');
    expect(screen.getByTestId('table-workspace-shell')).toBeInTheDocument();
  });
});
