import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { wireClassroomPhaserLifecycle } from '../game/graphics/bootClassroomGame';
import { createStompJsTransport } from '../services/roomStompTransport';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

describe('P11-T5: Wave 1 QA Gate Integration Fixes (#81)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  it('uses Safari 15-safe pixel-fitted 3:2 stage sizing and w-max projected badges for exact mobile alignment and edge-safe zoom labels', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(520);
    useAuthStore.setState({ userId: 'u-qa', nickname: 'Hậu QA' });
    render(<ClassroomCanvas />);

    const stage = screen.getByTestId('study-cafe-fitted-stage');
    expect(stage.className).toContain('aspect-[3/2]');
    expect(stage.className).not.toContain('flex-1');
    expect(stage.className).not.toContain('cqw');
    expect(stage.className).not.toContain('cqh');
    expect(stage.parentElement?.className).not.toContain('[container-type:size]');
    expect(stage.style.width).toBe('360px');
    expect(stage.style.height).toBe('240px');

    const tablePlaque = screen.getByTestId('map-label-table-table_01');
    expect(tablePlaque.className).toContain('w-max');
  });

  it('scopes ambience and graphics popover positioning to max-sm so desktop inline rows never detach', () => {
    render(<ClassroomCanvas />);

    const ambienceTrigger = screen.getByTestId('ambience-mood-popover-trigger');
    const ambienceRow = screen.getByTestId('ambience-mood-options-row');
    fireEvent.click(ambienceTrigger);
    expect(ambienceRow.className).toContain('max-sm:absolute');
    expect(ambienceRow.className).toContain('sm:inline-flex');
    expect(ambienceRow.className).not.toMatch(/(^|\s)absolute(\s|$)/);

    const graphicsTrigger = screen.getByTestId('graphics-quality-popover-trigger');
    const graphicsRow = screen.getByTestId('graphics-quality-options-row');
    fireEvent.click(graphicsTrigger);
    expect(graphicsRow.className).toContain('max-sm:absolute');
    expect(graphicsRow.className).toContain('sm:inline-flex');
    expect(graphicsRow.className).not.toMatch(/(^|\s)absolute(\s|$)/);
  });

  it('schedules a post-layout rAF scale refresh when waking Phaser loop after minimizing Table Workspace', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    const sleep = vi.fn();
    const wake = vi.fn();
    const refresh = vi.fn();
    const game = {
      renderer: { type: 2 },
      loop: { sleep, wake },
      scale: { refresh },
      events: {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
      },
    };

    const { dispose } = wireClassroomPhaserLifecycle({
      game,
      events: { READY: 'ready', POST_STEP: 'poststep', VISIBLE: 'visible', RESUME: 'resume' },
    });

    // Sit at table with expanded workspace -> sleeps loop
    act(() => {
      useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_01' });
      useTableStore.setState({ tableId: 'table_01', isWorkspaceMinimized: false });
    });
    expect(sleep).toHaveBeenCalledTimes(1);

    // Minimize workspace -> wakes loop and refreshes scale both immediately and on next rAF
    act(() => {
      useTableStore.setState({ isWorkspaceMinimized: true });
    });
    expect(wake).toHaveBeenCalledWith(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);

    rafCallbacks.forEach((cb) => cb(16));
    expect(refresh).toHaveBeenCalledTimes(2);

    dispose();
  });

  it('does not throw when publishing over a disconnected STOMP transport', () => {
    const transport = createStompJsTransport({
      brokerURL: 'ws://localhost:8080/ws',
      connectHeaders: {},
      onConnect: vi.fn(),
    });

    expect(() =>
      transport.publish('/app/room/main-library/goal.update', JSON.stringify({ studyGoal: 'Test', completed: true })),
    ).not.toThrow();
  });
});
