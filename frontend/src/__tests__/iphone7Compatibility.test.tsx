import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { KeyboardHoldTracker } from '../game/controllers/keyboardMapping';
import type { InputController } from '../game/controllers/InputController';
import {
  createClassroomGameConfig,
  wireClassroomPhaserLifecycle,
} from '../game/graphics/bootClassroomGame';
import {
  detectConstrainedGraphicsDevice,
  resolveGraphicsPolicy,
} from '../game/graphics/graphicsQualityPolicy';
import { buildProjectedLabelStyle } from '../game/labels/projectedLabelStyle';
import { handleClassroomPointerDown } from '../game/scenes/classroomPointerHandler';
import { subscribeSceneChatBubbles } from '../game/scenes/classroomSceneBindings';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { computeFittedStageSize } from '../hooks/useFittedStageSize';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

describe('iPhone 7 (iOS <= 15.8 / Safari <= 15.6) Black Map Compatibility Fixes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slice 1: Safari <= 15.6 3:2 Fitted Stage & Pixel-Projected DOM Labels (No cqw/cqh)', () => {
    it('computes exact 3:2 fitted stage dimensions across portrait iPhone 7, landscape, desktop, and invalid bounds', () => {
      // Portrait iPhone 7 (375x667 viewport -> ~359x480 inner canvas area)
      expect(computeFittedStageSize(359, 480)).toEqual({ width: 359, height: 239 });
      // Landscape iPhone 7 (667x375 viewport -> ~640x240 inner canvas area)
      expect(computeFittedStageSize(640, 240)).toEqual({ width: 360, height: 240 });
      // Desktop 1280x720 inner canvas area
      expect(computeFittedStageSize(1200, 640)).toEqual({ width: 960, height: 640 });
      // Invalid / unmeasured bounds return null
      expect(computeFittedStageSize(0, 480)).toBeNull();
      expect(computeFittedStageSize(360, 0)).toBeNull();
      expect(computeFittedStageSize(-10, 200)).toBeNull();
    });

    it('builds GPU-composited pixel translate3d label styles when stageSize is known and % fallback before measurement without cqw/cqh', () => {
      const pixelStyle = buildProjectedLabelStyle({
        leftPercent: 50,
        topPercent: 25,
        anchorY: '-100%',
        scale: 1,
        alpha: 0.9,
        stageSize: { width: 360, height: 240 },
      });
      expect(pixelStyle.left).toBe(0);
      expect(pixelStyle.top).toBe(0);
      expect(pixelStyle.transform).toBe('translate3d(180px, 60px, 0) translate(var(--label-anchor-x, -50%), -100%)');
      expect(pixelStyle.transform).not.toContain('cqw');
      expect(pixelStyle.transform).not.toContain('cqh');
      expect(pixelStyle.opacity).toBe(0.9);

      const fallbackStyle = buildProjectedLabelStyle({
        leftPercent: 50,
        topPercent: 25,
        anchorY: '-50%',
        scale: 1.125,
        alpha: 1,
        stageSize: null,
      });
      expect(fallbackStyle.left).toBe('50%');
      expect(fallbackStyle.top).toBe('25%');
      expect(fallbackStyle.transform).toBe(
        'translate3d(0, 0, 0) translate(var(--label-anchor-x, -50%), -50%) scale(1.125)',
      );
      expect(fallbackStyle.transform).not.toContain('cqw');
      expect(fallbackStyle.transform).not.toContain('cqh');
    });

    it('renders ClassroomCanvas fitted stage and DOM labels without container-query CSS and sizes stage explicitly on iPhone 7 viewport', () => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(359);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);

      useAuthStore.setState({ userId: 'u-iphone7', nickname: 'Hậu iPhone 7' });
      render(<ClassroomCanvas />);

      const stage = screen.getByTestId('study-cafe-fitted-stage');
      expect(stage.className).not.toContain('cqw');
      expect(stage.className).not.toContain('cqh');
      expect(stage.parentElement?.className).not.toContain('container-type');
      expect(stage.style.width).toBe('359px');
      expect(stage.style.height).toBe('239px');

      const overlay = screen.getByTestId('study-cafe-dom-labels-overlay');
      expect(overlay.className).not.toContain('container-type');

      const selfLabel = screen.getByTestId('map-label-self-player');
      expect(selfLabel.style.left).toBe('0px');
      expect(selfLabel.style.top).toBe('0px');
      expect(selfLabel.style.transform).toContain('translate3d(');
      expect(selfLabel.style.transform).toContain('px,');
      expect(selfLabel.style.transform).not.toContain('cqw');
      expect(selfLabel.style.transform).not.toContain('cqh');
      expect(selfLabel.className).toContain('max-sm:max-w-[92%]');
      expect(selfLabel.className).not.toContain('cqw');
    });
  });

  describe('Slice 2: iOS < 15.4 Compatibility (No Array.prototype.at & 100vh/100dvh Fallback)', () => {
    it('runs chat bubble sync, keyboard hold tracking, and walkable tile click without Array.prototype.at (Safari < 15.4)', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'at');
      // Simulate WebKit on iPhone 7 running iOS 14.x / 15.0-15.3 where Array.prototype.at is undefined
      Reflect.deleteProperty(Array.prototype, 'at');
      try {
        useAuthStore.setState({ userId: 'u-ios15', nickname: 'Hậu iOS 15' });
        useGameStore.setState({
          recentMessages: [
            {
              id: 'm-1',
              userId: 'u-ios15',
              nickname: 'Hậu iOS 15',
              avatarId: 'default_student',
              content: 'Tin nhắn cũ',
              createdAtEpoch: Date.now() - 10_000,
            },
          ],
        });

        const showSelfBubble = vi.fn();
        const unsubscribe = subscribeSceneChatBubbles(
          { show: showSelfBubble } as unknown as Parameters<typeof subscribeSceneChatBubbles>[0],
          undefined,
        );

        useGameStore.setState((prev) => ({
          recentMessages: [
            ...prev.recentMessages,
            {
              id: 'm-2',
              userId: 'u-ios15',
              nickname: 'Hậu iOS 15',
              avatarId: 'default_student',
              content: 'Xin chào từ iPhone 7!',
              createdAtEpoch: Date.now(),
            },
          ],
        }));
        expect(showSelfBubble).toHaveBeenCalledWith('Xin chào từ iPhone 7!', expect.any(Number));
        unsubscribe();

        const holdTracker = new KeyboardHoldTracker();
        holdTracker.press('RIGHT', false);
        expect(holdTracker.consumeSteps(200, 140)).toEqual({ active: true, steps: ['RIGHT'] });

        const onWalkableTileClick = vi.fn();
        const fakeInputController = {
          handleTileClick: vi.fn(() => ({
            moved: true,
            path: [
              { tileX: 8, tileY: 8 },
              { tileX: 9, tileY: 8 },
            ],
          })),
        } as unknown as InputController;

        const moved = handleClassroomPointerDown({
          worldX: 9 * MAIN_LIBRARY_TOPOLOGY.tileSize + 16,
          worldY: 8 * MAIN_LIBRARY_TOPOLOGY.tileSize + 16,
          topology: MAIN_LIBRARY_TOPOLOGY,
          inputController: fakeInputController,
          onWalkableTileClick,
        });
        expect(moved).toBe(true);
        expect(onWalkableTileClick).toHaveBeenCalledWith({ tileX: 9, tileY: 8 });
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(Array.prototype, 'at', originalDescriptor);
        }
      }
    });

    it('declares unlayered 100vh fallback before @supports 100dvh in index.css, uses h-app-screen in App.tsx, and targets safari14 in vite.config.ts', async () => {
      const fsMod = 'fs';
      const fs = (await import(/* @vite-ignore */ fsMod)) as {
        readFileSync: (p: string, enc: string) => string;
      };
      const css = fs.readFileSync('src/index.css', 'utf8');
      const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
      const viteCfg = fs.readFileSync('vite.config.ts', 'utf8');

      const appScreenIdx = css.indexOf('.h-app-screen {');
      const utilitiesLayerIdx = css.indexOf('@layer utilities {');
      expect(appScreenIdx).toBeGreaterThan(-1);
      expect(appScreenIdx).toBeLessThan(utilitiesLayerIdx);
      expect(css).toContain('height: 100vh;');
      expect(css).toContain('@supports (height: 100dvh)');
      expect(appSrc).toContain('h-app-screen');
      expect(viteCfg).toContain("'safari14'");
    });
  });

  describe('Slice 3: WebGL VRAM Savings (disablePreFX), Constrained Device Auto-Low Policy & READY Scale Sync', () => {
    it('disables unused Phaser 3.90 PreFX FBO pool in createClassroomGameConfig', () => {
      const parentEl = document.createElement('div');
      const config = createClassroomGameConfig({
        phaserModule: {
          AUTO: 0,
          Scale: { FIT: 3, NO_CENTER: 0 },
        },
        parent: parentEl,
        scene: { key: 'ClassroomScene' },
        topology: MAIN_LIBRARY_TOPOLOGY,
      });

      expect(config.disablePreFX).toBe(true);
    });

    it('detects legacy iOS <= 15 (iPhone 7), Safari <= 15 Desktop-Mode touch, and low-memory devices and defaults auto WebGL quality to low without blocking manual override', () => {
      const iphone7Ios158Ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1';
      const iphoneIos14Ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';
      const safari15DesktopModeUa =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Safari/605.1.15';
      const iphoneIos17Ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
      const desktopChromeUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

      expect(detectConstrainedGraphicsDevice({ userAgent: iphone7Ios158Ua })).toBe(true);
      expect(detectConstrainedGraphicsDevice({ userAgent: iphoneIos14Ua })).toBe(true);
      expect(
        detectConstrainedGraphicsDevice({ userAgent: safari15DesktopModeUa, maxTouchPoints: 5 }),
      ).toBe(true);
      expect(
        detectConstrainedGraphicsDevice({ userAgent: safari15DesktopModeUa, maxTouchPoints: 0 }),
      ).toBe(false);
      expect(detectConstrainedGraphicsDevice({ userAgent: desktopChromeUa, deviceMemory: 2 })).toBe(true);
      expect(detectConstrainedGraphicsDevice({ userAgent: iphoneIos17Ua })).toBe(false);
      expect(detectConstrainedGraphicsDevice({ userAgent: desktopChromeUa, deviceMemory: 8 })).toBe(false);

      const autoConstrained = resolveGraphicsPolicy({
        requestedQuality: null,
        rendererKind: 'webgl',
        prefersReducedMotion: false,
        preferLightweightDefault: true,
      });
      expect(autoConstrained).toMatchObject({
        effectiveQuality: 'low',
        isWebGl: true,
        allowWebGlFx: false,
        allowPostFx: false,
        allowPointLights: false,
        allowParticles: true,
        particleDensityScale: 0.25,
      });

      const manualOverride = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
        preferLightweightDefault: true,
      });
      expect(manualOverride.effectiveQuality).toBe('high');
      expect(manualOverride.allowPostFx).toBe(true);

      // Verify store integration honors iPhone 7 UA when renderer switches to WebGL
      vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(iphone7Ios158Ua);
      useStudyCafeDisplayStore.getState().setPrefersReducedMotion(false);
      useStudyCafeDisplayStore.getState().setRendererKind('webgl');
      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('low');
      expect(useStudyCafeDisplayStore.getState().graphicsPolicy.allowPostFx).toBe(false);
    });

    it('refreshes Phaser scale immediately and on next rAF on READY when loop is awake so Safari initial flex layout never locks canvas at 0x0', () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      const listeners = new Map<string, Set<() => void>>();
      const refresh = vi.fn();
      const fakeGame = {
        renderer: { type: 2 },
        loop: { sleep: vi.fn(), wake: vi.fn() },
        scale: { refresh },
        events: {
          on: vi.fn((event: string, fn: () => void) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(fn);
          }),
          once: vi.fn((event: string, fn: () => void) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(fn);
          }),
          off: vi.fn((event: string, fn: () => void) => {
            listeners.get(event)?.delete(fn);
          }),
        },
      };

      const { dispose } = wireClassroomPhaserLifecycle({
        game: fakeGame,
        events: { READY: 'ready', POST_STEP: 'poststep', VISIBLE: 'visible', RESUME: 'resume' },
      });

      for (const fn of [...(listeners.get('ready') ?? [])]) fn();
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
      rafCallbacks.forEach((cb) => cb(16));
      expect(refresh).toHaveBeenCalledTimes(2);
      dispose();
    });
  });
});
