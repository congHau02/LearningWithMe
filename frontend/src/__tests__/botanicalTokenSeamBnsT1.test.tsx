import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BOTANICAL_2D_SCENE,
  BOTANICAL_PALETTE_HEX,
  BOTANICAL_PALETTE_INT,
  calculateContrastRatio,
  hexToInt,
} from '../game/botanicalPalette';
import {
  AlertCircleIcon, BoardIcon, BotanicalButton, BotanicalGlass, CheckIcon,
  ClockIcon, CoffeeIcon, CrownIcon, DoorIcon, DoubleBezelCard, FlameIcon,
  GoalIcon, HeadphonesIcon, MicIcon, MicOffIcon, PlayIcon, RainIcon,
  TimerIcon, TrophyIcon, UserIcon, VideoIcon, VolumeIcon, XIcon,
} from '../components';

describe('BNS-T1: Botanical Night Studio Token Seam & Primitives', () => {
  describe('Botanical Palette & Contrast Math (ADR-0010)', () => {
    it('mirrors exact Botanical Night Studio hex and integer values', () => {
      expect(BOTANICAL_PALETTE_HEX.deepPineNight).toBe('#0F1714');
      expect(BOTANICAL_PALETTE_HEX.slateLeaf).toBe('#16221E');
      expect(BOTANICAL_PALETTE_HEX.luminousBorder).toBe('#243630');
      expect(BOTANICAL_PALETTE_HEX.morningMist).toBe('#E6ECE8');
      expect(BOTANICAL_PALETTE_HEX.mutedSage).toBe('#8FA399');
      expect(BOTANICAL_PALETTE_HEX.warmAmber).toBe('#E5A93C');
      expect(BOTANICAL_PALETTE_HEX.amberInk).toBe('#0F1714');
      expect(BOTANICAL_PALETTE_HEX.bioluminescentEmerald).toBe('#34D399');

      expect(BOTANICAL_PALETTE_INT.deepPineNight).toBe(0x0f1714);
      expect(BOTANICAL_PALETTE_INT.slateLeaf).toBe(0x16221e);
      expect(BOTANICAL_PALETTE_INT.luminousBorder).toBe(0x243630);
      expect(BOTANICAL_PALETTE_INT.morningMist).toBe(0xe6ece8);
      expect(BOTANICAL_PALETTE_INT.mutedSage).toBe(0x8fa399);
      expect(BOTANICAL_PALETTE_INT.warmAmber).toBe(0xe5a93c);
      expect(BOTANICAL_PALETTE_INT.amberInk).toBe(0x0f1714);
      expect(BOTANICAL_PALETTE_INT.bioluminescentEmerald).toBe(0x34d399);

      expect(hexToInt('#0F1714')).toBe(0x0f1714);
      expect(hexToInt('#34D399')).toBe(0x34d399);
    });

    it('exports synchronized Phaser 2D scene tokens', () => {
      expect(BOTANICAL_2D_SCENE.canvasBackground).toBe('#0F1714');
      expect(BOTANICAL_2D_SCENE.chatBubble.bgInt).toBe(0x16221e);
      expect(BOTANICAL_2D_SCENE.chatBubble.borderInt).toBe(0x243630);
      expect(BOTANICAL_2D_SCENE.chatBubble.textColor).toBe('#E6ECE8');
      expect(BOTANICAL_2D_SCENE.tableSos.pulseFill).toBe(0xe5a93c);
      expect(BOTANICAL_2D_SCENE.seats.empty).toBe(0x34d399);
      expect(BOTANICAL_2D_SCENE.lighting.lampWarm).toBe(0xe5a93c);
      expect(BOTANICAL_2D_SCENE.lighting.nightAmbient).toBe(0x0f1714);
    });

    it('enforces WCAG AA/AAA contrast ratios: Warm Amber requires Deep Pine ink', () => {
      const amberToDarkInk = calculateContrastRatio(BOTANICAL_PALETTE_HEX.warmAmber, BOTANICAL_PALETTE_HEX.amberInk);
      expect(amberToDarkInk).toBeGreaterThanOrEqual(8.5); // 8.74:1 (WCAG AAA)

      const amberToWhite = calculateContrastRatio(BOTANICAL_PALETTE_HEX.warmAmber, '#FFFFFF');
      expect(amberToWhite).toBeLessThan(2.5); // ~2.08:1 (fails WCAG AA 4.5:1)

      const mistToLeaf = calculateContrastRatio(BOTANICAL_PALETTE_HEX.morningMist, BOTANICAL_PALETTE_HEX.slateLeaf);
      expect(mistToLeaf).toBeGreaterThanOrEqual(9.0); // WCAG AAA

      const sageToLeaf = calculateContrastRatio(BOTANICAL_PALETTE_HEX.mutedSage, BOTANICAL_PALETTE_HEX.slateLeaf);
      expect(sageToLeaf).toBeGreaterThanOrEqual(4.5); // WCAG AA
    });
  });

  describe('Studio Icon Kit (1.5px-stroke inline SVG)', () => {
    it('renders with 1.5px stroke and aria-hidden="true" by default', () => {
      const { container } = render(<MicIcon data-testid="mic-icon" />);
      const svg = screen.getByTestId('mic-icon');
      expect(svg).toHaveAttribute('stroke-width', '1.5');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('supports custom size, strokeWidth, and accessible aria-label', () => {
      render(<MicOffIcon data-testid="mic-off-icon" size={28} strokeWidth={2} aria-label="Đã tắt micrô" />);
      const svg = screen.getByTestId('mic-off-icon');
      expect(svg).toHaveAttribute('width', '28');
      expect(svg).toHaveAttribute('height', '28');
      expect(svg).toHaveAttribute('stroke-width', '2');
      expect(svg).toHaveAttribute('aria-label', 'Đã tắt micrô');
      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).not.toHaveAttribute('aria-hidden');
    });

    it('renders HUD, Workspace, Media, Timer and Soundscape icons', () => {
      const { container } = render(
        <div>
          <TrophyIcon /><FlameIcon /><ClockIcon /><GoalIcon /><CoffeeIcon /><UserIcon />
          <DoorIcon /><VideoIcon /><BoardIcon /><CrownIcon /><VolumeIcon /><PlayIcon />
          <TimerIcon /><RainIcon /><XIcon /><CheckIcon /><AlertCircleIcon /><HeadphonesIcon />
        </div>,
      );
      expect(container.querySelectorAll('svg')).toHaveLength(18);
    });
  });

  describe('Glassmorphism & Double-Bezel React Primitives', () => {
    it('renders DoubleBezelCard with outer shell and inner core', () => {
      render(
        <DoubleBezelCard className="max-w-md">
          <p>Inner Core Content</p>
        </DoubleBezelCard>,
      );
      const outer = screen.getByTestId('double-bezel-outer');
      const inner = screen.getByTestId('double-bezel-inner');
      expect(outer).toBeInTheDocument();
      expect(inner).toBeInTheDocument();
      expect(inner).toHaveTextContent('Inner Core Content');
      expect(outer.className).toContain('border');
      expect(inner.className).toContain('bg-card');
    });

    it('renders BotanicalGlass container for static overlay surfaces', () => {
      render(
        <BotanicalGlass className="p-4">
          <span>Glass Surface</span>
        </BotanicalGlass>,
      );
      const glass = screen.getByTestId('botanical-glass');
      expect(glass).toBeInTheDocument();
      expect(glass).toHaveTextContent('Glass Surface');
      expect(glass.className).toContain('backdrop-blur-md');
    });

    it('renders BotanicalButton with high-contrast ink rule on primary CTA', () => {
      const handleClick = vi.fn();
      render(
        <BotanicalButton
          variant="primary"
          onClick={handleClick}
          trailingIcon={<CheckIcon data-testid="trailing-check" />}
        >
          Tham gia ngay
        </BotanicalButton>,
      );
      const btn = screen.getByRole('button', { name: /tham gia ngay/i });
      expect(btn).toBeInTheDocument();
      expect(btn.className).toContain('bg-primary');
      expect(btn.className).toContain('text-primary-foreground');
      expect(screen.getByTestId('trailing-check')).toBeInTheDocument();

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
