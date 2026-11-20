import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientSoundscapeControl } from '../components/hud/AmbientSoundscapeControl';
import { ClassroomTelemetryBar } from '../components/hud/ClassroomTelemetryBar';
import { ReconnectingBanner } from '../components/hud/ReconnectingBanner';
import { RoomChatBox } from '../components/hud/RoomChatBox';
import { ServerWakeUpNotice } from '../components/hud/ServerWakeUpNotice';
import { SessionReplacedBanner } from '../components/hud/SessionReplacedBanner';
import { StudyGoalControl } from '../components/hud/StudyGoalControl';
import { StudyStreakBadge } from '../components/hud/StudyStreakBadge';
import { TopBar } from '../components/hud/TopBar';
import { TopBarActions } from '../components/hud/TopBarActions';
import { TopBarProfileMenu } from '../components/hud/TopBarProfileMenu';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('BNS-T3: Streamlined Botanical TopBar, Telemetry Bar & Floating Room Chat (#60)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('TopBar, TopBarActions & ProfileMenu Ergonomics and Botanical Tokens', () => {
    it('renders single-row TopBar with Botanical Night semantic border and card background', () => {
      render(
        <TopBar
          roomId="main-library"
          characterState="FREE_ROAM"
          nickname="MinhAnh"
          authProvider="GUEST"
          studyGoal="Học Toán"
          studyGoalCompleted={false}
          totalStudyMinutes={30}
          studyStreakDays={2}
          backendStatus="UP"
          currentTableId={null}
        />,
      );

      const header = screen.getByRole('banner', { name: /Thanh trạng thái phòng học/i });
      expect(header).toBeInTheDocument();
      expect(header.className).toContain('border-border');
      expect(header.className).toContain('bg-card');
      expect(header.className).toContain('backdrop-blur-md');
      expect(screen.getByTestId('topbar-left-zone')).toBeInTheDocument();
      expect(screen.getByTestId('topbar-center-zone')).toBeInTheDocument();
      expect(screen.getByTestId('topbar-right-zone')).toBeInTheDocument();
    });

    it('omits room-badge and seated-table-badge from TopBar even when SEATED to keep header clean', () => {
      render(
        <TopBar
          roomId="main-library"
          characterState="SEATED"
          nickname="MinhAnh"
          authProvider="LOCAL"
          studyGoal="Học Toán"
          studyGoalCompleted={true}
          totalStudyMinutes={60}
          studyStreakDays={5}
          backendStatus="UP"
          currentTableId="table_01"
          currentSeatId="T1_S1"
        />,
      );

      expect(screen.queryByTestId('room-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('seated-table-badge')).not.toBeInTheDocument();
    });

    it('renders TopBarActions with Studio SVG icons and no legacy sky/slate classes', () => {
      render(
        <TopBarActions
          authProvider="GUEST"
          totalStudyMinutes={45}
          studyStreakDays={3}
          onOpenStudySessions={vi.fn()}
          onOpenLeaderboard={vi.fn()}
          onOpenCustomizer={vi.fn()}
          profileMenu={<span data-testid="dummy-profile" />}
        />,
      );

      const minutesBtn = screen.getByTestId('study-minutes-badge');
      expect(minutesBtn).toHaveTextContent('45 phút');
      expect(minutesBtn.querySelector('svg')).toBeInTheDocument();

      const leaderboardBtn = screen.getByTestId('leaderboard-open-btn');
      expect(leaderboardBtn).toBeInTheDocument();
      expect(leaderboardBtn.className).toContain('bg-primary/15');
      expect(leaderboardBtn.className).toContain('text-primary');
      expect(leaderboardBtn.querySelector('svg')).toBeInTheDocument();

      const customizerBtn = screen.getByTestId('customizer-open-btn');
      expect(customizerBtn).toBeInTheDocument();
      expect(customizerBtn.className).toContain('border-border');
      expect(customizerBtn.className).not.toContain('sky-');
      expect(customizerBtn.querySelector('svg')).toBeInTheDocument();
    });

    it('renders ProfileMenu with CrownIcon for Table Host and DoorIcon for Leave Seat', () => {
      const onLeaveSeat = vi.fn();
      const onOpenUpgrade = vi.fn();
      render(
        <TopBarProfileMenu
          nickname="Trưởng Bàn"
          avatarSpriteId="default_student"
          authProvider="GUEST"
          characterState="SEATED"
          currentTableId="table_01"
          isTableHost={true}
          onLeaveSeat={onLeaveSeat}
          onOpenUpgrade={onOpenUpgrade}
        />,
      );

      const trigger = screen.getByTestId('profile-menu-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger.className).toContain('border-border');

      const crown = screen.getByTestId('table-host-crown');
      expect(crown.querySelector('svg')).toBeInTheDocument();

      fireEvent.click(trigger);

      const dropdown = screen.getByTestId('profile-dropdown-menu');
      expect(dropdown).toBeInTheDocument();
      expect(dropdown.className).toContain('bg-card');
      expect(dropdown.className).toContain('border-border');

      const upgradeBtn = screen.getByRole('menuitem', { name: /Nâng cấp tài khoản/i });
      expect(upgradeBtn.className).toContain('text-primary');

      const leaveBtn = screen.getByTestId('leave-seat-btn');
      expect(leaveBtn).toBeInTheDocument();
      expect(leaveBtn.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('StudyGoalControl & StudyStreakBadge Bioluminescent Styling', () => {
    it('renders StudyGoalControl check-off toggle with CheckIcon and Bioluminescent Emerald glow', () => {
      const onUpdateGoal = vi.fn();
      render(
        <StudyGoalControl
          studyGoal="Hoàn thành bài tập 1"
          studyGoalCompleted={true}
          canEdit={true}
          onUpdateGoal={onUpdateGoal}
        />,
      );

      const badge = screen.getByTestId('study-goal-completed-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.querySelector('svg')).toBeInTheDocument();

      const goalText = screen.getByTestId('study-goal-text');
      expect(goalText.className).toContain('text-emerald-300');

      const editBtn = screen.getByTestId('study-goal-edit-btn');
      expect(editBtn.querySelector('svg')).toBeInTheDocument();
    });

    it('renders StudyStreakBadge with FlameIcon and Bioluminescent Emerald glow', () => {
      render(<StudyStreakBadge days={7} testId="test-streak-badge" />);

      const badge = screen.getByTestId('test-streak-badge');
      expect(badge).toHaveTextContent('7 ngày');
      expect(badge.className).toContain('border-emerald-500/40');
      expect(badge.className).toContain('text-emerald-300');
      expect(badge.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('AmbientSoundscapeControl Studio Icons and Surfaces', () => {
    it('renders mixer trigger and channel cards with Studio SVG icons and no legacy classes', () => {
      render(<AmbientSoundscapeControl />);

      const toggleBtn = screen.getByTestId('ambient-soundscape-toggle-btn');
      expect(toggleBtn.querySelector('svg')).toBeInTheDocument();

      fireEvent.click(toggleBtn);

      const popover = screen.getByTestId('ambient-soundscape-popover');
      expect(popover).toBeInTheDocument();
      expect(popover.className).toContain('bg-card');
      expect(popover.className).not.toContain('slate-');

      expect(screen.getByTestId('ambient-channel-toggle-rain')).toBeInTheDocument();
      expect(screen.getByTestId('ambient-channel-toggle-cafe')).toBeInTheDocument();
      expect(screen.getByTestId('ambient-channel-toggle-fireplace')).toBeInTheDocument();
      expect(screen.getByTestId('ambient-channel-toggle-whitenoise')).toBeInTheDocument();
    });
  });

  describe('Status Banners & Classroom Telemetry Bar Botanical Surfaces', () => {
    it('renders ServerWakeUpNotice banner and card on Slate Leaf with #243630 border and Morning Mist text', () => {
      const { rerender } = render(
        <ServerWakeUpNotice variant="banner" elapsedSeconds={15} onRetry={vi.fn()} />,
      );

      const banner = screen.getByTestId('server-wakeup-banner');
      expect(banner.className).toContain('bg-card/95');
      expect(banner.className).toContain('border-border');
      expect(banner.className).toContain('text-foreground');

      rerender(<ServerWakeUpNotice variant="card" elapsedSeconds={20} onRetry={vi.fn()} />);

      const card = screen.getByTestId('server-wakeup-card');
      expect(card.className).toContain('bg-card');
      expect(card.className).toContain('border-border');
      expect(card.className).toContain('text-foreground');
    });

    it('renders ReconnectingBanner and SessionReplacedBanner on Slate Leaf with #243630 border', () => {
      const { rerender } = render(<ReconnectingBanner />);

      const reconnectBanner = screen.getByTestId('reconnecting-banner');
      expect(reconnectBanner.className).toContain('bg-[#16221E]/95');
      expect(reconnectBanner.className).toContain('border-[#243630]');
      expect(reconnectBanner.className).toContain('text-[#E6ECE8]');

      rerender(<SessionReplacedBanner />);

      const sessionBanner = screen.getByRole('status');
      expect(sessionBanner.className).toContain('bg-[#16221E]/95');
      expect(sessionBanner.className).toContain('border-[#243630]');
      expect(sessionBanner.className).toContain('text-[#E6ECE8]');
    });

    it('renders ClassroomTelemetryBar on Slate Leaf surfaces with #243630 borders, Morning Mist readouts, and Muted Sage labels', () => {
      useGameStore.setState({
        position: { x: 10, y: 15 },
        facingDir: 'DOWN',
        pathQueue: [{ tileX: 11, tileY: 15 }],
        currentTableId: 'table_01',
        currentSeatId: 'T1_S1',
      });
      useTableStore.setState({
        sosBanner: 'Cần giải thích bài 2',
      });

      render(<ClassroomTelemetryBar />);

      const gridPos = screen.getByTestId('grid-position-readout');
      expect(gridPos).toHaveTextContent('(10, 15) • DOWN');
      expect(gridPos.className).toContain('text-foreground');

      const parentCard = gridPos.closest('div');
      expect(parentCard?.className).toContain('bg-card');
      expect(parentCard?.className).toContain('border-border');

      const label = parentCard?.querySelector('span');
      expect(label?.className).toContain('text-muted-foreground');

      const pathReadout = screen.getByTestId('path-queue-readout');
      expect(pathReadout).toHaveTextContent('Còn 1 bước');

      const seatReadout = screen.getByTestId('active-seat-readout');
      expect(seatReadout).toHaveTextContent('table_01 / T1_S1');
    });
  });

  describe('Floating Room Chat Glassmorphism & Message Architecture', () => {
    it('renders floating launcher button on Slate Leaf with #243630 border and ChatIcon', () => {
      render(<RoomChatBox initialOpen={false} />);

      const button = screen.getByRole('button', { name: /Phòng học/i });
      expect(button).toBeInTheDocument();
      expect(button.className).toContain('bg-[#16221E]/95');
      expect(button.className).toContain('border-[#243630]');
      expect(button.className).toContain('text-[#E6ECE8]');
      expect(button.className).toContain('min-h-11');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('renders chat drawer with Glassmorphism without placing backdrop-blur on the scrollable message list', () => {
      useAuthStore.setState({ userId: 'self-1' });
      useGameStore.setState({
        roomId: 'main-library',
        recentMessages: [
          {
            id: 'm1',
            userId: 'peer-1',
            nickname: 'Bạn Học',
            avatarId: 'student_glasses',
            content: 'Chào cả phòng!',
            createdAtEpoch: 1_700_000_000_000,
          },
          {
            id: 'm2',
            userId: 'self-1',
            nickname: 'Tôi',
            avatarId: 'default_student',
            content: 'Chào bạn nhé!',
            createdAtEpoch: 1_700_000_010_000,
          },
        ],
      });

      const { container } = render(<RoomChatBox initialOpen={true} />);

      // Drawer shell has backdrop-blur-md
      const drawerShell = container.querySelector('.rounded-2xl');
      expect(drawerShell).toBeInTheDocument();
      expect(drawerShell?.className).toContain('bg-[#16221E]/95');
      expect(drawerShell?.className).toContain('border-[#243630]');
      expect(drawerShell?.className).toContain('backdrop-blur-md');

      // Scrollable message list container MUST NOT have backdrop-blur
      const messageList = drawerShell?.querySelector('.overflow-y-auto');
      expect(messageList).toBeInTheDocument();
      expect(messageList?.className).not.toContain('backdrop-blur');

      // Peer nickname has Bioluminescent Emerald accent
      expect(screen.getByText('Bạn Học').className).toContain('text-emerald-400');

      // Self nickname has Warm Amber distinction
      expect(screen.getByText('Bạn').className).toContain('text-primary');

      // Quick emoji reaction buttons are preserved
      expect(screen.getByRole('button', { name: '👋' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '🎉' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '☕' })).toBeInTheDocument();

      // Submit button is Warm Amber primary
      const sendBtn = screen.getByRole('button', { name: /Gửi/i });
      expect(sendBtn.className).toContain('bg-primary');
      expect(sendBtn.className).toContain('text-primary-foreground');
    });
  });

  describe('Zero Residual Legacy Class Audit', () => {
    it('verifies zero leftover slate-* or sky-* classes in rendered HUD chrome elements', () => {
      const { container } = render(
        <div>
          <TopBar
            roomId="main-library"
            characterState="FREE_ROAM"
            nickname="Học Sinh"
            authProvider="GUEST"
            studyGoal="Học bài"
            studyGoalCompleted={false}
            totalStudyMinutes={30}
            studyStreakDays={3}
            backendStatus="UP"
            currentTableId={null}
            onOpenLeaderboard={vi.fn()}
            onOpenCustomizer={vi.fn()}
            onOpenStudySessions={vi.fn()}
          />
          <ServerWakeUpNotice variant="banner" elapsedSeconds={10} onRetry={vi.fn()} />
          <ServerWakeUpNotice variant="card" elapsedSeconds={10} onRetry={vi.fn()} />
          <ReconnectingBanner />
          <SessionReplacedBanner />
          <ClassroomTelemetryBar />
          <RoomChatBox initialOpen={true} />
        </div>,
      );

      const allElements = container.querySelectorAll('*');
      const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
      for (const el of allElements) {
        if (el.className && typeof el.className === 'string') {
          expect(el.className).not.toMatch(legacyPaletteRegex);
        }
      }
    });
  });
});
