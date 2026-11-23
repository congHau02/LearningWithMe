import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountUpgradeModal } from '../components/auth/AccountUpgradeModal';
import { GuestOnboardingModal } from '../components/auth/GuestOnboardingModal';
import { CharacterCustomizerItemCard } from '../components/hud/CharacterCustomizerItemCard';
import { CharacterCustomizerModal } from '../components/hud/CharacterCustomizerModal';
import { LeaderboardEntryRow } from '../components/hud/LeaderboardEntryRow';
import { LeaveTableConfirmModal } from '../components/hud/LeaveTableConfirmModal';
import { StudyLeaderboardModal } from '../components/hud/StudyLeaderboardModal';
import { StudySessionsModal } from '../components/hud/StudySessionsModal';
import { VirtualDrinkMenuModal } from '../components/hud/VirtualDrinkMenuModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('BNS-T2: Botanical Night Onboarding, Account Upgrade & Study Café Modals', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Guest Onboarding & Account Upgrade Modals (Double-Bezel & Warm Amber CTA)', () => {
    it('renders GuestOnboardingModal in Double-Bezel shell with Warm Amber CTA and dark ink', () => {
      const { container } = render(<GuestOnboardingModal />);

      const dialog = screen.getByRole('dialog', { name: /Thiết lập nhân vật học tập/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      // Backdrop uses Deep Pine Night semantic token (bg-background/80)
      const backdrop = container.firstElementChild as HTMLElement;
      expect(backdrop.className).toContain('bg-background/80');

      // Primary submit button uses Warm Amber (bg-primary) with Deep Pine ink (text-primary-foreground)
      const submitBtn = screen.getByRole('button', { name: /Vào phòng học ngay/i });
      expect(submitBtn.className).toContain('bg-primary');
      expect(submitBtn.className).toContain('text-primary-foreground');
      expect(submitBtn.className).toContain('min-h-11');
    });

    it('renders AccountUpgradeModal in Double-Bezel shell with dark ink Warm Amber CTA', () => {
      const onClose = vi.fn();
      const onUpgraded = vi.fn();
      const { container } = render(
        <AccountUpgradeModal onClose={onClose} onUpgraded={onUpgraded} />,
      );

      const dialog = screen.getByRole('dialog', { name: /Nâng cấp tài khoản/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      const backdrop = container.firstElementChild as HTMLElement;
      expect(backdrop.className).toContain('bg-background/80');

      const submitBtn = screen.getByRole('button', { name: /Hoàn tất nâng cấp/i });
      expect(submitBtn.className).toContain('bg-primary');
      expect(submitBtn.className).toContain('text-primary-foreground');
      expect(submitBtn.className).toContain('min-h-11');

      const closeBtn = screen.getByRole('button', { name: /Đóng/i });
      expect(closeBtn.className).toContain('min-h-11');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Study Sessions & Study Leaderboard Modals (Zero legacy slate/sky & SVG icons)', () => {
    it('renders StudySessionsModal in Double-Bezel shell without legacy slate/sky classes', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'user-1',
            role: 'REGISTERED',
            totalStudyMinutes: 90,
            totalSessions: 3,
            studyStreakDays: 4,
            recentSessions: [
              {
                id: 'sess-1',
                tableId: 'table_01',
                startedAt: '2026-11-17T10:00:00Z',
                endedAt: '2026-11-17T10:45:00Z',
                durationMinutes: 45,
                studyGoal: 'Luyện đề Spring Boot',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { container } = render(
        <StudySessionsModal authProvider="LOCAL" onClose={vi.fn()} />,
      );

      const dialog = await screen.findByRole('dialog', { name: /Lịch sử Phiên học/i });
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      // Zero legacy slate-* or sky-* classes in chrome
      expect(container.innerHTML).not.toMatch(/slate-\d+/);
      expect(container.innerHTML).not.toMatch(/sky-\d+/);
    });

    it('renders LeaderboardEntryRow with Trophy SVG icons instead of podium emojis', () => {
      const { container: top1 } = render(
        <LeaderboardEntryRow
          entry={{
            rank: 1,
            userId: 'top-1',
            nickname: 'Ngọc Mai',
            avatarSpriteId: 'student_glasses',
            role: 'REGISTERED',
            totalStudyMinutes: 240,
            totalSessions: 6,
            studyStreakDays: 3,
          }}
          isSelf={false}
        />,
      );
      // Top 1 has Trophy SVG icon and no 🥇 emoji
      expect(top1.innerHTML).not.toContain('🥇');
      expect(screen.getByTestId('leaderboard-podium-badge-1')).toBeInTheDocument();
      expect(top1.querySelector('svg')).toBeInTheDocument();

      const { container: top2 } = render(
        <LeaderboardEntryRow
          entry={{
            rank: 2,
            userId: 'top-2',
            nickname: 'Tuấn Anh',
            avatarSpriteId: 'student_hoodie',
            role: 'REGISTERED',
            totalStudyMinutes: 180,
            totalSessions: 4,
            studyStreakDays: 2,
          }}
          isSelf={false}
        />,
      );
      // Top 2 has no 🥈 emoji and no slate-* classes
      expect(top2.innerHTML).not.toContain('🥈');
      expect(top2.innerHTML).not.toMatch(/slate-\d+/);
      expect(screen.getByTestId('leaderboard-podium-badge-2')).toBeInTheDocument();
    });

    it('renders StudyLeaderboardModal in Double-Bezel shell with Warm Amber upgrade CTA', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            limit: 20,
            totalRankedLearners: 1,
            entries: [
              {
                rank: 1,
                userId: 'u-1',
                nickname: 'Lan Anh',
                avatarSpriteId: 'student_glasses',
                role: 'REGISTERED',
                totalStudyMinutes: 195,
                totalSessions: 5,
                studyStreakDays: 3,
              },
            ],
            myEntry: {
              rank: null,
              userId: 'guest-1',
              nickname: 'Khách',
              avatarSpriteId: 'student_sprout',
              role: 'GUEST',
              totalStudyMinutes: 75,
              totalSessions: 2,
              studyStreakDays: 1,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const onRequestUpgrade = vi.fn();
      render(
        <StudyLeaderboardModal
          onClose={vi.fn()}
          onRequestUpgrade={onRequestUpgrade}
        />,
      );

      const dialog = await screen.findByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i });
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      const upgradeBtn = screen.getByRole('button', { name: /Nâng cấp tài khoản/i });
      expect(upgradeBtn.className).toContain('bg-primary');
      expect(upgradeBtn.className).toContain('text-primary-foreground');
      fireEvent.click(upgradeBtn);
      expect(onRequestUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  describe('Character Customizer & Item Card (Lock SVG Icon & Double-Bezel)', () => {
    it('renders CharacterCustomizerItemCard with Lock/Check SVG icon instead of raw emojis', () => {
      const { rerender } = render(
        <CharacterCustomizerItemCard
          item={{
            id: 'item-locked',
            itemName: 'Mũ Cử Nhân',
            itemType: 'HAT',
            requiredStudyMinutes: 600,
            unlocked: false,
            remainingMinutes: 460,
            equipped: false,
          }}
          selected={false}
          onSelect={vi.fn()}
        />,
      );

      // Contains text "Cần thêm 460 phút" and Lock SVG icon, no raw 🔒 emoji
      const lockedCard = screen.getByTestId('customizer-item-item-locked');
      expect(lockedCard).toHaveTextContent(/Cần thêm 460 phút/i);
      expect(lockedCard.innerHTML).not.toContain('🔒');
      expect(lockedCard.querySelector('svg')).toBeInTheDocument();

      rerender(
        <CharacterCustomizerItemCard
          item={{
            id: 'item-unlocked',
            itemName: 'Tai Nghe Lofi',
            itemType: 'HAT',
            requiredStudyMinutes: 120,
            unlocked: true,
            remainingMinutes: 0,
            equipped: false,
          }}
          selected={false}
          onSelect={vi.fn()}
        />,
      );
      const unlockedCard = screen.getByTestId('customizer-item-item-unlocked');
      expect(unlockedCard).toHaveTextContent(/Đã mở khóa/i);
      expect(unlockedCard.innerHTML).not.toContain('✓');
      expect(unlockedCard.querySelector('svg')).toBeInTheDocument();
    });

    it('renders CharacterCustomizerModal inside Double-Bezel shell with Warm Amber CTA', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            totalStudyMinutes: 120,
            equipped: { skinId: 'default_student', hatId: 'hat_none', deskPetId: 'pet_sprout_pot' },
            items: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<CharacterCustomizerModal onClose={vi.fn()} />);

      const dialog = await screen.findByTestId('character-customizer-modal');
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      const saveBtn = screen.getByTestId('customizer-save-btn');
      expect(saveBtn.className).toContain('bg-primary');
      expect(saveBtn.className).toContain('text-primary-foreground');
      expect(saveBtn.className).toContain('min-h-11');
    });
  });

  describe('Virtual Drink Menu & Leave Table Confirm Modals', () => {
    it('renders VirtualDrinkMenuModal in Double-Bezel shell with #0F1714 icon background (no slate)', () => {
      useGameStore.setState({ isDrinkMenuOpen: true });
      const { container } = render(<VirtualDrinkMenuModal />);

      const dialog = screen.getByTestId('virtual-drink-menu-modal');
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      // Zero legacy slate-* classes in drink menu chrome
      expect(container.innerHTML).not.toMatch(/slate-\d+/);

      // Virtual drink item illustration (e.g. ☕) remains intact
      expect(screen.getByTestId('drink-option-iced_milk_coffee')).toHaveTextContent('☕');
    });

    it('renders LeaveTableConfirmModal in Double-Bezel shell over #0F1714 backdrop (no slate-950)', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const { container } = render(
        <LeaveTableConfirmModal
          tableId="table_01"
          seatId="T1_S1"
          onConfirmLeave={onConfirm}
          onCancel={onCancel}
        />,
      );

      const dialog = screen.getByTestId('leave-seat-confirm-dialog');
      expect(dialog).toHaveAttribute('data-slot', 'double-bezel-outer');
      expect(dialog.querySelector('[data-slot="double-bezel-inner"]')).toBeInTheDocument();

      // Backdrop uses semantic Deep Pine glass backdrop (bg-background/80), NOT slate-950
      expect(container.innerHTML).not.toMatch(/slate-950/);
      expect(container.firstElementChild?.className).toContain('bg-background/80');

      // Buttons have >= 44x44px touch target (min-h-11)
      const cancelBtn = screen.getByTestId('cancel-leave-seat-btn');
      const confirmBtn = screen.getByTestId('confirm-leave-seat-btn');
      expect(cancelBtn.className).toContain('min-h-11');
      expect(confirmBtn.className).toContain('min-h-11');

      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
