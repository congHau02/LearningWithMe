import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P4-T4 Scoped Table Chat with Quick Reactions, Rate Limiting & Ephemeral Cleanup', () => {
  const sendTableChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-self',
      token: 'jwt-self',
      nickname: 'SelfLearner',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });

    setActiveRoomStompSession({
      sendTableChat,
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    cleanup();
  });

  it('hydrates recent table messages from snapshot and appends TABLE_CHAT events without touching Room Chat', () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'seat_01',
    });

    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-self',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [],
        recentMessages: [
          {
            id: 'm1',
            userId: 'u-peer',
            nickname: 'PeerA',
            avatarId: 'avatar_02',
            content: 'Chào bạn cùng bàn!',
            createdAtEpoch: 1_700_000_000_000,
          },
        ],
      },
      'u-self',
    );

    render(<TableWorkspaceShell />);

    expect(screen.getByTestId('table-chat-panel')).toBeInTheDocument();
    expect(screen.getByText('Chào bạn cùng bàn!')).toBeInTheDocument();
    expect(screen.getByText('1/50')).toBeInTheDocument();

    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'TABLE_CHAT',
          tableId: 'table_01',
          actorUserId: 'u-peer',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-self',
          coHostUserIds: [],
          isFreeCollab: false,
          chatMessage: {
            id: 'm2',
            userId: 'u-peer',
            nickname: 'PeerA',
            avatarId: 'avatar_02',
            content: 'Cùng xem bài 2 nhé',
            createdAtEpoch: 1_700_000_005_000,
          },
          timestampEpoch: 1_700_000_005_000,
        },
        'u-self',
      );
      // Event from another table must be ignored
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'TABLE_CHAT',
          tableId: 'table_02',
          actorUserId: 'u-other',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-other',
          coHostUserIds: [],
          isFreeCollab: false,
          chatMessage: {
            id: 'm3',
            userId: 'u-other',
            nickname: 'Outsider',
            avatarId: 'avatar_03',
            content: 'Tin nhắn bàn khác',
            createdAtEpoch: 1_700_000_006_000,
          },
          timestampEpoch: 1_700_000_006_000,
        },
        'u-self',
      );
    });

    expect(screen.getByText('Cùng xem bài 2 nhé')).toBeInTheDocument();
    expect(screen.queryByText('Tin nhắn bàn khác')).not.toBeInTheDocument();
    expect(useGameStore.getState().recentMessages).toHaveLength(0);
  });

  it('sends trimmed text and quick reactions, rejects blank input, and tracks 200-char counter', async () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'seat_01',
    });
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-self',
    });

    render(<TableWorkspaceShell />);

    const input = screen.getByTestId('table-chat-input') as HTMLInputElement;
    const sendBtn = screen.getByTestId('table-chat-send-btn');

    expect(screen.getByText('0/200')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.click(sendBtn);
    await waitFor(() => expect(sendTableChat).not.toHaveBeenCalled());

    fireEvent.change(input, { target: { value: '  Giải thích giúp mình bước 2  ' } });
    expect(screen.getByText('31/200')).toBeInTheDocument();
    fireEvent.click(sendBtn);

    await waitFor(() =>
      expect(sendTableChat).toHaveBeenCalledWith('table_01', 'Giải thích giúp mình bước 2')
    );
    await waitFor(() => expect(input.value).toBe(''));

    fireEvent.click(screen.getByRole('button', { name: 'Table reaction 👍' }));
    expect(sendTableChat).toHaveBeenCalledWith('table_01', '👍');
  });

  it('isolates WASD, arrow keys, and Escape when typing in Table Chat while SEATED and clears on leaveTable', () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'seat_01',
      isLeaveConfirmOpen: false,
    });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-self',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [],
        recentMessages: [
          {
            id: 'm1',
            userId: 'u-self',
            nickname: 'SelfLearner',
            avatarId: 'avatar_01',
            content: 'Hello',
            createdAtEpoch: 1_700_000_000_000,
          },
        ],
      },
      'u-self',
    );

    render(<TableWorkspaceShell />);

    const input = screen.getByTestId('table-chat-input');
    input.focus();

    fireEvent.keyDown(input, { key: 'w' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(useGameStore.getState().isLeaveConfirmOpen).toBe(false);
    expect(useGameStore.getState().characterState).toBe('SEATED');

    act(() => {
      useTableStore.getState().leaveTable();
    });
    expect(useTableStore.getState().recentMessages).toHaveLength(0);
  });
});
