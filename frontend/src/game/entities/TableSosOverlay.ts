import type Phaser from 'phaser';
import type { RoomTableSummary } from '../../services/roomApi';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { computeTileBounds } from '../atlas/bakedStaticRoomLayer';
import { computePopMotion } from '../fx/easingMotion';
import { formatSosBannerLabel } from '../scenes/ySortDepth';
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

/**
 * Tracks active table SOS banners and their pop-in/out motion curves for crisp
 * DOM projection by StudyCafeMapLabelsOverlay without hidden Phaser text shells.
 */
export class TableSosOverlay {
  private readonly anchors: TableAnchor[];
  private readonly runtimeByTable = new Map<string, TableBannerRuntime>();
  private readonly activeTableIds = new Set<string>();

  constructor(_scene: Phaser.Scene | undefined, topology: RoomTopology) {
    this.anchors = topology.tables
      .map((table) => computeTableAnchor(table, topology.tileSize))
      .filter((anchor): anchor is TableAnchor => anchor !== null);
  }

  public update(
    roomTables: RoomTableSummary[],
    time: number,
    prefersReducedMotion = useStudyCafeDisplayStore.getState().prefersReducedMotion,
  ): void {
    this.activeTableIds.clear();

    const summaryById = new Map<string, RoomTableSummary>();
    for (const summary of roomTables) {
      summaryById.set(summary.tableId, summary);
    }

    for (const anchor of this.anchors) {
      const summary = summaryById.get(anchor.tableId);
      const topic = summary?.sosBanner?.trim() || null;
      const runtime = this.stepBannerRuntime(anchor.tableId, topic, time, prefersReducedMotion);

      if (runtime.phase !== 'hidden' && topic) {
        this.activeTableIds.add(anchor.tableId);
      }
    }
  }

  public getActiveSosTableIds(): string[] {
    return Array.from(this.activeTableIds);
  }

  public getBannerMotionState(tableId: string): SosBannerMotionState {
    return this.runtimeByTable.get(tableId)?.motion ?? HIDDEN_STATE;
  }

  public getLabelEntries() {
    const entries: Array<{
      tableId: string;
      text: string;
      worldX: number;
      worldY: number;
      alpha: number;
      scale: number;
    }> = [];
    for (const anchor of this.anchors) {
      const runtime = this.runtimeByTable.get(anchor.tableId);
      if (!runtime || runtime.phase === 'hidden' || !runtime.lastText) continue;
      entries.push({
        tableId: anchor.tableId,
        text: runtime.lastText,
        worldX: anchor.cx,
        worldY: anchor.topY - 12 + runtime.motion.offsetY,
        alpha: runtime.motion.alpha,
        scale: runtime.motion.scale,
      });
    }
    return entries;
  }

  public destroy(): void {
    this.runtimeByTable.clear();
    this.activeTableIds.clear();
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
      runtime.lastText = formatSosBannerLabel(topic);

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

  const bounds = computeTileBounds(tiles);
  const cx = ((bounds.minX + bounds.maxX + 1) / 2) * tileSize;
  const topY = bounds.minY * tileSize;
  return { tableId: table.tableId, cx, topY };
}
