import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestOnboardingModal } from '../components/auth/GuestOnboardingModal';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { CharacterCustomizerModal } from '../components/hud/CharacterCustomizerModal';
import { ClassroomTelemetryBar } from '../components/hud/ClassroomTelemetryBar';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import { StudyCafeAmbientVfx } from '../game/cafe/studyCafeAmbientVfx';
import { ChatBubble } from '../game/entities/ChatBubble';
import { PlayerSprite } from '../game/entities/PlayerSprite';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import { TableSosOverlay } from '../game/entities/TableSosOverlay';
import { StudyCafeJuiceCoordinator } from '../game/fx/studyCafeJuiceCoordinator';
import { resolveGraphicsPolicy } from '../game/graphics/graphicsQualityPolicy';
import { attachWorkspaceGpuSleep } from '../game/graphics/workspaceGpuSleep';
import { applyCameraViewportState } from '../game/scenes/classroomCameraController';
import { updateLocalActorAndLabelFrame, type LocalActorVisuals } from '../game/scenes/classroomSceneLabelSync';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { resolveVfxEmissionProfile } from '../game/vfx/vfxQualityProfile';
import { useRoomSync } from '../hooks/useRoomSync';
import * as roomStompClient from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

describe('Phase 11 Audit Fixes — Core Runtime & State-Machine Regressions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  it('triggers stand tween and STANDING_UP frames when leaving a seat from an expanded workspace that put Phaser to GPU sleep', () => {
    const sleepLoop = vi.fn();
    const wakeLoop = vi.fn();
    const gpuSleep = attachWorkspaceGpuSleep({ sleepLoop, wakeLoop });

    const ambientVfx = new StudyCafeAmbientVfx(undefined, MAIN_LIBRARY_TOPOLOGY);
    const coordinator = new StudyCafeJuiceCoordinator(undefined, MAIN_LIBRARY_TOPOLOGY, ambientVfx);
    const playerSprite = new PlayerSprite({
      tileX: 3,
      tileY: 4,
      tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
      facingDir: 'RIGHT',
      nickname: 'Hậu',
    });
    const policy = resolveGraphicsPolicy({
      requestedQuality: 'high',
      rendererKind: 'webgl',
      prefersReducedMotion: false,
    });

    // 1. Learner is walking toward seat while Phaser loop is awake
    useGameStore.setState({
      characterState: 'WALKING_TO_SEAT',
      targetTableId: 'table_01',
      targetSeatId: 'T1_S1',
      position: { x: 3, y: 4 },
    });
    const walkFrame = coordinator.updateFrame({
      characterState: 'WALKING_TO_SEAT',
      isMoving: true,
      tileX: 3,
      tileY: 4,
      pixelX: 112,
      pixelY: 144,
      isLocalHost: false,
      remoteHosts: [],
      pathQueue: [{ tileX: 3, tileY: 4 }],
      hoveredSeatId: null,
      hoveredNpcId: null,
      occupiedSeats: {},
      activeSeatId: null,
      npcTarget: null,
      policy,
      timeMs: 100,
      deltaMs: 16,
    });
    expect(walkFrame.seatTransition.kind).toBe('idle');

    // 2. Server confirms seat -> expanded workspace puts Phaser to GPU sleep synchronously (0 Phaser frames tick while SEATED)
    useGameStore.getState().confirmSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'RIGHT');
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-1',
      sitStartTimeEpoch: Date.now(),
    });
    expect(gpuSleep.isSleeping()).toBe(true);
    expect(sleepLoop).toHaveBeenCalledTimes(1);

    // 3. Learner clicks "Đứng dậy rời bàn" -> Phaser wakes up directly in FREE_ROAM
    useGameStore.getState().leaveSeat();
    useTableStore.getState().leaveTable();
    expect(gpuSleep.isSleeping()).toBe(false);
    expect(wakeLoop).toHaveBeenCalledTimes(1);

    // 4. First Phaser frame after wake MUST recognize SEATED -> FREE_ROAM and play stand tween + STANDING_UP
    const wakeFrame = coordinator.updateFrame({
      characterState: 'FREE_ROAM',
      isMoving: false,
      tileX: 3,
      tileY: 4,
      pixelX: 112,
      pixelY: 144,
      isLocalHost: false,
      remoteHosts: [],
      pathQueue: [],
      hoveredSeatId: null,
      hoveredNpcId: null,
      occupiedSeats: {},
      activeSeatId: null,
      npcTarget: null,
      policy,
      timeMs: 5000,
      deltaMs: 16,
    });
    playerSprite.syncFromStore({
      tileX: 3,
      tileY: 4,
      facingDir: 'RIGHT',
      characterState: 'FREE_ROAM',
      isMoving: false,
      seatTransitionKind: wakeFrame.seatTransition.kind,
    });

    expect(wakeFrame.seatTransition.active).toBe(true);
    expect(wakeFrame.seatTransition.kind).toBe('stand');
    expect(wakeFrame.scaleY).toBeGreaterThan(1);
    expect(playerSprite.getPosture()).toBe('STANDING_UP');

    coordinator.destroy();
    ambientVfx.destroy();
    gpuSleep.dispose();
  });

  it('skips redundant Zustand label-frame commits when world positions and overlays are unchanged across idle frames', () => {
    const sprite = {
      setPosition: vi.fn(),
      setScale: vi.fn(),
      setDepth: vi.fn(),
      play: vi.fn(),
    };
    const visuals: LocalActorVisuals = {
      actorSprite: sprite as unknown as LocalActorVisuals['actorSprite'],
      selfAccessoriesOverlay: { update: vi.fn(), destroy: vi.fn() } as unknown as LocalActorVisuals['selfAccessoriesOverlay'],
      selfChatBubble: {
        update: vi.fn(),
        isActive: () => false,
        getText: () => '',
        getVisualState: () => ({ scale: 1, alpha: 0, offsetY: 0 }),
        destroy: vi.fn(),
      } as unknown as LocalActorVisuals['selfChatBubble'],
      currentAnimKey: 'default_student:standing:down',
    };
    const playerSprite = new PlayerSprite({ tileX: 10, tileY: 10, tileSize: 32, facingDir: 'DOWN' });
    const remotePlayersRenderer = { getLabelEntries: () => [] } as unknown as Parameters<typeof updateLocalActorAndLabelFrame>[0]['remotePlayersRenderer'];
    const ambientNpcManager = {
      getLabelEntries: () => [
        {
          npcId: 'npc_barista',
          displayName: 'Barista Minh',
          isCounterStaff: true,
          worldX: 528.04,
          worldY: 432.02,
          bubbleText: null,
          bubbleMotion: { scale: 1, alpha: 0, offsetY: 0 },
        },
      ],
    } as unknown as Parameters<typeof updateLocalActorAndLabelFrame>[0]['ambientNpcManager'];
    const tableSosOverlay = { getLabelEntries: () => [] } as unknown as Parameters<typeof updateLocalActorAndLabelFrame>[0]['tableSosOverlay'];

    let storeNotifications = 0;
    const unsub = useStudyCafeDisplayStore.subscribe(() => {
      storeNotifications += 1;
    });

    // Simulate 10 consecutive idle 60 FPS frames with sub-pixel jitter < 0.25px
    for (let i = 0; i < 10; i += 1) {
      updateLocalActorAndLabelFrame({
        topology: MAIN_LIBRARY_TOPOLOGY,
        visuals,
        playerSprite,
        remotePlayersRenderer,
        ambientNpcManager,
        tableSosOverlay,
        juice: {
          renderX: 336 + (i % 2 === 0 ? 0.04 : -0.04),
          renderY: 336,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1,
        },
        isMoving: false,
        isSeated: false,
        prefersReducedMotion: false,
        fallbackZoom: 1,
        time: 1000 + i * 16,
        now: 1000 + i * 16,
      });
    }

    // Only the initial commit should notify Zustand; the remaining 9 identical frames must be skipped
    expect(storeNotifications).toBe(1);
    unsub();
  });

  it('handles missing WebSocket env config inside useRoomSync cleanly and catches unexpected render errors via AppErrorBoundary', () => {
    vi.spyOn(roomStompClient, 'createRoomStompSession').mockImplementation(() => {
      throw new Error('Missing VITE_API_BASE_URL or VITE_WS_BASE_URL for WebSocket connection.');
    });
    useAuthStore.setState({ userId: 'u-cfg', nickname: 'Cfg', token: 'jwt-cfg' });

    function RoomSyncProbe() {
      useRoomSync('UP');
      return <div data-testid="room-sync-alive">alive</div>;
    }

    render(<RoomSyncProbe />);
    expect(screen.getByTestId('room-sync-alive')).toBeInTheDocument();
    expect(useGameStore.getState().connectionStatus).toBe('ERROR');
    expect(useGameStore.getState().lastError?.code).toBe('WS_CONFIG_MISSING');

    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function CrashingChild(): JSX.Element {
      throw new Error('Simulated crash');
    }
    render(
      <AppErrorBoundary>
        <CrashingChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByTestId('app-error-boundary')).toBeInTheDocument();
    expect(screen.getByText('Simulated crash')).toBeInTheDocument();
    consoleErrSpy.mockRestore();
  });

  it('keeps graphicsQualityPolicy aligned with vfxQualityProfile on low tier and disables camera lerp/deadzone when allowCameraJuice is false', () => {
    const lowNonReduced = resolveGraphicsPolicy({
      requestedQuality: 'low',
      rendererKind: 'webgl',
      prefersReducedMotion: false,
    });
    const lowVfx = resolveVfxEmissionProfile(lowNonReduced);
    expect(lowNonReduced.allowParticles).toBe(true);
    expect(lowNonReduced.particleDensityScale).toBe(0.25);
    expect(lowVfx.rainMaxAlive).toBeGreaterThan(0);

    const startFollow = vi.fn();
    const setDeadzone = vi.fn();
    const camera = {
      roundPixels: false,
      setBounds: vi.fn(),
      setZoom: vi.fn(),
      startFollow,
      stopFollow: vi.fn(),
      setDeadzone,
      centerOn: vi.fn(),
    };
    const target = {};
    applyCameraViewportState({
      camera,
      target,
      worldWidth: 768,
      worldHeight: 512,
      view: { zoom: 2, followEnabled: true },
      allowCameraJuice: false,
    } as Parameters<typeof applyCameraViewportState>[0]);
    expect(startFollow).toHaveBeenCalledWith(target, true, 1, 1);
    expect(setDeadzone).toHaveBeenCalledWith();
  });

  it('suppresses remote player and NPC idle breathing under prefers-reduced-motion and creates zero hidden Phaser text/graphics shells for labels', () => {
    const remoteSpritePos = vi.fn();
    const npcSpritePos = vi.fn();
    const addText = vi.fn();
    const addGraphics = vi.fn();
    const addContainer = vi.fn();

    const mockScene = {
      add: {
        sprite: vi.fn((x: number, y: number) => ({
          x,
          y,
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setPosition: vi.fn((nx: number, ny: number) => {
            remoteSpritePos(nx, ny);
            npcSpritePos(nx, ny);
          }),
          play: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        })),
        image: vi.fn(() => ({
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        })),
        text: addText,
        graphics: addGraphics,
        container: addContainer,
      },
    } as unknown as Phaser.Scene;

    const remote = new RemotePlayersRenderer({ scene: mockScene, tileSize: 32 });
    remote.syncPlayers({
      'r-1': {
        userId: 'r-1',
        nickname: 'An',
        avatarId: 'default_student',
        role: 'GUEST',
        state: 'FREE_ROAM',
        x: 5,
        y: 5,
        facingDir: 'DOWN',
        tableId: null,
        seatId: null,
        connected: true,
      },
    });
    remoteSpritePos.mockClear();
    // Pick a time where sin(t/420 + 1.3) is clearly non-zero
    (remote.update as (lerp?: number, now?: number, reducedMotion?: boolean) => void)(0.28, 600, true);
    // Exact center of tile (5,5) is y = 5*32 + 16 = 176 (zero breathing offset)
    expect(remoteSpritePos).toHaveBeenCalledWith(176, 176);

    const npcMgr = new AmbientNpcManager({ scene: mockScene, topology: MAIN_LIBRARY_TOPOLOGY, nowMs: 1000 });
    npcSpritePos.mockClear();
    (npcMgr.update as (dt: number, now?: number, reducedMotion?: boolean) => void)(16, 1600, true);
    const barista = npcMgr.getSnapshots().find((n) => n.npcId === 'npc_barista')!;
    expect(npcSpritePos).toHaveBeenCalledWith(barista.pixelX, barista.pixelY);

    const bubble = new ChatBubble({ scene: mockScene });
    bubble.show('Chào!', 1000);
    const sos = new TableSosOverlay(mockScene, MAIN_LIBRARY_TOPOLOGY);
    sos.update(
      [
        {
          tableId: 'table_01',
          label: 'Bàn 1',
          capacity: 2,
          hostUserId: 'u-1',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: 'Giúp giải phương trình vi phân bậc 2',
          occupiedSeats: 1,
        },
      ],
      1000,
      true,
    );
    expect(sos.getLabelEntries()[0]?.text).toBe('🆘 Giúp giải phương trình vi…');

    // Zero hidden Phaser Text / Graphics / Container shells created by DOM-projected labels
    expect(addText).not.toHaveBeenCalled();
    expect(addGraphics).not.toHaveBeenCalled();
    expect(addContainer).not.toHaveBeenCalled();

    remote.destroy();
    npcMgr.destroy();
    bubble.destroy();
    sos.destroy();
  });

  it('anchors right-edge mobile Service Counter label at -100% with compact mobile text, hides desktop popover triggers via sm:hidden, marks decorative bullet aria-hidden, and uses semantic tokens in ClassroomTelemetryBar', () => {
    useAuthStore.setState({ userId: 'u-ui', nickname: 'Hậu', token: 'jwt-ui' });
    useGameStore.setState({ cameraZoom: 2, cameraFollowEnabled: true, position: { x: 14, y: 11 } });

    render(<ClassroomCanvas />);

    const counterLabel = screen.getByTestId('map-label-zone-service-counter');
    expect(counterLabel.className).toContain('max-sm:[--label-anchor-x:-100%]');
    expect(counterLabel.textContent).toContain('☕ Quầy Study Café');

    const ambienceTrigger = screen.getByTestId('ambience-mood-popover-trigger');
    const graphicsTrigger = screen.getByTestId('graphics-quality-popover-trigger');
    expect(ambienceTrigger.className).toContain('sm:hidden');
    expect(graphicsTrigger.className).toContain('sm:hidden');

    const bullet = screen.getByText('•');
    expect(bullet).toHaveAttribute('aria-hidden', 'true');

    const { container } = render(<ClassroomTelemetryBar />);
    expect(container.innerHTML).not.toMatch(/#(?:243630|16221E|8FA399|E6ECE8)/i);
    expect(container.innerHTML).toContain('bg-card');
    expect(container.innerHTML).toContain('border-border');
  });

  it('traps Tab and Shift+Tab keyboard focus strictly inside GuestOnboardingModal and CharacterCustomizerModal dialogs', () => {
    const { unmount } = render(
      <div>
        <button type="button" data-testid="outside-btn">Outside</button>
        <GuestOnboardingModal />
      </div>,
    );

    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusables.length).toBeGreaterThan(2);

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    unmount();

    render(
      <div>
        <button type="button" data-testid="outside-btn-2">Outside</button>
        <CharacterCustomizerModal onClose={vi.fn()} />
      </div>,
    );
    const customizerDialog = screen.getByRole('dialog');
    const customizerFocusables = Array.from(
      customizerDialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(customizerFocusables.length).toBeGreaterThan(2);
    customizerFocusables[customizerFocusables.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(customizerFocusables[0]);
  });
});
