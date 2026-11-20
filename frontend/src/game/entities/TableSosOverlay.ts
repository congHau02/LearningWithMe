import Phaser from 'phaser';
import type { RoomTableSummary } from '../../services/roomApi';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import { computePopMotion } from '../fx/easingMotion';
import type { RoomTopology, TableMetadata } from '../topology/roomTopology';

interface TableAnchor {
  tableId: string;
  cx: number;
  topY: number;
}

export type SosBannerMotionPhase = 'hidden' | 'in' | 'steady' | 'out';

export interface SosBannerMotionState {
  readonly phase: SosBannerMotionPhase;
  readonly scale: number;
  readonly alpha: number;
  readonly offsetY: number;
}

interface TableBannerRuntime {
  phase: SosBannerMotionPhase;
  phaseStartedAt: number;
  lastText: string;
  motion: SosBannerMotionState;
}

const SOS_POP_IN_MS = 200;
const SOS_POP_OUT_MS = 160;
const HIDDEN_STATE: SosBannerMotionState = { phase: 'hidden', scale: 1, alpha: 0, offsetY: 0 };

export class TableSosOverlay {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly anchors: TableAnchor[];
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly runtimeByTable = new Map<string, TableBannerRuntime>();
  private readonly activeTableIds = new Set<string>();

  constructor(scene: Phaser.Scene, topology: RoomTopology) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(15);
    this.anchors = topology.tables
      .map((table) => computeTableAnchor(table, topology.tileSize))
      .filter((anchor): anchor is TableAnchor => anchor !== null);
  }

  public update(
    roomTables: RoomTableSummary[],
    time: number,
    prefersReducedMotion = useStudyCafeDisplayStore.getState().prefersReducedMotion,
  ): void {
    this.graphics.clear();
    this.activeTableIds.clear();

    const summaryById = new Map<string, RoomTableSummary>();
    for (const summary of roomTables) {
      summaryById.set(summary.tableId, summary);
    }

    const pulse = prefersReducedMotion ? 0.7 : 0.55 + 0.35 * Math.sin(time / 220);

    for (const anchor of this.anchors) {
      const summary = summaryById.get(anchor.tableId);
      const topic = summary?.sosBanner?.trim() || null;
      const runtime = this.stepBannerRuntime(anchor.tableId, topic, time, prefersReducedMotion);

      if (runtime.phase === 'hidden') {
        this.labels.get(anchor.tableId)?.setVisible(false);
        continue;
      }

      if (topic) {
        this.activeTableIds.add(anchor.tableId);
      }

      const text = runtime.lastText;
      const label = this.ensureLabel(anchor, text);
      const { scale, alpha, offsetY } = runtime.motion;
      const anchorY = anchor.topY - 12 + offsetY;

      label.setText(text);
      label.setPosition(anchor.cx, anchorY);
      label.setScale?.(scale);
      label.setAlpha?.(alpha);
      label.setVisible(true);

      const width = Math.max(64, (label.width || text.length * 6) + 10) * scale;
      const height = ((label.height || 18) + 6) * scale;
      const boxX = anchor.cx - width / 2;
      const boxY = anchorY - height + 3;

      // Slate Leaf background with subtle luminous border (ADR-0010)
      this.graphics.fillStyle(BOTANICAL_2D_SCENE.tableSos.bgInt, Number((0.9 * alpha).toFixed(3)));
      this.graphics.fillRoundedRect(boxX - 4, boxY - 4, width + 8, height + 8, 9);
      this.graphics.lineStyle(
        1.5,
        BOTANICAL_2D_SCENE.tableSos.borderInt,
        Number(((0.5 + pulse * 0.45) * alpha).toFixed(3)),
      );
      this.graphics.strokeRoundedRect(boxX - 1, boxY - 1, width + 2, height + 2, 7);
    }
  }

  public getActiveSosTableIds(): string[] {
    return Array.from(this.activeTableIds);
  }

  public getBannerMotionState(tableId: string): SosBannerMotionState {
    return this.runtimeByTable.get(tableId)?.motion ?? HIDDEN_STATE;
  }

  public destroy(): void {
    this.graphics.destroy();
    for (const label of this.labels.values()) {
      label.destroy();
    }
    this.labels.clear();
    this.runtimeByTable.clear();
    this.activeTableIds.clear();
  }

  private ensureLabel(anchor: TableAnchor, text: string): Phaser.GameObjects.Text {
    let label = this.labels.get(anchor.tableId);
    if (!label) {
      label = this.scene.add
        .text(anchor.cx, anchor.topY - 12, text, {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: BOTANICAL_2D_SCENE.tableSos.textColor,
          backgroundColor: BOTANICAL_2D_SCENE.tableSos.textBg,
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setDepth(16);
      this.labels.set(anchor.tableId, label);
    }
    return label;
  }

  private stepBannerRuntime(
    tableId: string,
    topic: string | null,
    time: number,
    prefersReducedMotion: boolean,
  ): TableBannerRuntime {
    let runtime = this.runtimeByTable.get(tableId);
    if (!runtime) {
      runtime = { phase: 'hidden', phaseStartedAt: time, lastText: '', motion: HIDDEN_STATE };
      this.runtimeByTable.set(tableId, runtime);
    }

    if (topic) {
      const displayTopic = topic.length > 26 ? `${topic.slice(0, 25)}…` : topic;
      runtime.lastText = `🆘 ${displayTopic}`;

      if (prefersReducedMotion) {
        runtime.phase = 'steady';
        runtime.motion = { phase: 'steady', scale: 1, alpha: 1, offsetY: 0 };
        return runtime;
      }

      if (runtime.phase === 'hidden' || runtime.phase === 'out') {
        runtime.phase = 'in';
        runtime.phaseStartedAt = time;
      }

      if (runtime.phase === 'in') {
        const elapsed = Math.max(0, time - runtime.phaseStartedAt);
        if (elapsed >= SOS_POP_IN_MS) {
          runtime.phase = 'steady';
          runtime.motion = { phase: 'steady', scale: 1, alpha: 1, offsetY: 0 };
        } else {
          const sample = computePopMotion(elapsed, SOS_POP_IN_MS, 'in', false);
          runtime.motion = { phase: 'in', ...sample };
        }
      } else {
        runtime.motion = { phase: 'steady', scale: 1, alpha: 1, offsetY: 0 };
      }
      return runtime;
    }

    // Topic cleared -> transition out or hide immediately on reduced motion
    if (runtime.phase === 'hidden' || prefersReducedMotion) {
      runtime.phase = 'hidden';
      runtime.motion = HIDDEN_STATE;
      return runtime;
    }

    if (runtime.phase !== 'out') {
      runtime.phase = 'out';
      runtime.phaseStartedAt = time;
    }

    const elapsed = Math.max(0, time - runtime.phaseStartedAt);
    if (elapsed >= SOS_POP_OUT_MS) {
      runtime.phase = 'hidden';
      runtime.motion = HIDDEN_STATE;
    } else {
      const sample = computePopMotion(elapsed, SOS_POP_OUT_MS, 'out', false);
      runtime.motion = { phase: 'out', ...sample };
    }
    return runtime;
  }
}

function computeTableAnchor(table: TableMetadata, tileSize: number): TableAnchor | null {
  const tiles =
    table.obstacleTiles.length > 0
      ? table.obstacleTiles
      : table.seats.map((s) => ({ tileX: s.tileX, tileY: s.tileY }));
  if (tiles.length === 0) return null;

  const xs = tiles.map((t) => t.tileX);
  const ys = tiles.map((t) => t.tileY);
  const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * tileSize;
  const topY = Math.min(...ys) * tileSize;
  return { tableId: table.tableId, cx, topY };
}
