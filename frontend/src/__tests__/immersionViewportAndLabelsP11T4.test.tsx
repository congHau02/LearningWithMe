import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import {
  buildStaticStudyCafeMapLabels,
  projectWorldPointToOverlay,
  type CameraProjectionState,
} from '../game/labels/studyCafeLabelProjection';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

describe('P11-T4: Immersive Full-Height Study Café Viewport & Crisp Hi-DPI Vietnamese Map Labels (#80)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  describe('Slice 1: World-to-Overlay Coordinate Projection & Static Vietnamese Labels', () => {
    it('projects world coordinates accurately across 1×, 2×, and 3× zoom and camera scroll offsets', () => {
      const worldWidth = 768;
      const worldHeight = 512;

      // At 1× zoom centered (scrollX=0, scrollY=0), center of world (384, 256) maps to (50%, 50%)
      const cam1x: CameraProjectionState = {
        worldWidth,
        worldHeight,
        zoom: 1,
        scrollX: 0,
        scrollY: 0,
      };
      expect(projectWorldPointToOverlay(384, 256, cam1x)).toEqual({
        leftPercent: 50,
        topPercent: 50,
        zoom: 1,
        inBounds: true,
      });

      // Top-left table plaque at (134, 129) at 1× zoom
      const table1At1x = projectWorldPointToOverlay(150, 129, cam1x);
      expect(table1At1x.leftPercent).toBeCloseTo((150 / 768) * 100, 3);
      expect(table1At1x.topPercent).toBeCloseTo((129 / 512) * 100, 3);
      expect(table1At1x.inBounds).toBe(true);

      // At 2× zoom with camera scrolled so character at (192, 160) is centered:
      // Phaser camera scrollX = targetX - worldWidth / 2 = 192 - 384 = -192,
      // scrollY = targetY - worldHeight / 2 = 160 - 256 = -96.
      const cam2x: CameraProjectionState = {
        worldWidth,
        worldHeight,
        zoom: 2,
        scrollX: -192,
        scrollY: -96,
      };
      const centered2x = projectWorldPointToOverlay(192, 160, cam2x);
      expect(centered2x.leftPercent).toBeCloseTo(50, 3);
      expect(centered2x.topPercent).toBeCloseTo(50, 3);
      expect(centered2x.zoom).toBe(2);

      // At 3× zoom with camera scrolled so (528, 432) is centered:
      // scrollX = 528 - 384 = 144, scrollY = 432 - 256 = 176
      const cam3x: CameraProjectionState = {
        worldWidth,
        worldHeight,
        zoom: 3,
        scrollX: 144,
        scrollY: 176,
      };
      const centered3x = projectWorldPointToOverlay(528, 432, cam3x);
      expect(centered3x.leftPercent).toBeCloseTo(50, 3);
      expect(centered3x.topPercent).toBeCloseTo(50, 3);
      expect(centered3x.zoom).toBe(3);

      // A point far outside the 3× zoomed view is flagged out-of-bounds
      const farPoint3x = projectWorldPointToOverlay(64, 64, cam3x);
      expect(farPoint3x.inBounds).toBe(false);
    });

    it('builds crisp static Study Café labels for Bàn 01..03, Chill Lounge, and Quầy Study Café with Vietnamese diacritics', () => {
      const staticLabels = buildStaticStudyCafeMapLabels(MAIN_LIBRARY_TOPOLOGY);
      const tableTexts = staticLabels
        .filter((item) => item.kind === 'table-plaque')
        .map((item) => item.text);

      expect(tableTexts).toEqual(['Bàn 01', 'Bàn 02', 'Bàn 03']);
      expect(staticLabels.some((item) => item.kind === 'zone-sign' && item.text.includes('Quầy Study Café'))).toBe(
        true,
      );
      expect(staticLabels.some((item) => item.kind === 'zone-sign' && item.text.includes('Chill Lounge'))).toBe(
        true,
      );
    });
  });

  describe('Slice 2: Immersive Full-Height Viewport, Floating HUD Clusters & Hi-DPI DOM Map Labels Overlay', () => {
    it('renders full-height Study Café viewport with floating corner HUD controls, WCAG AAA drink CTA, keyboard Esc popover, and crisp DOM Vietnamese labels', () => {
      useAuthStore.setState({
        userId: 'u-self',
        nickname: 'Minh Hậu',
        studyGoal: 'Ôn thi Giải tích & Đại số',
        studyGoalCompleted: true,
      });
      useGameStore.setState({
        roomId: 'main-library',
        characterState: 'SEATED',
        currentTableId: 'table_01',
        currentSeatId: 'T1_S1',
        position: { x: 3, y: 4 },
        selectedDrinkId: 'iced_milk_coffee',
        roomTables: [
          {
            tableId: 'table_01',
            label: 'Bàn 1',
            capacity: 2,
            hostUserId: 'u-self',
            coHostUserIds: [],
            isFreeCollab: false,
            sosBanner: 'Cần người giảng Phương trình vi phân',
            occupiedSeats: 1,
          },
        ],
      });
      useTableStore.setState({
        tableId: 'table_01',
        hostUserId: 'u-self',
        isWorkspaceMinimized: true,
      });

      const { container } = render(<ClassroomCanvas />);

      // 1. Full-height viewport framing & canvas host
      const viewport = screen.getByTestId('classroom-viewport');
      expect(viewport.className).toContain('flex-1');
      const canvasHost = screen.getByTestId('phaser-canvas-host');
      expect(canvasHost.className).toContain('bg-[#0F1714]');
      // No old fixed 430px height cap
      expect(canvasHost.className).not.toContain('430px');

      // 2. Floating HUD clusters exist with Botanical tokens, Studio SVGs, and >= 44px mobile touch targets
      const topLeftHud = screen.getByTestId('floating-hud-top-left');
      const topRightHud = screen.getByTestId('floating-hud-top-right');
      const bottomLeftHud = screen.getByTestId('camera-controls');
      expect(topLeftHud).toBeInTheDocument();
      expect(topRightHud).toBeInTheDocument();
      expect(bottomLeftHud).toBeInTheDocument();

      const drinkBtn = screen.getByTestId('open-drink-menu-btn');
      expect(drinkBtn.className).toContain('bg-primary');
      expect(drinkBtn.className).toContain('text-primary-foreground');
      expect(drinkBtn.className).toContain('min-h-11');

      const zoomInBtn = screen.getByTestId('camera-zoom-in-btn');
      const zoomOutBtn = screen.getByTestId('camera-zoom-out-btn');
      const followBtn = screen.getByTestId('camera-follow-toggle-btn');
      expect(zoomInBtn.className).toContain('min-h-11');
      expect(zoomOutBtn.className).toContain('min-h-11');
      expect(followBtn.className).toContain('min-h-11');

      // Ambience Mood & Graphics Quality controls remain accessible and support Escape when popover is opened
      expect(screen.getByTestId('ambience-mood-control')).toBeInTheDocument();
      expect(screen.getByTestId('graphics-quality-control')).toBeInTheDocument();

      const ambienceTrigger = screen.getByTestId('ambience-mood-popover-trigger');
      expect(ambienceTrigger).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(ambienceTrigger);
      expect(ambienceTrigger).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(ambienceTrigger).toHaveAttribute('aria-expanded', 'false');

      const graphicsTrigger = screen.getByTestId('graphics-quality-popover-trigger');
      expect(graphicsTrigger).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(graphicsTrigger);
      expect(graphicsTrigger).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(graphicsTrigger).toHaveAttribute('aria-expanded', 'false');

      // 3. Crisp DOM-projected Vietnamese map labels overlay
      const labelOverlay = screen.getByTestId('study-cafe-dom-labels-overlay');
      expect(labelOverlay).toBeInTheDocument();
      expect(labelOverlay.className).toContain('pointer-events-none');

      // Table plaques Bàn 01..03 rendered as crisp DOM nodes
      expect(screen.getByTestId('map-label-table-table_01')).toHaveTextContent('Bàn 01');
      expect(screen.getByTestId('map-label-table-table_02')).toHaveTextContent('Bàn 02');
      expect(screen.getByTestId('map-label-table-table_03')).toHaveTextContent('Bàn 03');

      // Self learner nickname with Table Host crown, drink icon, seated status, and Study Goal diacritics
      const selfLabel = screen.getByTestId('map-label-self-player');
      expect(selfLabel).toHaveTextContent('👑');
      expect(selfLabel).toHaveTextContent('Minh Hậu');
      expect(selfLabel).toHaveTextContent('Đang học');
      expect(selfLabel).toHaveTextContent('Ôn thi Giải tích & Đại số');

      // Active SOS Banner rendered in crisp DOM overlay (truncated to 26 chars with ellipsis matching TableSosOverlay)
      const sosLabel = screen.getByTestId('map-label-sos-table_01');
      expect(sosLabel).toHaveTextContent('🆘 Cần người giảng Phương tr…');

      // Ambient NPC names rendered in crisp DOM overlay
      expect(screen.getByTestId('map-label-npc-npc_barista')).toHaveTextContent('Barista Minh');
      expect(screen.getByTestId('map-label-npc-npc_cashier')).toHaveTextContent('Thu ngân Linh');
      expect(screen.getByTestId('map-label-npc-npc_server')).toHaveTextContent('Phục vụ An');

      // 4. Zooming to 2× and 3× updates projected coordinates while keeping DOM text unscaled/razor-sharp
      fireEvent.click(zoomInBtn);
      expect(useGameStore.getState().cameraZoom).toBe(2);
      expect(labelOverlay).toHaveAttribute('data-camera-zoom', '2');

      fireEvent.click(zoomInBtn);
      expect(useGameStore.getState().cameraZoom).toBe(3);
      expect(labelOverlay).toHaveAttribute('data-camera-zoom', '3');

      // 5. Expanding Table Workspace hides/pauses the DOM label overlay automatically
      act(() => {
        useTableStore.getState().setWorkspaceMinimized(false);
      });
      expect(labelOverlay).toHaveAttribute('data-workspace-covered', 'true');
      expect(labelOverlay).toHaveAttribute('hidden');

      // Zero raw legacy Tailwind slate-* or sky-* classes
      expect(container.innerHTML).not.toMatch(/\b(slate|sky)-\d+\b/);
    });

    it('synchronizes live Chat Bubbles, remote learner labels, NPC bubbles, and camera scroll transforms from Phaser scene frames', () => {
      useAuthStore.setState({
        userId: 'u-self',
        nickname: 'Hoàng',
      });
      useGameStore.setState({
        characterState: 'FREE_ROAM',
        currentTableId: null,
        cameraZoom: 2,
      });

      render(<ClassroomCanvas />);

      act(() => {
        useStudyCafeDisplayStore.getState().setLiveSceneLabelFrame({
          camera: {
            worldWidth: 768,
            worldHeight: 512,
            zoom: 2,
            scrollX: -96,
            scrollY: -64,
          },
          self: {
            worldX: 288,
            worldY: 192,
            bubbleText: 'Chào cả phòng, cùng cố gắng nhé! 🔥',
            bubbleMotion: { scale: 1, alpha: 1, offsetY: 0 },
          },
          remotePlayers: [
            {
              userId: 'u-peer-1',
              labelText: '👑 Thảo Nguyên • Đang học',
              isHost: true,
              worldX: 320,
              worldY: 192,
              alpha: 1,
              bubbleText: 'Bàn 02 đang giải tích phân chữ ữ ợ!',
              bubbleMotion: { scale: 1, alpha: 1, offsetY: 0 },
            },
          ],
          npcs: [
            {
              npcId: 'npc_barista',
              displayName: 'Barista Minh',
              isCounterStaff: true,
              worldX: 350,
              worldY: 220,
              bubbleText: 'Cà phê sữa đá thơm nức ☕',
              bubbleMotion: { scale: 1, alpha: 1, offsetY: 0 },
            },
          ],
          sosBanners: [
            {
              tableId: 'table_02',
              text: '🆘 Giải hệ phương trình',
              worldX: 320,
              worldY: 140,
              alpha: 1,
              scale: 1,
            },
          ],
        });
      });

      // Self bubble & centered projection at (288, 192) with scroll (-96, -64) at 2× zoom => 50% left
      const selfBubble = screen.getByTestId('map-label-bubble-self');
      expect(selfBubble).toHaveTextContent('Chào cả phòng, cùng cố gắng nhé! 🔥');
      expect(selfBubble.style.left).toBe('50%');

      const peerLabel = screen.getByTestId('map-label-remote-u-peer-1');
      expect(peerLabel).toHaveTextContent('👑 Thảo Nguyên • Đang học');

      const peerBubble = screen.getByTestId('map-label-bubble-u-peer-1');
      expect(peerBubble).toHaveTextContent('Bàn 02 đang giải tích phân chữ ữ ợ!');

      const npcBubble = screen.getByTestId('map-label-bubble-npc_barista');
      expect(npcBubble).toHaveTextContent('Cà phê sữa đá thơm nức ☕');

      const sos2 = screen.getByTestId('map-label-sos-table_02');
      expect(sos2).toHaveTextContent('🆘 Giải hệ phương trình');
    });
  });
});
