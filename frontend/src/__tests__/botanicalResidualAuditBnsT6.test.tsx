import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  BOTANICAL_2D_SCENE,
  BOTANICAL_PALETTE_HEX,
  BOTANICAL_PALETTE_INT,
  calculateContrastRatio,
} from '../game/botanicalPalette';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { WorkspaceLayoutControls } from '../components/table/WorkspaceLayoutControls';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { BotanicalButton, DoubleBezelCard, BotanicalGlass } from '../components/ui';

describe('BNS-T6 Full Botanical QA Gate & Residual Audit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  describe('WCAG AA / AAA Contrast Verification (ADR-0010)', () => {
    it('validates Botanical Night Studio palette contrast ratios meet WCAG targets', () => {
      // Warm Amber primary CTA requires Deep Pine Night ink (#0F1714) for 8.74:1 (WCAG AAA)
      const amberToInk = calculateContrastRatio(BOTANICAL_PALETTE_HEX.warmAmber, BOTANICAL_PALETTE_HEX.amberInk);
      expect(amberToInk).toBeGreaterThanOrEqual(8.5);

      // White on Warm Amber fails WCAG AA (~2.08:1)
      const amberToWhite = calculateContrastRatio(BOTANICAL_PALETTE_HEX.warmAmber, '#FFFFFF');
      expect(amberToWhite).toBeLessThan(3.0);

      // Morning Mist on Slate Leaf meets AAA (>= 7.0:1)
      const mistToLeaf = calculateContrastRatio(BOTANICAL_PALETTE_HEX.morningMist, BOTANICAL_PALETTE_HEX.slateLeaf);
      expect(mistToLeaf).toBeGreaterThanOrEqual(12.0);

      // Muted Sage on Slate Leaf meets AA (>= 4.5:1)
      const sageToLeaf = calculateContrastRatio(BOTANICAL_PALETTE_HEX.mutedSage, BOTANICAL_PALETTE_HEX.slateLeaf);
      expect(sageToLeaf).toBeGreaterThanOrEqual(5.5);

      // Bioluminescent Emerald on Deep Pine Night meets AAA (>= 7.0:1)
      const emeraldToPine = calculateContrastRatio(BOTANICAL_PALETTE_HEX.bioluminescentEmerald, BOTANICAL_PALETTE_HEX.deepPineNight);
      expect(emeraldToPine).toBeGreaterThanOrEqual(7.5);
    });

    it('verifies synchronized 2D Phaser scene nocturnal tokens match theme', () => {
      expect(BOTANICAL_2D_SCENE.canvasBackground).toBe('#0F1714');
      expect(BOTANICAL_2D_SCENE.canvasBackgroundInt).toBe(0x0f1714);
      expect(BOTANICAL_2D_SCENE.lighting.lampWarm).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.lighting.nightAmbient).toBe(BOTANICAL_PALETTE_INT.deepPineNight);
      expect(BOTANICAL_2D_SCENE.chatBubble.bgInt).toBe(BOTANICAL_PALETTE_INT.slateLeaf);
      expect(BOTANICAL_2D_SCENE.chatBubble.borderInt).toBe(BOTANICAL_PALETTE_INT.luminousBorder);
      expect(BOTANICAL_2D_SCENE.seats.empty).toBe(BOTANICAL_PALETTE_INT.bioluminescentEmerald);
    });
  });

  describe('Rendered React Chrome Zero Residual Classes & Botanical Primitives', () => {
    it('verifies App shell and HUD contain zero legacy slate-* or sky-* classes', () => {
      useAuthStore.setState({
        userId: 'u-qa',
        token: 'token-qa',
        nickname: 'QATester',
        avatarSpriteId: 'avatar_01',
        authProvider: 'GUEST',
        studyGoal: 'Ôn thi Toán',
        studyGoalCompleted: false,
      });

      useGameStore.setState({
        connectionStatus: 'CONNECTED',
        characterState: 'FREE_ROAM',
        currentTableId: null,
      });

      const { container } = render(<App />);

      expect(container.innerHTML).not.toMatch(/\bslate-\d+\b/);
      expect(container.innerHTML).not.toMatch(/\bsky-\d+\b/);
    });

    it('verifies TableWorkspaceShell contains zero legacy slate-* or sky-* classes', () => {
      useAuthStore.setState({ userId: 'u-host', nickname: 'Host' });
      useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_01' });
      useTableStore.setState({
        tableId: 'table_01',
        hostUserId: 'u-host',
        members: [
          {
            userId: 'u-host',
            nickname: 'Host',
            avatarId: 'avatar_01',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now(),
            connected: true,
          },
        ],
      });

      const { container } = render(<TableWorkspaceShell />);

      expect(container.innerHTML).not.toMatch(/\bslate-\d+\b/);
      expect(container.innerHTML).not.toMatch(/\bsky-\d+\b/);
    });

    it('verifies Botanical UI primitives render with double-bezel, glass and CTA tokens', () => {
      const { container: btnContainer } = render(
        <BotanicalButton variant="primary">Xác nhận</BotanicalButton>
      );
      const btn = btnContainer.querySelector('button');
      expect(btn).toBeInTheDocument();
      expect(btn?.className).toContain('bg-primary');
      expect(btn?.className).toContain('text-primary-foreground');

      const { container: cardContainer } = render(
        <DoubleBezelCard outerClassName="p-4" innerClassName="p-2">
          <span>Card Content</span>
        </DoubleBezelCard>
      );
      expect(cardContainer.querySelector('[data-testid="double-bezel-outer"]')).toBeInTheDocument();
      expect(cardContainer.querySelector('[data-testid="double-bezel-inner"]')).toBeInTheDocument();

      const { container: glassContainer } = render(
        <BotanicalGlass>Glass Panel</BotanicalGlass>
      );
      expect(glassContainer.querySelector('[data-testid="botanical-glass"]')).toBeInTheDocument();
    });

    it('verifies WorkspaceLayoutControls active pill uses high-contrast primary ink and zero legacy classes', () => {
      const { container } = render(
        <WorkspaceLayoutControls
          layoutMode="SPLIT_HORIZONTAL"
          onChangeLayout={vi.fn()}
          onSwapPanels={vi.fn()}
        />
      );

      const splitBtn = container.querySelector('[data-testid="layout-mode-split"]');
      expect(splitBtn).toBeInTheDocument();
      expect(splitBtn?.className).toContain('bg-primary');
      expect(splitBtn?.className).toContain('text-primary-foreground');

      expect(container.innerHTML).not.toMatch(/\bslate-\d+\b/);
      expect(container.innerHTML).not.toMatch(/\bsky-\d+\b/);
    });
  });
});
