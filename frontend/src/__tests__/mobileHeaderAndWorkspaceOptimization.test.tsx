import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../components/hud/TopBar';
import { MinimizedTableWorkspaceBar } from '../components/table/MinimizedTableWorkspaceBar';
import { TableWorkspaceHeader } from '../components/table/TableWorkspaceHeader';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Mobile Header & Compact Table Workspace Optimization', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    setViewportWidth(1280);
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();
  });

  afterEach(() => {
    cleanup();
    setViewportWidth(originalWidth);
    vi.restoreAllMocks();
  });

  it('removes room-badge and seated-table-badge from TopBar and tucks StudyGoalControl inside mobile drawer', () => {
    setViewportWidth(375);
    const onUpdateStudyGoal = vi.fn();

    render(
      <TopBar
        roomId="main-library"
        characterState="SEATED"
        nickname="MobileLearner"
        authProvider="GUEST"
        studyGoal="Làm đề Giải tích"
        studyGoalCompleted={false}
        totalStudyMinutes={25}
        studyStreakDays={2}
        backendStatus="UP"
        currentTableId="table_03"
        currentSeatId="T3_S1"
        canEditStudyGoal={true}
        onUpdateStudyGoal={onUpdateStudyGoal}
      />,
    );

    expect(screen.queryByTestId('room-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seated-table-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('topbar-center-zone')).not.toBeInTheDocument();
    expect(screen.getByTestId('topbar-mobile-drawer')).not.toBeVisible();

    // Expanding mobile menu reveals StudyGoalControl cleanly inside drawer
    fireEvent.click(screen.getByTestId('topbar-mobile-menu-btn'));
    expect(screen.getByTestId('topbar-mobile-drawer')).toBeVisible();
    expect(screen.getByTestId('topbar-mobile-study-goal')).toBeVisible();
    expect(screen.getByTestId('study-goal-text')).toHaveTextContent('Làm đề Giải tích');

    fireEvent.click(screen.getByTestId('study-goal-toggle-btn'));
    expect(onUpdateStudyGoal).toHaveBeenCalledWith('Làm đề Giải tích', true);
  });

  it('displays concise table id without "Table Workspace • " prefix on both desktop and mobile', () => {
    const { rerender } = render(
      <TableWorkspaceHeader
        activeTableId="table_03"
        elapsedSeconds={95}
        isFreeCollab={false}
        isHost={true}
        canControl={true}
        onToggleFreeCollab={vi.fn()}
        onRequestControl={vi.fn()}
        onJoinVoice={vi.fn()}
        onToggleMute={vi.fn()}
        onMinimize={vi.fn()}
        onRequestLeaveSeat={vi.fn()}
      />,
    );

    const desktopTitle = screen.getByTestId('workspace-table-title');
    expect(desktopTitle).toHaveTextContent(/^table_03$/);
    expect(screen.queryByText(/Table Workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-collab-menu-btn')).not.toBeInTheDocument();

    act(() => {
      setViewportWidth(375);
    });
    rerender(
      <TableWorkspaceHeader
        activeTableId="table_03"
        elapsedSeconds={95}
        isFreeCollab={false}
        isHost={true}
        canControl={true}
        onToggleFreeCollab={vi.fn()}
        onRequestControl={vi.fn()}
        onJoinVoice={vi.fn()}
        onToggleMute={vi.fn()}
        onMinimize={vi.fn()}
        onRequestLeaveSeat={vi.fn()}
      />,
    );

    expect(screen.getByTestId('workspace-table-title')).toHaveTextContent(/^table_03$/);
    expect(screen.getByTestId('workspace-collab-menu-btn')).toBeInTheDocument();
  });

  it('renders single-row mobile TableWorkspaceHeader with >=44px touch targets, Zero-CLS voice pill, and dismissible collab popover', () => {
    setViewportWidth(375);
    const onToggleFreeCollab = vi.fn();

    render(
      <TableWorkspaceHeader
        activeTableId="table_03"
        elapsedSeconds={125}
        isFreeCollab={false}
        isHost={true}
        canControl={true}
        onToggleFreeCollab={onToggleFreeCollab}
        onRequestControl={vi.fn()}
        onJoinVoice={vi.fn()}
        onToggleMute={vi.fn()}
        onMinimize={vi.fn()}
        onRequestLeaveSeat={vi.fn()}
      />,
    );

    const voiceBtn = screen.getByTestId('header-voice-mic-pill');
    const collabBtn = screen.getByTestId('workspace-collab-menu-btn');
    const minimizeBtn = screen.getByTestId('minimize-workspace-btn');
    const leaveBtn = screen.getByTestId('workspace-leave-seat-btn');

    expect(voiceBtn.className).toContain('min-h-[44px]');
    expect(voiceBtn.className).toContain('min-w-[52px]');
    expect(collabBtn.className).toContain('min-h-[44px]');
    expect(collabBtn.className).toContain('min-w-[44px]');
    expect(minimizeBtn.className).toContain('min-h-[44px]');
    expect(minimizeBtn.className).toContain('min-w-[44px]');
    expect(leaveBtn.className).toContain('min-h-[44px]');
    expect(leaveBtn.className).toContain('min-w-[44px]');

    // Collab toggle lives inside overflow popover on mobile
    expect(screen.queryByTestId('workspace-collab-popover')).not.toBeInTheDocument();
    fireEvent.click(collabBtn);
    expect(screen.getByTestId('workspace-collab-popover')).toBeVisible();
    expect(screen.getByTestId('free-collab-badge')).toHaveTextContent('TẮT');

    fireEvent.click(screen.getByTestId('toggle-free-collab-btn'));
    expect(onToggleFreeCollab).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('workspace-collab-popover')).not.toBeInTheDocument();

    // Re-open and dismiss with Escape
    fireEvent.click(collabBtn);
    expect(screen.getByTestId('workspace-collab-popover')).toBeVisible();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('workspace-collab-popover')).not.toBeInTheDocument();
    expect(collabBtn).toHaveFocus();
  });

  it('hides FocusCycleBar and minimized focus countdown on mobile while preserving them on desktop', () => {
    useAuthStore.setState({ userId: 'u-1', nickname: 'Learner' });
    useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_03', currentSeatId: 'T3_S1' });
    useTableStore.setState({
      tableId: 'table_03',
      hostUserId: 'u-1',
      sitStartTimeEpoch: Date.now() - 30_000,
      members: [
        {
          userId: 'u-1',
          nickname: 'Learner',
          avatarId: 'default_student',
          seatId: 'T3_S1',
          tableRole: 'TABLE_HOST',
          sitStartTimeEpoch: Date.now() - 30_000,
          connected: true,
        },
      ],
    });

    setViewportWidth(375);
    const { rerender } = render(<TableWorkspaceShell />);
    expect(screen.queryByTestId('focus-cycle-bar')).not.toBeInTheDocument();

    act(() => {
      setViewportWidth(1280);
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.getByTestId('focus-cycle-bar')).toBeInTheDocument();

    // Also check MinimizedTableWorkspaceBar
    cleanup();
    setViewportWidth(375);
    const minimized = render(
      <MinimizedTableWorkspaceBar
        activeTableId="table_03"
        elapsedSeconds={60}
        isSeated={true}
        onJoinVoice={vi.fn()}
        onToggleMute={vi.fn()}
        onExpand={vi.fn()}
        onRequestLeaveSeat={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('minimized-focus-countdown')).not.toBeInTheDocument();

    act(() => {
      setViewportWidth(1280);
    });
    minimized.rerender(
      <MinimizedTableWorkspaceBar
        activeTableId="table_03"
        elapsedSeconds={60}
        isSeated={true}
        onJoinVoice={vi.fn()}
        onToggleMute={vi.fn()}
        onExpand={vi.fn()}
        onRequestLeaveSeat={vi.fn()}
      />,
    );
    expect(screen.getByTestId('minimized-focus-countdown')).toBeInTheDocument();
  });
});
