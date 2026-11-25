import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('P12-T6 Slice 4: Live Comprehension Quick Check UI & Zero-CLS', () => {
  const originalWidth = window.innerWidth;
  const sendQuickCheck = vi.fn();

  beforeEach(() => {
    setViewportWidth(1280);
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.clearAllMocks();

    setActiveRoomStompSession({
      sendQuickCheck,
      sendPermissionRespond: vi.fn(),
      sendPermissionRequest: vi.fn(),
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    setViewportWidth(originalWidth);
    cleanup();
  });

  function seedTable(selfUserId: string, clearView = false) {
    window.localStorage.setItem('study_together_clear_view', clearView ? 'true' : 'false');
    useAuthStore.setState({ userId: selfUserId, nickname: selfUserId === 'u-host' ? 'Trưởng Bàn' : 'Học Sinh' });
    useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_01', roomId: 'main-library' });
    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      members: [
        {
          userId: 'u-host',
          nickname: 'Trưởng Bàn',
          avatarId: 'avatar_01',
          seatId: 'T1_S1',
          tableRole: 'TABLE_HOST',
          sitStartTimeEpoch: 1000,
          connected: true,
        },
        {
          userId: 'u-student',
          nickname: 'Học Sinh',
          avatarId: 'avatar_02',
          seatId: 'T1_S2',
          tableRole: 'MEMBER',
          sitStartTimeEpoch: 2000,
          connected: true,
        },
      ],
      quickCheckSignals: {},
    });
  }

  it('lets seated learners emit, toggle, and clear 1-tap signals and renders zero-CLS member & header badges', () => {
    seedTable('u-student', false);
    const { container } = render(<TableWorkspaceShell />);

    const understoodBtn = screen.getByTestId('quick-check-btn-UNDERSTOOD');
    const slowDownBtn = screen.getByTestId('quick-check-btn-SLOW_DOWN');
    const raiseHandBtn = screen.getByTestId('quick-check-btn-RAISE_HAND');

    expect(understoodBtn).toHaveAccessibleName(/Đã hiểu/i);
    expect(slowDownBtn).toHaveAccessibleName(/Chậm lại một chút/i);
    expect(raiseHandBtn).toHaveAccessibleName(/Giơ tay/i);
    expect(understoodBtn.className).toContain('min-h-[44px]');
    expect(understoodBtn.className).toContain('min-w-[44px]');

    // Non-host does not see Reset button
    expect(screen.queryByTestId('quick-check-reset-btn')).not.toBeInTheDocument();

    // Tap "Đã hiểu"
    fireEvent.click(understoodBtn);
    expect(sendQuickCheck).toHaveBeenCalledWith('table_01', 'UNDERSTOOD');

    // Reserved zero-CLS member badge & header summary update when store receives signal
    const memberBadge = screen.getByTestId('member-quick-check-u-student');
    expect(memberBadge.className).toContain('min-w-[');
    expect(memberBadge).toHaveAttribute('data-signal', 'NONE');

    const headerSummary = screen.getByTestId('header-quick-check-summary');
    expect(headerSummary.className).toContain('min-w-[');

    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'QUICK_CHECK_UPDATED',
          roomId: 'main-library',
          tableId: 'table_01',
          actorUserId: 'u-student',
          targetUserId: null,
          requesterNickname: 'Học Sinh',
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          quickCheckSignals: {
            'u-student': { signal: 'UNDERSTOOD', updatedAtEpoch: 5000 },
          },
          timestampEpoch: 5000,
        },
        'u-student',
      );
    });

    expect(understoodBtn).toHaveAttribute('aria-pressed', 'true');
    expect(memberBadge).toHaveAttribute('data-signal', 'UNDERSTOOD');
    expect(memberBadge).toHaveTextContent('Đã hiểu');
    expect(screen.getByTestId('quick-check-summary')).toHaveTextContent('1');

    // Tapping active signal toggles it off (sends CLEAR)
    fireEvent.click(understoodBtn);
    expect(sendQuickCheck).toHaveBeenCalledWith('table_01', 'CLEAR');

    // Zero legacy slate/sky classes
    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    for (const el of container.querySelectorAll('*')) {
      if (el.className && typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    }
  });

  it('keeps Quick Check bar and compact summary visible in Clear View on 375px mobile and supports Host reset', () => {
    setViewportWidth(375);
    seedTable('u-host', true);
    render(<TableWorkspaceShell />);

    expect(screen.getByTestId('clear-view-layout')).toBeInTheDocument();
    expect(screen.getByTestId('quick-check-bar')).toBeInTheDocument();
    expect(screen.getByTestId('quick-check-summary')).toBeInTheDocument();

    const resetBtn = screen.getByTestId('quick-check-reset-btn');
    expect(resetBtn).toBeDisabled();
    expect(resetBtn.className).toContain('min-h-[44px]');

    act(() => {
      useTableStore.setState({
        quickCheckSignals: {
          'u-student': { signal: 'RAISE_HAND', updatedAtEpoch: 6000 },
        },
      });
    });

    expect(resetBtn).toBeEnabled();
    fireEvent.click(resetBtn);
    expect(sendQuickCheck).toHaveBeenCalledWith('table_01', 'RESET_ALL');
  });
});
