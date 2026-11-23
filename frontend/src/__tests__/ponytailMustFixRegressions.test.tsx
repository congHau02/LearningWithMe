import { useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { LeaveTableConfirmModal } from '../components/hud/LeaveTableConfirmModal';
import { HomeworkSlideTabs } from '../components/table/HomeworkSlideTabs';
import * as bootClassroomModule from '../game/graphics/bootClassroomGame';
import { destroyPhaserGameSafely } from '../game/graphics/bootClassroomGame';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('Ponytail Must-Fix & Phase 11 Regressions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  it('wakes a sleeping Phaser loop when destroying the game and skips waking an active loop', async () => {
    const sleepWake = vi.fn();
    const sleepDestroy = vi.fn();
    destroyPhaserGameSafely({ loop: { running: false, wake: sleepWake }, destroy: sleepDestroy });
    expect(sleepDestroy).toHaveBeenCalledWith(true);
    expect(sleepWake).toHaveBeenCalledWith(false);

    const activeWake = vi.fn();
    const activeDestroy = vi.fn();
    destroyPhaserGameSafely({ loop: { running: true, wake: activeWake }, destroy: activeDestroy });
    expect(activeDestroy).toHaveBeenCalledWith(true);
    expect(activeWake).not.toHaveBeenCalled();

    // ClassroomCanvas keeps Phaser booted across Guest->Registered JWT swap and only disposes on logout
    const disposeBoot = vi.fn();
    const bootSpy = vi.spyOn(bootClassroomModule, 'bootClassroomPhaserGame').mockImplementation(() => disposeBoot);
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Chrome/131.0');
    useAuthStore.setState({ userId: 'g-1', nickname: 'Guest', token: 'jwt-guest', authProvider: 'GUEST' });
    render(<ClassroomCanvas />);
    expect(bootSpy).toHaveBeenCalledTimes(1);
    expect(disposeBoot).not.toHaveBeenCalled();

    useAuthStore.setState({ userId: 'r-1', nickname: 'Reg', token: 'jwt-registered', authProvider: 'LOCAL' });
    await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-registered'));
    expect(bootSpy).toHaveBeenCalledTimes(1);
    expect(disposeBoot).not.toHaveBeenCalled();

    useAuthStore.getState().clearSession();
    await waitFor(() => expect(disposeBoot).toHaveBeenCalledTimes(1));
  });

  it('remaps hostUserId, coHostUserIds, and members for tablemates when PLAYER_UPDATED swaps previousUserId without ghost rows', () => {
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'guest-1',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'guest-1',
            nickname: 'GuestLearner',
            avatarId: 'default_student',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1000,
            connected: true,
          },
          {
            userId: 'peer-2',
            nickname: 'Peer',
            avatarId: 'student_glasses',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: 2000,
            connected: true,
          },
        ],
      },
      'peer-2',
    );

    useTableStore.getState().syncFromRoomSeatEvent({
      seq: 20,
      type: 'PLAYER_UPDATED',
      roomId: 'main-library',
      userId: 'reg-1',
      previousUserId: 'guest-1',
      timestampEpoch: 3000,
      player: {
        userId: 'reg-1',
        nickname: 'VerifiedHost',
        avatarId: 'student_hoodie',
        hatId: 'hat_beret',
        deskPetId: 'pet_cat',
        role: 'REGISTERED',
        state: 'SEATED',
        x: 5,
        y: 5,
        facingDir: 'DOWN',
        tableId: 'table_01',
        seatId: 'T1_S1',
        connected: true,
      },
    });

    const upgraded = useTableStore.getState();
    expect(upgraded.hostUserId).toBe('reg-1');
    expect(upgraded.members.some((m) => m.userId === 'guest-1')).toBe(false);
    expect(upgraded.members.find((m) => m.userId === 'reg-1')?.tableRole).toBe('TABLE_HOST');
    expect(upgraded.members.find((m) => m.userId === 'reg-1')?.nickname).toBe('VerifiedHost');

    useTableStore.getState().syncFromRoomSeatEvent({
      seq: 21,
      type: 'SEAT_RELEASED',
      roomId: 'main-library',
      userId: 'reg-1',
      previousUserId: null,
      tableId: 'table_01',
      seatId: 'T1_S1',
      hostUserId: 'peer-2',
      player: null,
      timestampEpoch: 4000,
    });
    expect(useTableStore.getState().members.map((m) => m.userId)).toEqual(['peer-2']);
  });

  it('uses solid bg-primary + text-primary-foreground on active HomeworkSlideTabs and semantic hover tokens', () => {
    render(
      <HomeworkSlideTabs
        slides={[
          { imageId: 's1', url: '/1.webp', fileName: '1.webp', uploadedByUserId: 'u1', uploadedAtEpoch: 1000, strokes: [] },
          { imageId: 's2', url: '/2.webp', fileName: '2.webp', uploadedByUserId: 'u1', uploadedAtEpoch: 2000, strokes: [] },
        ]}
        activeSlideId="s1"
        canControl={true}
        onSelectSlide={vi.fn()}
        onDeleteSlide={vi.fn()}
      />,
    );

    const activeTab = screen.getByTestId('homework-slide-tab-s1');
    expect(activeTab.className).toContain('bg-primary');
    expect(activeTab.className).not.toContain('bg-primary/25');
    expect(activeTab.className).toContain('text-primary-foreground');

    const inactiveTab = screen.getByTestId('homework-slide-tab-s2');
    expect(inactiveTab.className).toContain('hover:bg-accent');
    expect(inactiveTab.className).not.toContain('#243630');
  });

  it('closes LeaveTableConfirmModal on Escape, uses h2 aria-labelledby, filters inert/hidden focusables in useFocusTrap, and restores App focus on modal close', async () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <LeaveTableConfirmModal tableId="table_01" seatId="T1_S1" onConfirmLeave={vi.fn()} onCancel={onCancel} />,
    );
    const dialog = screen.getByRole('dialog', { name: /Xác nhận đứng dậy rời bàn/i });
    expect(dialog.querySelector('h2#leave-table-confirm-title')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    function TrapProbe() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, true);
      return (
        <div ref={ref} data-testid="trap-box">
          <button type="button" style={{ display: 'none' }} data-testid="hidden-btn">Hidden</button>
          <button type="button" data-testid="visible-btn">Visible</button>
        </div>
      );
    }
    const trap = render(<TrapProbe />);
    expect(document.activeElement).toBe(screen.getByTestId('visible-btn'));
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('visible-btn'));
    trap.unmount();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) return new Response(JSON.stringify({ status: 'UP' }), { status: 200 });
      if (url.includes('/api/v1/stats/leaderboard')) {
        return new Response(JSON.stringify({ limit: 20, totalRankedLearners: 0, entries: [], myEntry: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ totalStudyMinutes: 0, totalSessions: 0, studyStreakDays: 0, recentSessions: [] }), { status: 200 });
    });

    useAuthStore.setState({ userId: 'u-focus', nickname: 'FocusUser', token: 'jwt-focus', authProvider: 'GUEST' });
    render(<App />);
    const leaderboardBtn = await screen.findByTestId('leaderboard-open-btn');
    leaderboardBtn.focus();
    expect(document.activeElement).toBe(leaderboardBtn);

    fireEvent.click(leaderboardBtn);
    await screen.findByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(leaderboardBtn));
  });
});
