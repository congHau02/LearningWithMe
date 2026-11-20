import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Tilemaps: { Formats: { TILED_JSON: 1 } },
  },
}));

import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { SeatSpriteLayer } from '../game/atlas/seatSpriteLayer';
import { STUDY_CAFE_ENV_ATLAS_KEY } from '../game/atlas/studyCafeEnvManifest';
import {
  BOTANICAL_2D_SCENE,
  BOTANICAL_PALETTE_HEX,
  BOTANICAL_PALETTE_INT,
} from '../game/botanicalPalette';
import { renderStudyCafeDecor } from '../game/cafe/studyCafeDecorRenderer';
import { ChatBubble } from '../game/entities/ChatBubble';
import { TableSosOverlay } from '../game/entities/TableSosOverlay';
import { drawDynamicOverlay } from '../game/scenes/classroomMapRenderer';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import type { RoomTableSummary } from '../services/roomApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('BNS-T4: Phaser 2D Study Café Night Lighting, Overlays & Classroom Viewport Frame (#61)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  describe('Classroom Viewport Double-Bezel Framing & Studio Controls', () => {
    it('renders ClassroomCanvas inside Double-Bezel Slate Leaf (#16221E / #243630) framing', () => {
      render(<ClassroomCanvas />);

      const viewport = screen.getByTestId('classroom-viewport');
      expect(viewport).toBeInTheDocument();
      expect(viewport.getAttribute('data-slot')).toBe('double-bezel-outer');
      expect(viewport.className).toContain('border-border/90');
      expect(viewport.className).toContain('rounded-2xl');

      const inner = screen.getByTestId('double-bezel-inner');
      expect(inner).toBeInTheDocument();
      expect(inner.getAttribute('data-slot')).toBe('double-bezel-inner');
      expect(inner.className).toContain('bg-card');
      expect(inner.className).toContain('border-border');

      // Phaser canvas host has background #0F1714 (Deep Pine Night)
      const canvasHost = screen.getByTestId('phaser-canvas-host');
      expect(canvasHost).toBeInTheDocument();
      expect(canvasHost.className).toContain('bg-[#0F1714]');
    });

    it('renders Warm Amber (#E5A93C) drink menu trigger with dark ink (#0F1714) and CoffeeIcon', () => {
      render(<ClassroomCanvas />);

      const drinkBtn = screen.getByTestId('open-drink-menu-btn');
      expect(drinkBtn).toBeInTheDocument();
      expect(drinkBtn.className).toContain('bg-primary');
      expect(drinkBtn.className).toContain('text-primary-foreground');
      expect(drinkBtn).toHaveTextContent('Quầy đồ uống');

      // Contains inline SVG CoffeeIcon
      const svg = drinkBtn.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders camera zoom and follow controls with Studio SVG icons and emerald active styling', () => {
      render(<ClassroomCanvas />);

      const zoomOutBtn = screen.getByTestId('camera-zoom-out-btn');
      const zoomInBtn = screen.getByTestId('camera-zoom-in-btn');
      const zoomReadout = screen.getByTestId('camera-zoom-readout');
      const followBtn = screen.getByTestId('camera-follow-toggle-btn');

      expect(zoomOutBtn).toBeInTheDocument();
      expect(zoomInBtn).toBeInTheDocument();
      expect(zoomReadout).toBeInTheDocument();
      expect(followBtn).toBeInTheDocument();

      // Camera control icons are 1.5px stroke Studio SVG icons
      const zoomOutSvg = zoomOutBtn.querySelector('svg');
      const zoomInSvg = zoomInBtn.querySelector('svg');
      const followSvg = followBtn.querySelector('svg');

      expect(zoomOutSvg).toBeInTheDocument();
      expect(zoomInSvg).toBeInTheDocument();
      expect(followSvg).toBeInTheDocument();

      // Verify zoom interactions
      const initialZoom = useGameStore.getState().cameraZoom;
      fireEvent.click(zoomInBtn);
      expect(useGameStore.getState().cameraZoom).toBeGreaterThan(initialZoom);

      fireEvent.click(zoomOutBtn);
      expect(useGameStore.getState().cameraZoom).toBe(initialZoom);

      // Verify follow toggle and emerald styling (#34D399)
      expect(followBtn).toHaveAttribute('aria-pressed', 'true');
      expect(followBtn.className).toContain('text-emerald-300');
      expect(followBtn.className).toContain('bg-emerald-500/20');

      fireEvent.click(followBtn);
      expect(useGameStore.getState().cameraFollowEnabled).toBe(false);
      expect(followBtn).toHaveAttribute('aria-pressed', 'false');
      expect(followBtn.className).toContain('text-muted-foreground');
    });
  });

  describe('Botanical Night Phaser 2D Scene Tokens Seam (ADR-0010)', () => {
    it('synchronizes all runtime colors with Botanical Night Studio palette', () => {
      // Canvas background
      expect(BOTANICAL_2D_SCENE.canvasBackground).toBe(BOTANICAL_PALETTE_HEX.deepPineNight);
      expect(BOTANICAL_2D_SCENE.canvasBackgroundInt).toBe(BOTANICAL_PALETTE_INT.deepPineNight);

      // Windows twilight tint & border
      expect(BOTANICAL_2D_SCENE.windows.paneFill).toBe(BOTANICAL_PALETTE_INT.slateLeaf);
      expect(BOTANICAL_2D_SCENE.windows.frame).toBe(BOTANICAL_PALETTE_INT.luminousBorder);
      expect(BOTANICAL_2D_SCENE.windows.twilightBeam).toBe(BOTANICAL_PALETTE_INT.slateLeaf);

      // Desk lamps and counter amber glow
      expect(BOTANICAL_2D_SCENE.lighting.lampWarm).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.lighting.counterGlow).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.counter.glowFill).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.counter.menuBoardBg).toBe(BOTANICAL_PALETTE_INT.slateLeaf);
      expect(BOTANICAL_2D_SCENE.counter.menuBoardBorder).toBe(BOTANICAL_PALETTE_INT.luminousBorder);

      // Empty seat / path highlights in Bioluminescent Emerald
      expect(BOTANICAL_2D_SCENE.seats.empty).toBe(BOTANICAL_PALETTE_INT.bioluminescentEmerald);
      expect(BOTANICAL_2D_SCENE.seats.current).toBe(BOTANICAL_PALETTE_INT.bioluminescentEmerald);
      expect(BOTANICAL_2D_SCENE.seats.hover).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.pathfinder.markerInt).toBe(BOTANICAL_PALETTE_INT.bioluminescentEmerald);

      // Chat bubble in Slate Leaf with luminous border
      expect(BOTANICAL_2D_SCENE.chatBubble.bgInt).toBe(BOTANICAL_PALETTE_INT.slateLeaf);
      expect(BOTANICAL_2D_SCENE.chatBubble.borderInt).toBe(BOTANICAL_PALETTE_INT.luminousBorder);
      expect(BOTANICAL_2D_SCENE.chatBubble.textColor).toBe(BOTANICAL_PALETTE_HEX.morningMist);

      // Table SOS banner in Slate Leaf with luminous border and Warm Amber pulse
      expect(BOTANICAL_2D_SCENE.tableSos.bgInt).toBe(BOTANICAL_PALETTE_INT.slateLeaf);
      expect(BOTANICAL_2D_SCENE.tableSos.borderInt).toBe(BOTANICAL_PALETTE_INT.luminousBorder);
      expect(BOTANICAL_2D_SCENE.tableSos.pulseFill).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.tableSos.pulseStroke).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(BOTANICAL_2D_SCENE.tableSos.textColor).toBe(BOTANICAL_PALETTE_HEX.morningMist);

      // Table labels
      expect(BOTANICAL_2D_SCENE.tableLabels.textColor).toBe(BOTANICAL_PALETTE_HEX.morningMist);
      expect(BOTANICAL_2D_SCENE.tableLabels.backgroundColor).toBe('#16221Ecc');
    });
  });

  describe('Phaser 2D Runtime Visual Objects Integration', () => {
    it('tracks ChatBubble 4-second lifecycle and pop motion state for DOM projection without hidden Phaser text objects', () => {
      const addText = vi.fn();
      const mockScene = {
        add: {
          text: addText,
        },
      } as unknown as Phaser.Scene;

      const bubble = new ChatBubble({ scene: mockScene });
      bubble.show('Đang học nhóm!', 1000);
      bubble.update(1300, 100, 100, false);

      expect(bubble.isActive()).toBe(true);
      expect(bubble.getText()).toBe('Đang học nhóm!');
      expect(bubble.getVisualState()).toEqual({ scale: 1, alpha: 1, offsetY: 0 });
      expect(addText).not.toHaveBeenCalled();
    });

    it('tracks TableSosOverlay active entries and Botanical motion state without hidden Phaser graphics/text shells', () => {
      const addGraphics = vi.fn();
      const addText = vi.fn();
      const mockScene = {
        add: {
          graphics: addGraphics,
          text: addText,
        },
      } as unknown as Phaser.Scene;

      const overlay = new TableSosOverlay(mockScene, MAIN_LIBRARY_TOPOLOGY);
      overlay.update(
        [
          {
            tableId: 'table_01',
            label: 'Bàn 1',
            capacity: 4,
            hostUserId: 'user_host',
            coHostUserIds: [],
            hasSosBanner: true,
            sosBanner: 'Cần giải bài tập Toán',
            isFreeCollab: false,
            occupiedSeats: 2,
          } as unknown as RoomTableSummary,
        ],
        500,
      );

      expect(overlay.getActiveSosTableIds()).toEqual(['table_01']);
      expect(overlay.getLabelEntries()[0]).toMatchObject({
        tableId: 'table_01',
        text: '🆘 Cần giải bài tập Toán',
      });
      expect(addGraphics).not.toHaveBeenCalled();
      expect(addText).not.toHaveBeenCalled();
    });

    it('renders drawDynamicOverlay seats and pathfinder using Bioluminescent Emerald', () => {
      const fillStyleSpy = vi.fn();

      const mockGraphics = {
        clear: vi.fn(),
        fillStyle: fillStyleSpy,
        fillCircle: vi.fn(),
      } as unknown as Phaser.GameObjects.Graphics;

      const mockScene = {
        add: {
          image: vi.fn(() => {
            const img = {
              setDepth: vi.fn().mockReturnThis(),
              setFrame: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
            return img;
          }),
        },
      } as unknown as Phaser.Scene;

      const twoSeatTopology = {
        ...MAIN_LIBRARY_TOPOLOGY,
        seats: [
          { seatId: 'seat_01', tableId: 'table_01', tileX: 3, tileY: 4, facingDir: 'DOWN' as const },
          { seatId: 'seat_02', tableId: 'table_01', tileX: 6, tileY: 4, facingDir: 'DOWN' as const },
        ],
      };
      const seatLayer = new SeatSpriteLayer(mockScene, twoSeatTopology);
      seatLayer.sync({
        occupiedSeats: { seat_02: 'user_bob' },
        activeSeatId: 'seat_01',
        hoveredSeatId: null,
      });

      drawDynamicOverlay(mockGraphics, {
        tileSize: 32,
        pathQueue: [{ tileX: 4, tileY: 5 }],
      });

      // Active & occupied seats render through 2-layer Botanical atlas sprites
      const byId = new Map(seatLayer.getSeatRenderSnapshots().map((s) => [s.seatId, s]));
      expect(byId.get('seat_01')?.baseFrame).toBe('seat_base_down_current');
      expect(byId.get('seat_02')?.baseFrame).toBe('seat_base_down_occupied');

      // Pathfinder step marker uses Bioluminescent Emerald (0x34d399)
      expect(fillStyleSpy).toHaveBeenCalledWith(
        BOTANICAL_2D_SCENE.pathfinder.markerInt,
        expect.any(Number),
      );
      seatLayer.destroy();
    });

    it('renders renderStudyCafeDecor with framed north windows, Chill Lounge cushions, and Barista counter atlas sprites', () => {
      const createdSprites: Array<{ texture: string; frame: string }> = [];

      const mockScene = {
        add: {
          image: vi.fn((_x: number, _y: number, texture: string, frame: string) => {
            createdSprites.push({ texture, frame });
            return {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
          }),
          text: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const handle = renderStudyCafeDecor(mockScene, MAIN_LIBRARY_TOPOLOGY);
      const frames = new Set(createdSprites.map((s) => s.frame));

      expect(createdSprites.every((s) => s.texture === STUDY_CAFE_ENV_ATLAS_KEY)).toBe(true);
      expect(frames.has('window_north_frame')).toBe(true);
      expect(frames.has('wall_clock_0')).toBe(true);
      expect(frames.has('cushion_amber')).toBe(true);
      expect(frames.has('cushion_emerald')).toBe(true);
      expect(frames.has('counter_left')).toBe(true);
      expect(frames.has('counter_espresso_0')).toBe(true);
      expect(frames.has('chalkboard_menu')).toBe(true);
      handle.destroy();
    });
  });
});
