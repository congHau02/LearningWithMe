import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { TopBar } from '../components/hud/TopBar';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P9-T4 (#53): Streamlined Single-Row TopBar Header & Profile Dropdown', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });
    window.dispatchEvent(new Event('resize'));
    useAuthStore.getState().clearSession();
    useGameStore.setState({
      characterState: 'FREE_ROAM',
      currentTableId: null,
      currentSeatId: null,
    });
    useTableStore.getState().leaveTable();
  });

  it('organizes desktop TopBar into Left, Center, and Right zones and hides raw character state & healthy Backend: UP badges', () => {
    render(
      <TopBar
        roomId="main-library"
        characterState="FREE_ROAM"
        nickname="MinhAnh"
        authProvider="GUEST"
        studyGoal="Ôn tập Giải tích"
        studyGoalCompleted={false}
        totalStudyMinutes={45}
        studyStreakDays={4}
        backendStatus="UP"
        currentTableId={null}
        canEditStudyGoal={true}
        onOpenUpgrade={vi.fn()}
        onOpenStudySessions={vi.fn()}
        onOpenLeaderboard={vi.fn()}
        onOpenCustomizer={vi.fn()}
      />,
    );

    expect(screen.getByTestId('topbar-left-zone')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-center-zone')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-right-zone')).toBeInTheDocument();

    // Noisy technical badges are hidden in normal healthy operation
    expect(screen.queryByTestId('character-state-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('backend-status-badge')).not.toBeInTheDocument();

    // Secondary account metadata and upgrade CTA are tucked inside the profile dropdown, not inline
    expect(screen.queryByTestId('profile-dropdown-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auth-provider-badge')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Nâng cấp tài khoản/i })).not.toBeInTheDocument();

    // Guest un-upgraded indicator dot is visible on profile trigger
    expect(screen.getByTestId('guest-upgrade-indicator')).toBeInTheDocument();
  });

  it('shows Backend status badge only for CHECKING or OFFLINE states and omits room/table badges even when SEATED', () => {
    const { rerender } = render(
      <TopBar
        roomId="main-library"
        characterState="WALKING_TO_SEAT"
        nickname="MinhAnh"
        authProvider="LOCAL"
        studyGoal="Đọc tài liệu"
        backendStatus="CHECKING"
        currentTableId={null}
      />,
    );

    expect(screen.queryByTestId('character-state-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('room-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('backend-status-badge')).toHaveTextContent('Backend: CHECKING');
    expect(screen.queryByTestId('seated-table-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-upgrade-indicator')).not.toBeInTheDocument();

    rerender(
      <TopBar
        roomId="main-library"
        characterState="SEATED"
        nickname="MinhAnh"
        authProvider="LOCAL"
        studyGoal="Đọc tài liệu"
        backendStatus="OFFLINE"
        currentTableId="table_02"
        currentSeatId="T2_S1"
        isTableHost={true}
      />,
    );

    expect(screen.getByTestId('backend-status-badge')).toHaveTextContent('Backend: OFFLINE');
    expect(screen.queryByTestId('room-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seated-table-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-host-crown')).toBeInTheDocument();
  });

  it('opens Profile dropdown with provider badge, Guest upgrade CTA, and Leave Seat action, and closes on Escape or outside click', () => {
    const onOpenUpgrade = vi.fn();
    const onLeaveSeat = vi.fn();

    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <TopBar
          roomId="main-library"
          characterState="SEATED"
          nickname="GuestLearner"
          authProvider="GUEST"
          studyGoal="Luyện đề"
          backendStatus="UP"
          currentTableId="table_01"
          currentSeatId="T1_S2"
          onOpenUpgrade={onOpenUpgrade}
          onLeaveSeat={onLeaveSeat}
        />
      </div>,
    );

    const trigger = screen.getByTestId('profile-menu-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('profile-dropdown-menu');
    expect(menu).toBeVisible();
    expect(screen.getByTestId('auth-provider-badge')).toHaveTextContent('GUEST');

    // Escape closes dropdown and restores focus to trigger
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('profile-dropdown-menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    // Outside click/pointerdown closes dropdown
    fireEvent.click(trigger);
    expect(screen.getByTestId('profile-dropdown-menu')).toBeVisible();
    fireEvent.pointerDown(screen.getByTestId('outside-area'));
    expect(screen.queryByTestId('profile-dropdown-menu')).not.toBeInTheDocument();

    // Clicking Guest upgrade CTA triggers handler and closes dropdown
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /Nâng cấp tài khoản/i }));
    expect(onOpenUpgrade).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('profile-dropdown-menu')).not.toBeInTheDocument();

    // Clicking Leave Seat triggers handler and closes dropdown
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId('leave-seat-btn'));
    expect(onLeaveSeat).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('profile-dropdown-menu')).not.toBeInTheDocument();
  });

  it('closes Profile dropdown on Escape while SEATED without triggering LeaveTableConfirmModal', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    useAuthStore.setState({
      userId: 'u-seated-1',
      nickname: 'SeatedUser',
      authProvider: 'GUEST',
      token: 'fake-token',
    });
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    expect(screen.getByTestId('profile-dropdown-menu')).toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('profile-dropdown-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leave-seat-confirm-dialog')).not.toBeInTheDocument();
  });

  it('ensures >= 44px touch targets on mobile (375px) primary controls', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));

    render(
      <TopBar
        roomId="main-library"
        characterState="SEATED"
        nickname="MobileUser"
        authProvider="GUEST"
        studyGoal="Học từ vựng"
        backendStatus="UP"
        currentTableId="table_01"
        currentSeatId="T1_S1"
        onOpenLeaderboard={vi.fn()}
        onOpenCustomizer={vi.fn()}
      />,
    );

    const mobileMenuBtn = screen.getByTestId('topbar-mobile-menu-btn');
    const ambientBtn = screen.getByTestId('ambient-soundscape-toggle-btn');
    expect(mobileMenuBtn.className).toContain('min-h-11');
    expect(mobileMenuBtn.className).toContain('min-w-11');
    expect(ambientBtn.className).toContain('min-h-11');
    expect(ambientBtn.className).toContain('min-w-11');
    expect(screen.queryByTestId('seated-table-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('room-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('study-goal-text')).not.toBeVisible();

    fireEvent.click(mobileMenuBtn);
    expect(screen.getByTestId('study-goal-text')).toBeVisible();
    expect(screen.getByTestId('leaderboard-open-btn').className).toContain('min-h-11');
    expect(screen.getByTestId('leaderboard-open-btn').className).toContain('min-w-11');
    expect(screen.getByTestId('customizer-open-btn').className).toContain('min-h-11');
    expect(screen.getByTestId('customizer-open-btn').className).toContain('min-w-11');
  });
});
