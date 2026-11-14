import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { TableSosOverlay } from '../game/entities/TableSosOverlay';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

function createMockPhaserScene() {
  const graphics = {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillRoundedRect: vi.fn(),
    lineStyle: vi.fn(),
    strokeRoundedRect: vi.fn(),
    destroy: vi.fn(),
  };

  const createdTexts: Array<{
    text: string;
    visible: boolean;
    width: number;
    height: number;
    setOrigin: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setText: (next: string) => void;
    setPosition: ReturnType<typeof vi.fn>;
    setVisible: (v: boolean) => void;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  const scene = {
    add: {
      graphics: vi.fn(() => graphics),
      text: vi.fn((_x: number, _y: number, initialText: string) => {
        const entry = {
          text: initialText,
          visible: true,
          width: 120,
          height: 18,
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setText: vi.fn((next: string) => {
            entry.text = next;
          }),
          setPosition: vi.fn().mockReturnThis(),
          setVisible: vi.fn((v: boolean) => {
            entry.visible = v;
          }),
          destroy: vi.fn(),
        };
        createdTexts.push(entry);
        return entry;
      }),
    },
  };

  return { scene, graphics, createdTexts };
}

describe('P4-T3 Table SOS Banner Toggle, Room Broadcast & 2D Map Glowing Indicator', () => {
  const sendSosToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'HostUser',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });

    setActiveRoomStompSession({
      sendSosToggle,
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
  });

  it('allows Host/Co-Host/FreeCollab member to toggle SOS with topic validation and hides controls for unauthorized Member', () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'seat_01',
    });
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      coHostUserIds: [],
      isFreeCollab: false,
      sosBanner: null,
      sitStartTimeEpoch: Date.now(),
    });

    render(<TableWorkspaceShell />);

    fireEvent.click(screen.getByTestId('sos-open-form-btn'));
    fireEvent.change(screen.getByTestId('sos-topic-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('sos-activate-btn'));
    expect(screen.getByTestId('sos-topic-error')).toBeInTheDocument();
    expect(sendSosToggle).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('sos-topic-input'), {
      target: { value: '  Cần giúp Tích phân từng phần  ' },
    });
    fireEvent.click(screen.getByTestId('sos-activate-btn'));
    expect(sendSosToggle).toHaveBeenCalledWith('table_01', {
      active: true,
      topic: 'Cần giúp Tích phân từng phần',
    });

    // Apply SOS_UPDATED workspace event
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'SOS_UPDATED',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: 'Cần giúp Tích phân từng phần',
          timestampEpoch: Date.now(),
        },
        'u-host',
      );
    });

    expect(screen.getByTestId('active-sos-banner')).toHaveTextContent('Cần giúp Tích phân từng phần');

    // Host can deactivate SOS
    fireEvent.click(screen.getByTestId('sos-deactivate-btn'));
    expect(sendSosToggle).toHaveBeenCalledWith('table_01', { active: false });

    // Unauthorized Member cannot toggle SOS when isFreeCollab == false
    act(() => {
      useAuthStore.setState({ userId: 'u-member' });
    });
    expect(screen.queryByTestId('sos-deactivate-btn')).not.toBeInTheDocument();

    act(() => {
      useTableStore.getState().setSosBanner(null);
    });
    expect(screen.queryByTestId('sos-open-form-btn')).not.toBeInTheDocument();

    // When isFreeCollab == true, Member gains SOS toggle controls
    act(() => {
      useTableStore.getState().setFreeCollab(true);
    });
    expect(screen.getByTestId('sos-open-form-btn')).toBeInTheDocument();
  });

  it('syncs SOS_UPDATED and snapshot sosBanner into useGameStore and clears when table becomes empty', () => {
    useGameStore.getState().applyRoomSnapshot(
      {
        roomId: 'main-library',
        capacityLimit: 50,
        eventSeq: 10,
        players: [],
        seats: { seat_01: 'u-host' },
        tables: [
          {
            tableId: 'table_01',
            label: 'Bàn 1',
            capacity: 4,
            hostUserId: 'u-host',
            coHostUserIds: [],
            isFreeCollab: false,
            sosBanner: 'Giải tích 1',
            occupiedSeats: 1,
          },
        ],
        recentMessages: [],
      },
      'u-observer',
    );

    expect(useGameStore.getState().roomTables[0]?.sosBanner).toBe('Giải tích 1');

    useGameStore.getState().applyIncomingRoomEvent(
      {
        seq: 11,
        type: 'SOS_UPDATED',
        roomId: 'main-library',
        userId: 'u-host',
        previousUserId: null,
        player: null,
        tableId: 'table_01',
        sosBanner: 'Vật lý đại cương',
        timestampEpoch: Date.now(),
      },
      'u-observer',
    );
    expect(useGameStore.getState().roomTables[0]?.sosBanner).toBe('Vật lý đại cương');

    // Last learner leaves (hostUserId: null) -> auto clears sosBanner
    useGameStore.getState().applyIncomingRoomEvent(
      {
        seq: 12,
        type: 'SEAT_RELEASED',
        roomId: 'main-library',
        userId: 'u-host',
        previousUserId: null,
        player: null,
        tableId: 'table_01',
        seatId: 'seat_01',
        hostUserId: null,
        timestampEpoch: Date.now(),
      },
      'u-observer',
    );
    expect(useGameStore.getState().roomTables[0]?.sosBanner).toBeNull();
  });

  it('renders glowing SOS badge on 2D map above active SOS tables and hides it when cleared', () => {
    const { scene, graphics, createdTexts } = createMockPhaserScene();
    const overlay = new TableSosOverlay(scene as never, MAIN_LIBRARY_TOPOLOGY);

    overlay.update(
      [
        {
          tableId: 'table_01',
          label: 'Bàn 1',
          capacity: 4,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: 'Cần giúp Hóa hữu cơ',
          occupiedSeats: 1,
        },
      ],
      1000,
    );

    expect(overlay.getActiveSosTableIds()).toEqual(['table_01']);
    expect(graphics.fillRoundedRect).toHaveBeenCalledTimes(1);
    expect(graphics.strokeRoundedRect).toHaveBeenCalledTimes(1);
    expect(createdTexts[0]?.text).toBe('🆘 Cần giúp Hóa hữu cơ');
    expect(createdTexts[0]?.visible).toBe(true);

    overlay.update(
      [
        {
          tableId: 'table_01',
          label: 'Bàn 1',
          capacity: 4,
          hostUserId: null,
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: null,
          occupiedSeats: 0,
        },
      ],
      1500,
    );

    expect(overlay.getActiveSosTableIds()).toEqual([]);
    expect(createdTexts[0]?.visible).toBe(false);
    overlay.destroy();
  });
});
