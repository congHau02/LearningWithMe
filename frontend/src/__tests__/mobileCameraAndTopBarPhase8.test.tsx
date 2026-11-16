import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { TopBar } from '../components/hud/TopBar';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import { AMBIENT_NPC_DEFINITIONS } from '../game/cafe/studyCafeConfig';
import { InputController } from '../game/controllers/InputController';
import {
  applyCameraViewportState,
  clampCameraZoom,
  computeDefaultCameraPreset,
} from '../game/scenes/classroomCameraController';
import { handleClassroomPointerDown } from '../game/scenes/classroomPointerHandler';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { useGameStore } from '../stores/useGameStore';

describe('P8-T8 Slice 3: Mobile Camera Follow/Zoom & Compact TopBar', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    useGameStore.getState().resetGame();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
    vi.restoreAllMocks();
  });

  it('computes mobile zoom/follow presets, clamps zoom, and applies Phaser camera follow/bounds', () => {
    expect(computeDefaultCameraPreset(375)).toEqual({ zoom: 2, followEnabled: true });
    expect(computeDefaultCameraPreset(640)).toEqual({ zoom: 2, followEnabled: true });
    expect(computeDefaultCameraPreset(1024)).toEqual({ zoom: 1, followEnabled: false });

    expect(clampCameraZoom(0.2)).toBe(1);
    expect(clampCameraZoom(4.5)).toBe(2.5);
    expect(clampCameraZoom(1.55)).toBe(1.55);

    const fakeCamera = {
      setBounds: vi.fn(),
      setZoom: vi.fn(),
      startFollow: vi.fn(),
      stopFollow: vi.fn(),
      centerOn: vi.fn(),
    };
    const fakeActor = { x: 100, y: 120 };

    applyCameraViewportState({
      camera: fakeCamera,
      target: fakeActor,
      worldWidth: 768,
      worldHeight: 512,
      view: { zoom: 2, followEnabled: true },
    });

    expect(fakeCamera.setBounds).toHaveBeenCalledWith(0, 0, 768, 512);
    expect(fakeCamera.setZoom).toHaveBeenCalledWith(2);
    expect(fakeCamera.startFollow).toHaveBeenCalledWith(fakeActor, true, 0.14, 0.14);

    // Turning follow off while still zoomed (> 1x) stops follow without yanking camera to center
    applyCameraViewportState({
      camera: fakeCamera,
      target: fakeActor,
      worldWidth: 768,
      worldHeight: 512,
      view: { zoom: 2, followEnabled: false },
    });
    expect(fakeCamera.stopFollow).toHaveBeenCalledTimes(1);
    expect(fakeCamera.centerOn).not.toHaveBeenCalled();

    // At 1.0x unfollowed desktop view, camera centers the full room
    applyCameraViewportState({
      camera: fakeCamera,
      target: fakeActor,
      worldWidth: 768,
      worldHeight: 512,
      view: { zoom: 1, followEnabled: false },
    });

    expect(fakeCamera.centerOn).toHaveBeenCalledWith(384, 256);
  });

  it('auto-enables mobile camera zoom/follow on narrow viewports, exposes HUD zoom controls, and preserves Seat/NPC tap targets', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });

    render(<ClassroomCanvas />);

    expect(useGameStore.getState().cameraZoom).toBe(2);
    expect(useGameStore.getState().cameraFollowEnabled).toBe(true);
    expect(screen.getByTestId('camera-zoom-readout')).toHaveTextContent('2.0x');
    expect(screen.getByTestId('camera-follow-toggle-btn')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('camera-zoom-in-btn'));
    expect(useGameStore.getState().cameraZoom).toBe(2.25);
    expect(screen.getByTestId('camera-zoom-readout')).toHaveTextContent('2.25x');

    // Manual/wheel zoom override is preserved across resize
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(useGameStore.getState().cameraZoom).toBe(2.25);

    fireEvent.click(screen.getByTestId('camera-zoom-out-btn'));
    expect(useGameStore.getState().cameraZoom).toBe(2);

    fireEvent.click(screen.getByTestId('camera-follow-toggle-btn'));
    expect(useGameStore.getState().cameraFollowEnabled).toBe(false);

    // Tapping a Seat and an Ambient NPC in world coordinates works cleanly with mobile camera state
    const controller = new InputController();
    const npcManager = new AmbientNpcManager({
      tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
      definitions: AMBIENT_NPC_DEFINITIONS,
      nowMs: 10_000,
    });

    const firstSeat = MAIN_LIBRARY_TOPOLOGY.seats[0];
    let movedToSeat = false;
    act(() => {
      movedToSeat = handleClassroomPointerDown({
        worldX: firstSeat.tileX * 32 + 16,
        worldY: firstSeat.tileY * 32 + 16,
        topology: MAIN_LIBRARY_TOPOLOGY,
        inputController: controller,
        ambientNpcManager: npcManager,
      });
    });
    expect(movedToSeat).toBe(true);
    expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');

    const barista = npcManager.getSnapshots()[0];
    let clickedNpc = false;
    act(() => {
      clickedNpc = handleClassroomPointerDown({
        worldX: barista.pixelX,
        worldY: barista.pixelY,
        topology: MAIN_LIBRARY_TOPOLOGY,
        inputController: controller,
        ambientNpcManager: npcManager,
      });
    });
    expect(clickedNpc).toBe(true);
    expect(useGameStore.getState().isDrinkMenuOpen).toBe(true);
    npcManager.destroy();
  });

  it('collapses secondary TopBar actions into a responsive drawer at <= 640px and restores inline on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    const onOpenLeaderboard = vi.fn();
    const onOpenCustomizer = vi.fn();
    const onOpenStudySessions = vi.fn();

    render(
      <TopBar
        roomId="main-library"
        characterState="FREE_ROAM"
        nickname="MobileLearner"
        authProvider="GUEST"
        studyGoal="Ôn tập Giải tích"
        studyGoalCompleted={false}
        totalStudyMinutes={45}
        studyStreakDays={3}
        backendStatus="UP"
        currentTableId={null}
        canEditStudyGoal={true}
        onOpenLeaderboard={onOpenLeaderboard}
        onOpenCustomizer={onOpenCustomizer}
        onOpenStudySessions={onOpenStudySessions}
      />,
    );

    const menuBtn = screen.getByTestId('topbar-mobile-menu-btn');
    expect(menuBtn).toBeVisible();
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('topbar-mobile-drawer')).not.toBeVisible();

    // Primary bar essentials stay visible
    expect(screen.getByTestId('room-badge')).toBeVisible();
    expect(screen.getByTestId('study-goal-text')).toBeVisible();
    expect(screen.getByTestId('ambient-soundscape-toggle-btn')).toBeVisible();

    // Open mobile drawer
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('topbar-mobile-drawer')).toBeVisible();
    expect(screen.getByTestId('leaderboard-open-btn')).toBeVisible();
    expect(screen.getByTestId('customizer-open-btn')).toBeVisible();

    // Clicking an action inside drawer invokes handler and closes drawer
    fireEvent.click(screen.getByTestId('leaderboard-open-btn'));
    expect(onOpenLeaderboard).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('topbar-mobile-drawer')).not.toBeVisible();

    // Resizing to desktop restores inline actions and hides mobile drawer toggle
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.queryByTestId('topbar-mobile-menu-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('topbar-mobile-drawer')).toBeVisible();
  });
});
