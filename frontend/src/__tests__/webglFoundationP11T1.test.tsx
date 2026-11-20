import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { BOTANICAL_2D_SCENE } from '../game/botanicalPalette';
import {
  createClassroomGameConfig,
  wireClassroomPhaserLifecycle,
} from '../game/graphics/bootClassroomGame';
import {
  AMBIENCE_MOOD_OPTIONS,
  GRAPHICS_QUALITY_OPTIONS,
  detectRendererKind,
  resolveGraphicsPolicy,
  suggestAmbienceMoodForTime,
} from '../game/graphics/graphicsQualityPolicy';
import {
  attachWorkspaceGpuSleep,
  shouldSleepStudyCafeLoop,
} from '../game/graphics/workspaceGpuSleep';
import {
  CAMERA_FOLLOW_DEADZONE,
  CAMERA_FOLLOW_LERP,
  CAMERA_ZOOM_PRESETS,
  CAMERA_ZOOM_STEP,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  applyCameraViewportState,
  clampCameraZoom,
} from '../game/scenes/classroomCameraController';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { useGameStore } from '../stores/useGameStore';
import {
  STUDY_CAFE_DISPLAY_STORAGE_KEY,
  useStudyCafeDisplayStore,
} from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

describe('P11-T1: WebGL Foundation, Graphics Quality & Ambience Store, Workspace GPU Sleep & Pixel-Perfect Camera (#76)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  describe('Slice 2: Renderer Capability Policy & Personal Graphics Quality / Ambience Mood Store', () => {
    it('detects WebGL, Canvas, and headless renderers and resolves quality policies with Canvas and reduced-motion clamping', () => {
      expect(GRAPHICS_QUALITY_OPTIONS.map((o) => o.label)).toEqual(['Thấp', 'Trung bình', 'Cao']);
      expect(AMBIENCE_MOOD_OPTIONS.map((o) => o.label)).toEqual([
        'Hoàng hôn ấm',
        'Đêm tập trung',
        'Đêm mưa',
      ]);

      expect(detectRendererKind({ type: 2 })).toBe('webgl');
      expect(detectRendererKind({ type: 1 })).toBe('canvas');
      expect(detectRendererKind(undefined)).toBe('headless');

      // WebGL auto default -> high with full FX
      const webglAuto = resolveGraphicsPolicy({
        requestedQuality: null,
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      expect(webglAuto).toMatchObject({
        effectiveQuality: 'high',
        isWebGl: true,
        allowWebGlFx: true,
        allowPostFx: true,
        allowPointLights: true,
        allowParticles: true,
        allowCameraJuice: true,
        particleDensityScale: 1,
      });

      // Canvas fallback auto default -> low, never allows WebGL FX even if manual 'high' is requested
      const canvasAuto = resolveGraphicsPolicy({
        requestedQuality: null,
        rendererKind: 'canvas',
        prefersReducedMotion: false,
      });
      expect(canvasAuto.effectiveQuality).toBe('low');
      expect(canvasAuto.allowWebGlFx).toBe(false);

      const canvasManualHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'canvas',
        prefersReducedMotion: false,
      });
      expect(canvasManualHigh).toMatchObject({
        effectiveQuality: 'medium',
        isWebGl: false,
        allowWebGlFx: false,
        allowPostFx: false,
        allowPointLights: false,
        allowParticles: true,
        particleDensityScale: 0.5,
      });

      // prefers-reduced-motion clamps even manual 'high' on WebGL down to 'low' with zero motion FX
      const reducedMotionWebgl = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: true,
      });
      expect(reducedMotionWebgl).toMatchObject({
        effectiveQuality: 'low',
        isWebGl: true,
        allowWebGlFx: false,
        allowPostFx: false,
        allowParticles: false,
        allowCameraJuice: false,
        particleDensityScale: 0,
      });
    });

    it('auto-suggests Ambience Mood from local time and persists manual overrides in localStorage', () => {
      expect(suggestAmbienceMoodForTime(new Date(2026, 10, 20, 17, 30))).toBe('warm_sunset');
      expect(suggestAmbienceMoodForTime(new Date(2026, 10, 20, 20, 15))).toBe('deep_focus_night');
      expect(suggestAmbienceMoodForTime(new Date(2026, 10, 20, 23, 45))).toBe('rainy_night');
      expect(suggestAmbienceMoodForTime(new Date(2026, 10, 20, 2, 0))).toBe('rainy_night');

      const store = useStudyCafeDisplayStore.getState();
      store.setRendererKind('webgl');
      store.setPrefersReducedMotion(false);
      store.hydrateFromStorage(new Date(2026, 10, 20, 20, 0));

      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('high');
      expect(useStudyCafeDisplayStore.getState().ambienceMood).toBe('deep_focus_night');

      // Manual overrides persist to localStorage
      useStudyCafeDisplayStore.getState().setGraphicsQuality('medium');
      useStudyCafeDisplayStore.getState().setAmbienceMood('rainy_night');

      const raw = window.localStorage.getItem(STUDY_CAFE_DISPLAY_STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual({
        qualityPreference: 'medium',
        moodPreference: 'rainy_night',
      });

      // Re-hydrating preserves manual overrides over local-time suggestion
      useStudyCafeDisplayStore.getState().hydrateFromStorage(new Date(2026, 10, 20, 16, 0));
      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('medium');
      expect(useStudyCafeDisplayStore.getState().ambienceMood).toBe('rainy_night');

      // Enabling prefers-reduced-motion clamps effective quality while keeping stored preference intact
      useStudyCafeDisplayStore.getState().setPrefersReducedMotion(true);
      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('low');
      expect(useStudyCafeDisplayStore.getState().qualityPreference).toBe('medium');
      expect(useStudyCafeDisplayStore.getState().graphicsPolicy.allowParticles).toBe(false);

      // Clearing manual overrides falls back to auto time & renderer defaults
      useStudyCafeDisplayStore.getState().setPrefersReducedMotion(false);
      useStudyCafeDisplayStore.getState().setAmbienceMood(null);
      useStudyCafeDisplayStore.getState().hydrateFromStorage(new Date(2026, 10, 20, 16, 0));
      expect(useStudyCafeDisplayStore.getState().ambienceMood).toBe('warm_sunset');
    });
  });

  describe('Slice 3: WebGL AUTO Config & Workspace GPU Sleep Lifecycle', () => {
    it('builds Phaser.AUTO WebGL-first game config with pixelArt and roundPixels enabled', () => {
      const parentEl = document.createElement('div');
      const fakeScene = { key: 'ClassroomScene' };
      const config = createClassroomGameConfig({
        phaserModule: {
          AUTO: 0,
          Scale: { FIT: 3, NO_CENTER: 0 },
        },
        parent: parentEl,
        scene: fakeScene,
        topology: MAIN_LIBRARY_TOPOLOGY,
      });

      expect(config.type).toBe(0);
      expect(config.parent).toBe(parentEl);
      expect(config.width).toBe(MAIN_LIBRARY_TOPOLOGY.width * MAIN_LIBRARY_TOPOLOGY.tileSize);
      expect(config.height).toBe(MAIN_LIBRARY_TOPOLOGY.height * MAIN_LIBRARY_TOPOLOGY.tileSize);
      expect(config.backgroundColor).toBe(BOTANICAL_2D_SCENE.canvasBackground);
      expect(config.pixelArt).toBe(true);
      expect(config.roundPixels).toBe(true);
      expect(config.antialias).toBe(false);
      expect(config.render).toEqual({
        pixelArt: true,
        roundPixels: true,
        antialias: false,
      });
    });

    it('sleeps the render loop when SEATED with expanded Table Workspace and wakes immediately on minimize or seat leave without dropping room sync', () => {
      expect(
        shouldSleepStudyCafeLoop({
          characterState: 'FREE_ROAM',
          currentTableId: null,
          isWorkspaceMinimized: false,
        }),
      ).toBe(false);
      expect(
        shouldSleepStudyCafeLoop({
          characterState: 'SEATED',
          currentTableId: 'table_01',
          isWorkspaceMinimized: false,
        }),
      ).toBe(true);
      expect(
        shouldSleepStudyCafeLoop({
          characterState: 'SEATED',
          currentTableId: 'table_01',
          isWorkspaceMinimized: true,
        }),
      ).toBe(false);

      const sleepLoop = vi.fn();
      const wakeLoop = vi.fn();
      const refreshScale = vi.fn();
      let resumeCallback: (() => void) | undefined;
      const onVisibilityResume = vi.fn((cb: () => void) => {
        resumeCallback = cb;
        return () => {
          resumeCallback = undefined;
        };
      });

      const controller = attachWorkspaceGpuSleep({
        sleepLoop,
        wakeLoop,
        refreshScale,
        onVisibilityResume,
      });

      expect(controller.isSleeping()).toBe(false);
      expect(sleepLoop).not.toHaveBeenCalled();

      // Sit down with Table Workspace expanded -> loop enters GPU sleep
      useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'RIGHT');
      expect(controller.isSleeping()).toBe(true);
      expect(sleepLoop).toHaveBeenCalledTimes(1);

      // Room snapshot updates still flow into Zustand store while renderer sleeps
      useGameStore.getState().applyRoomSnapshot(
        {
          roomId: 'main-library',
          capacityLimit: 50,
          eventSeq: 12,
          players: [
            {
              userId: 'peer-1',
              nickname: 'Peer',
              avatarId: 'default_student',
              hatId: 'hat_none',
              deskPetId: 'pet_none',
              role: 'GUEST',
              state: 'FREE_ROAM',
              x: 8,
              y: 8,
              facingDir: 'DOWN',
              tableId: null,
              seatId: null,
              connected: true,
            },
          ],
          seats: { T1_S1: 'self-user' },
          tables: [],
          recentMessages: [],
        },
        'self-user',
      );
      expect(useGameStore.getState().remotePlayers['peer-1']?.nickname).toBe('Peer');

      // Tab visibility resume while workspace is still expanded re-asserts GPU sleep
      expect(resumeCallback).toBeDefined();
      resumeCallback!();
      expect(sleepLoop).toHaveBeenCalledTimes(2);
      expect(wakeLoop).not.toHaveBeenCalled();

      // Minimizing Table Workspace wakes render loop immediately
      useTableStore.getState().setWorkspaceMinimized(true);
      expect(controller.isSleeping()).toBe(false);
      expect(wakeLoop).toHaveBeenCalledTimes(1);
      expect(refreshScale).toHaveBeenCalledTimes(1);

      // Re-expanding workspace puts it back to sleep
      useTableStore.getState().setWorkspaceMinimized(false);
      expect(controller.isSleeping()).toBe(true);
      expect(sleepLoop).toHaveBeenCalledTimes(3);

      // Leaving seat while workspace is expanded wakes render loop immediately
      useGameStore.getState().leaveSeat();
      expect(controller.isSleeping()).toBe(false);
      expect(wakeLoop).toHaveBeenCalledTimes(2);

      controller.dispose();
    });

    it('re-applies GPU sleep after Phaser starts loop on POST_STEP when already SEATED before boot and syncs renderer on READY', () => {
      // Simulate F5 grace-period reconnect: learner is already SEATED with expanded workspace before Phaser boots
      useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'RIGHT');

      const listeners = new Map<string, Set<() => void>>();
      const emit = (event: string) => {
        for (const fn of [...(listeners.get(event) ?? [])]) fn();
      };
      let loopRunning = false;
      const sleep = vi.fn(() => {
        // Mirrors Phaser 3.90 TimeStep.sleep(): no-op until loop.start() sets running = true
        if (!loopRunning) return;
        loopRunning = false;
      });
      const wake = vi.fn(() => {
        loopRunning = true;
      });
      const refresh = vi.fn();

      const fakeGame = {
        renderer: null as { type?: number } | null,
        loop: { sleep, wake },
        scale: { refresh },
        events: {
          on: vi.fn((event: string, fn: () => void) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(fn);
          }),
          once: vi.fn((event: string, fn: () => void) => {
            const wrapper = () => {
              listeners.get(event)?.delete(wrapper);
              fn();
            };
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(wrapper);
          }),
          off: vi.fn((event: string, fn: () => void) => {
            listeners.get(event)?.delete(fn);
          }),
        },
      };

      const lifecycle = wireClassroomPhaserLifecycle({
        game: fakeGame,
        events: { READY: 'ready', POST_STEP: 'poststep', VISIBLE: 'visible', RESUME: 'resume' },
      });

      // Phaser finishes booting: assigns WebGL renderer, emits READY, starts loop, then runs first POST_STEP
      fakeGame.renderer = { type: 2 };
      emit('ready');
      expect(useStudyCafeDisplayStore.getState().rendererKind).toBe('webgl');

      loopRunning = true;
      // Phaser registers its own VISIBLE wake handler during game.start()
      fakeGame.events.on('visible', () => {
        loopRunning = true;
      });

      emit('poststep');
      expect(loopRunning).toBe(false);

      // Returning to tab triggers Phaser's onVisible (waking loop), then our handler immediately re-sleeps it
      emit('visible');
      expect(loopRunning).toBe(false);

      // Minimizing Table Workspace wakes the loop cleanly
      useTableStore.getState().setWorkspaceMinimized(true);
      expect(loopRunning).toBe(true);
      expect(wake).toHaveBeenCalledWith(true);
      expect(refresh).toHaveBeenCalledTimes(1);

      lifecycle.dispose();
    });
  });

  describe('Slice 4: Pixel-Perfect Integer Zoom (1× / 2× / 3×) & Damped Camera Follow with Deadzone', () => {
    it('snaps camera zoom exclusively to integer presets 1, 2, 3 and configures roundPixels + damped follow deadzone', () => {
      expect(CAMERA_ZOOM_PRESETS).toEqual([1, 2, 3]);
      expect(MIN_CAMERA_ZOOM).toBe(1);
      expect(MAX_CAMERA_ZOOM).toBe(3);
      expect(CAMERA_ZOOM_STEP).toBe(1);

      expect(clampCameraZoom(0.2)).toBe(1);
      expect(clampCameraZoom(1.4)).toBe(1);
      expect(clampCameraZoom(1.55)).toBe(2);
      expect(clampCameraZoom(2.6)).toBe(3);
      expect(clampCameraZoom(5)).toBe(3);
      expect(clampCameraZoom(Number.NaN)).toBe(1);

      const fakeCamera = {
        roundPixels: false,
        setBounds: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn(),
        stopFollow: vi.fn(),
        setDeadzone: vi.fn(),
        centerOn: vi.fn(),
      };
      const fakeActor = { x: 100, y: 120 };

      applyCameraViewportState({
        camera: fakeCamera,
        target: fakeActor,
        worldWidth: 768,
        worldHeight: 512,
        view: { zoom: 2.25, followEnabled: true },
      });

      expect(fakeCamera.roundPixels).toBe(true);
      expect(fakeCamera.setZoom).toHaveBeenCalledWith(2);
      expect(fakeCamera.startFollow).toHaveBeenCalledWith(
        fakeActor,
        true,
        CAMERA_FOLLOW_LERP,
        CAMERA_FOLLOW_LERP,
      );
      expect(fakeCamera.setDeadzone).toHaveBeenCalledWith(
        CAMERA_FOLLOW_DEADZONE.width,
        CAMERA_FOLLOW_DEADZONE.height,
      );

      // Disabling follow clears deadzone and centers cleanly at 1×
      applyCameraViewportState({
        camera: fakeCamera,
        target: fakeActor,
        worldWidth: 768,
        worldHeight: 512,
        view: { zoom: 1, followEnabled: false },
      });
      expect(fakeCamera.stopFollow).toHaveBeenCalledTimes(1);
      expect(fakeCamera.setDeadzone).toHaveBeenLastCalledWith();
      expect(fakeCamera.centerOn).toHaveBeenCalledWith(384, 256);
    });
  });

  describe('Slice 5: Accessible Graphics Quality Control in Viewport Chrome', () => {
    it('renders accessible Graphics Quality selector in ClassroomCanvas and updates persisted tier', () => {
      useStudyCafeDisplayStore.getState().setRendererKind('webgl');
      useStudyCafeDisplayStore.getState().setPrefersReducedMotion(false);

      render(<ClassroomCanvas />);

      const group = screen.getByTestId('graphics-quality-control');
      expect(group).toHaveAttribute('role', 'group');
      expect(group).toHaveAttribute('aria-label', 'Mức chất lượng đồ họa');

      const lowBtn = screen.getByTestId('graphics-quality-btn-low');
      const medBtn = screen.getByTestId('graphics-quality-btn-medium');
      const highBtn = screen.getByTestId('graphics-quality-btn-high');

      expect(highBtn).toHaveAttribute('aria-pressed', 'true');
      expect(medBtn).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(medBtn);
      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('medium');
      expect(medBtn).toHaveAttribute('aria-pressed', 'true');
      expect(JSON.parse(window.localStorage.getItem(STUDY_CAFE_DISPLAY_STORAGE_KEY)!)).toMatchObject({
        qualityPreference: 'medium',
      });

      fireEvent.click(lowBtn);
      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('low');
      expect(lowBtn).toHaveAttribute('aria-pressed', 'true');

      // On Canvas fallback, High tier is disabled and cannot activate WebGL FX
      act(() => {
        useStudyCafeDisplayStore.getState().setRendererKind('canvas');
      });
      expect(screen.getByTestId('graphics-quality-btn-high')).toBeDisabled();

      // Enabling prefers-reduced-motion disables Medium & High and clamps to Low
      act(() => {
        useStudyCafeDisplayStore.getState().setRendererKind('webgl');
        useStudyCafeDisplayStore.getState().setPrefersReducedMotion(true);
      });
      expect(screen.getByTestId('graphics-quality-btn-low')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('graphics-quality-btn-medium')).toBeDisabled();
      expect(screen.getByTestId('graphics-quality-btn-high')).toBeDisabled();
    });

    it('keeps Cao selection consistent before Phaser boots (headless) while guarding all WebGL FX off', () => {
      useStudyCafeDisplayStore.getState().setPrefersReducedMotion(false);
      render(<ClassroomCanvas />);

      const highBtn = screen.getByTestId('graphics-quality-btn-high');
      fireEvent.click(highBtn);
      expect(highBtn).toHaveAttribute('aria-pressed', 'true');
      expect(useStudyCafeDisplayStore.getState().graphicsQuality).toBe('high');
      expect(useStudyCafeDisplayStore.getState().graphicsPolicy.allowWebGlFx).toBe(false);
    });
  });
});
