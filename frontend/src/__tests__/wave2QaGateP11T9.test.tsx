import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestOnboardingModal } from '../components/auth/GuestOnboardingModal';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { CharacterCustomizerModal } from '../components/hud/CharacterCustomizerModal';
import { ClassroomTelemetryBar } from '../components/hud/ClassroomTelemetryBar';
import { buildDynamicStudyCafeMapLabels } from '../game/labels/studyCafeLabelProjection';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

interface NodeFsLike {
  existsSync: (p: string) => boolean;
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc?: string) => {
    readUInt32BE: (offset: number) => number;
    toString: (enc?: string) => string;
  };
}

async function loadNodeFs(): Promise<NodeFsLike> {
  const fsMod = 'fs';
  return (await import(/* @vite-ignore */ fsMod)) as NodeFsLike;
}

describe('P11-T9: Wave 2 Final QA Gate — Zero-CLS Labels, Mobile Polish, Audits & Asset Provenance (#85)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  it('positions DOM map labels via GPU-composited pixel translate3d(px, px, 0) without container-query CSS, with edge-safe zone anchoring and compact mobile sizing', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(520);
    useAuthStore.setState({ userId: 'u-qa2', nickname: 'Hậu QA Wave 2' });
    render(<ClassroomCanvas />);

    const overlay = screen.getByTestId('study-cafe-dom-labels-overlay');
    expect(overlay.className).not.toContain('[container-type:size]');

    const selfLabel = screen.getByTestId('map-label-self-player');
    expect(selfLabel.style.left).toBe('0px');
    expect(selfLabel.style.top).toBe('0px');
    expect(selfLabel.style.transform).toContain('translate3d(');
    expect(selfLabel.style.transform).toContain('px,');
    expect(selfLabel.style.transform).not.toContain('cqw');
    expect(selfLabel.style.transform).not.toContain('cqh');

    // Compact mobile typography keeps labels legible (>=10px) without Collisions at 375px
    const baristaLabel = screen.getByTestId('map-label-npc-npc_barista');
    expect(baristaLabel.className).toContain('max-sm:text-[10px]');

    // Right-edge Service Counter zone sign stays centered on desktop and shifts fully inward on mobile (<640px)
    const serviceCounterSign = screen.getByTestId('map-label-zone-service-counter');
    expect(serviceCounterSign.style.transform).toContain('translate(var(--label-anchor-x, -50%), -100%)');
    expect(serviceCounterSign.className).toContain('max-sm:[--label-anchor-x:-100%]');
  });

  it('anchors actor, patrolling NPC, and counter-staff chat bubbles at bottom origin so multi-line Vietnamese bubbles never overlap nameplates', () => {
    const dynamicLabels = buildDynamicStudyCafeMapLabels({
      topology: MAIN_LIBRARY_TOPOLOGY,
      selfNickname: 'Minh Hậu',
      selfUserId: 'u-self',
      selfPosition: { x: 12, y: 13 },
      characterState: 'FREE_ROAM',
      currentTableId: null,
      tableHostUserId: null,
      selectedDrinkId: null,
      studyGoal: '',
      studyGoalCompleted: false,
      remotePlayers: {},
      roomTables: [],
      liveFrame: {
        camera: { worldWidth: 768, worldHeight: 512, zoom: 1, scrollX: 0, scrollY: 0 },
        self: { worldX: 400, worldY: 432, bubbleText: 'Cùng ôn bài nhé!' },
        remotePlayers: [
          {
            userId: 'u-peer',
            labelText: 'Thảo Nguyên',
            isHost: false,
            worldX: 300,
            worldY: 300,
            alpha: 1,
            bubbleText: 'Giải tích phân xong chưa?',
          },
        ],
        npcs: [
          {
            npcId: 'npc_server',
            displayName: 'Phục vụ An',
            isCounterStaff: false,
            worldX: 500,
            worldY: 260,
            bubbleText: 'Nhớ uống nước và duỗi vai mỗi 25 phút học nhé 💧',
          },
          {
            npcId: 'npc_barista',
            displayName: 'Barista Minh',
            isCounterStaff: true,
            worldX: 560,
            worldY: 432,
            bubbleText: 'Cà phê rang mộc vừa pha xong thơm nức ☕',
          },
        ],
        sosBanners: [],
      },
    });

    const bubbles = dynamicLabels.filter((item) => item.kind === 'chat-bubble');
    expect(bubbles).toHaveLength(4);
    for (const bubble of bubbles) {
      expect(bubble.originY).toBe('bottom');
    }
    const baristaBubble = bubbles.find((item) => item.id === 'bubble-npc_barista');
    expect(baristaBubble?.worldY).toBe(432 - 68);
  });

  it('uses a fixed responsive grid height in CharacterCustomizerModal to prevent CLS across loading and tab switches on mobile & desktop', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => undefined) as Promise<Response>,
    );

    render(<CharacterCustomizerModal onClose={vi.fn()} />);
    const grid = screen.getByTestId('customizer-items-grid');
    expect(grid.className).toContain('h-[min(45dvh,280px)]');
    expect(grid.className).toContain('sm:h-[264px]');
  });

  it('adds mobile bottom clearance and desktop right clearance on ClassroomTelemetryBar so the Room Chat launcher never obscures telemetry cards', () => {
    render(<ClassroomTelemetryBar />);
    const bar = screen.getByTestId('classroom-telemetry-bar');
    expect(bar.className).toContain('pb-14');
    expect(bar.className).toContain('sm:pb-0');
    expect(bar.className).toContain('sm:pr-36');
  });

  it('uses standards-compliant autoComplete="off" on guest nickname input to avoid Chromium Audits warnings', () => {
    render(<GuestOnboardingModal backendStatus="UP" />);
    const nicknameInput = screen.getByLabelText(/Tên hiển thị/i);
    expect(nicknameInput).toHaveAttribute('autocomplete', 'off');
  });

  it('verifies complete CC0-1.0 0-cost provenance manifests and PNG dimensions for all public pixel-art atlases', async () => {
    const fs = await loadNodeFs();
    const expectedAtlases = [
      {
        dir: 'public/assets/tilesets',
        manifest: 'study-cafe-env.manifest.json',
        png: 'study-cafe-env.png',
        json: 'study-cafe-env.json',
        generator: '../scripts/generate-study-cafe-env-atlas.py',
      },
      {
        dir: 'public/assets/sprites',
        manifest: 'study-cafe-characters.manifest.json',
        png: 'study-cafe-characters.png',
        json: 'study-cafe-characters.json',
        generator: '../scripts/generate-study-cafe-characters-atlas.py',
      },
    ];

    for (const entry of expectedAtlases) {
      const files = fs.readdirSync(entry.dir).sort();
      expect(files).toEqual([entry.json, entry.manifest, entry.png].sort());
      expect(fs.existsSync(entry.generator)).toBe(true);

      const manifestData = JSON.parse(
        fs.readFileSync(`${entry.dir}/${entry.manifest}`).toString('utf8'),
      ) as {
        assets: Array<{
          dimensions: { width: number; height: number };
          source: { externalThirdPartyContent: boolean };
          license: { spdx: string; cost: string; repoSafe: boolean };
          technical_checks_passed: boolean;
        }>;
      };

      expect(manifestData.assets).toHaveLength(1);
      const asset = manifestData.assets[0];
      expect(asset.license.spdx).toBe('CC0-1.0');
      expect(asset.license.cost).toBe('0-cost');
      expect(asset.license.repoSafe).toBe(true);
      expect(asset.source.externalThirdPartyContent).toBe(false);
      expect(asset.technical_checks_passed).toBe(true);

      const pngBuf = fs.readFileSync(`${entry.dir}/${entry.png}`);
      expect(pngBuf.readUInt32BE(16)).toBe(asset.dimensions.width);
      expect(pngBuf.readUInt32BE(20)).toBe(asset.dimensions.height);
    }
  });
});
