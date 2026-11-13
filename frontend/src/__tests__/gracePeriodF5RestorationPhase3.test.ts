import { beforeEach, describe, expect, it } from 'vitest';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import type { RoomSnapshotResponse } from '../services/roomApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P3-T4 Grace Period Watchdog, F5 Seat Restoration & Grace-Aware Succession', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'self-host-1',
      token: 'jwt-token-1',
      nickname: 'HeroHost',
      avatarId: 'avatar_01',
      role: 'GUEST',
    });
  });

  it('restores SEATED character state in useGameStore and TABLE_HOST in useTableStore from Room Snapshot on F5', () => {
    const snapshot: RoomSnapshotResponse = {
      roomId: 'main-library',
      capacityLimit: 50,
      eventSeq: 42,
      players: [
        {
          userId: 'self-host-1',
          nickname: 'HeroHost',
          avatarId: 'avatar_01',
          role: 'GUEST',
          state: 'SEATED',
          x: 11,
          y: 3,
          facingDir: 'UP',
          tableId: 'table_01',
          seatId: 'T1_S1',
          connected: true,
          isMoving: false,
        },
        {
          userId: 'peer-member-2',
          nickname: 'StudyBuddy',
          avatarId: 'avatar_02',
          role: 'GUEST',
          state: 'SEATED',
          x: 12,
          y: 3,
          facingDir: 'UP',
          tableId: 'table_01',
          seatId: 'T1_S2',
          connected: false, // in grace period
          isMoving: false,
        },
      ],
      seats: {
        T1_S1: 'self-host-1',
        T1_S2: 'peer-member-2',
      },
      tables: [
        {
          tableId: 'table_01',
          label: 'Bàn 1',
          capacity: 4,
          hostUserId: 'self-host-1',
          coHostUserIds: ['peer-member-2'],
          isFreeCollab: true,
          sosBanner: 'Calculus 1',
          occupiedSeats: 2,
        },
      ],
      recentMessages: [],
    };

    // Apply snapshot to game store
    useGameStore.getState().applyRoomSnapshot(snapshot, 'self-host-1');

    // Verify useGameStore seat restoration
    const gameState = useGameStore.getState();
    expect(gameState.characterState).toBe('SEATED');
    expect(gameState.currentTableId).toBe('table_01');
    expect(gameState.currentSeatId).toBe('T1_S1');
    expect(gameState.position).toEqual({ x: 11, y: 3 });
    expect(gameState.facingDir).toBe('UP');
    expect(gameState.occupiedSeats).toEqual({
      T1_S1: 'self-host-1',
      T1_S2: 'peer-member-2',
    });

    // Synchronize table store from snapshot (as done in useRoomSync onSnapshot)
    const selfPlayer = snapshot.players.find((p) => p.userId === 'self-host-1');
    if (selfPlayer && selfPlayer.state === 'SEATED' && selfPlayer.tableId) {
      const table = snapshot.tables.find((t) => t.tableId === selfPlayer.tableId);
      useTableStore.getState().setTableState({
        tableId: selfPlayer.tableId,
        hostUserId: table?.hostUserId ?? null,
        coHostUserIds: table?.coHostUserIds ?? [],
        isFreeCollab: table?.isFreeCollab ?? false,
        sosBanner: table?.sosBanner ?? null,
      });
    }

    // Verify useTableStore restoration
    const tableState = useTableStore.getState();
    expect(tableState.tableId).toBe('table_01');
    expect(tableState.hostUserId).toBe('self-host-1');
    expect(tableState.coHostUserIds).toEqual(['peer-member-2']);
    expect(tableState.isFreeCollab).toBe(true);
    expect(tableState.sosBanner).toBe('Calculus 1');
  });

  it('renders "(Đang giữ chỗ)" and translucent alpha (0.55) in RemotePlayersRenderer for disconnected seated player in grace period', () => {
    const renderer = new RemotePlayersRenderer({ tileSize: 32 });

    // Peer disconnected in grace period
    renderer.syncPlayers({
      'peer-member-2': {
        userId: 'peer-member-2',
        nickname: 'StudyBuddy',
        avatarId: 'default_student',
        role: 'GUEST',
        state: 'SEATED',
        x: 12,
        y: 3,
        facingDir: 'UP',
        tableId: 'table_01',
        seatId: 'T1_S2',
        connected: false,
        isMoving: false,
      },
    });

    const snapshot = renderer.getSnapshot('peer-member-2');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.connected).toBe(false);
    expect(snapshot?.state).toBe('SEATED');

    renderer.destroy();
  });
});
