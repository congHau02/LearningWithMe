import Phaser from 'phaser';
import type { RoomTableSummary } from '../../services/roomApi';
import type { RoomTopology, TableMetadata } from '../topology/roomTopology';

interface TableAnchor {
  tableId: string;
  cx: number;
  topY: number;
}

export class TableSosOverlay {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly anchors: TableAnchor[];
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly activeTableIds = new Set<string>();

  constructor(scene: Phaser.Scene, topology: RoomTopology) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(15);
    this.anchors = topology.tables
      .map((table) => computeTableAnchor(table, topology.tileSize))
      .filter((anchor): anchor is TableAnchor => anchor !== null);
  }

  public update(roomTables: RoomTableSummary[], time: number): void {
    this.graphics.clear();
    this.activeTableIds.clear();

    const summaryById = new Map<string, RoomTableSummary>();
    for (const summary of roomTables) {
      summaryById.set(summary.tableId, summary);
    }

    const pulse = 0.55 + 0.35 * Math.sin(time / 220);

    for (const anchor of this.anchors) {
      const summary = summaryById.get(anchor.tableId);
      const topic = summary?.sosBanner?.trim() || null;

      if (!topic) {
        const existing = this.labels.get(anchor.tableId);
        if (existing) {
          existing.setVisible(false);
        }
        continue;
      }

      this.activeTableIds.add(anchor.tableId);

      let label = this.labels.get(anchor.tableId);
      const displayTopic = topic.length > 26 ? `${topic.slice(0, 25)}…` : topic;
      const text = `🆘 ${displayTopic}`;

      if (!label) {
        label = this.scene.add
          .text(anchor.cx, anchor.topY - 12, text, {
            fontFamily: 'sans-serif',
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#fef3c7',
            backgroundColor: '#78350fee',
            padding: { x: 6, y: 3 },
          })
          .setOrigin(0.5, 1)
          .setDepth(16);
        this.labels.set(anchor.tableId, label);
      } else {
        label.setText(text);
        label.setPosition(anchor.cx, anchor.topY - 12);
        label.setVisible(true);
      }

      const width = Math.max(64, (label.width || text.length * 6) + 10);
      const height = (label.height || 18) + 6;
      const boxX = anchor.cx - width / 2;
      const boxY = anchor.topY - 12 - height + 3;

      this.graphics.fillStyle(0xf59e0b, pulse * 0.28);
      this.graphics.fillRoundedRect(boxX - 4, boxY - 4, width + 8, height + 8, 9);
      this.graphics.lineStyle(2, 0xfbbf24, 0.5 + pulse * 0.45);
      this.graphics.strokeRoundedRect(boxX - 1, boxY - 1, width + 2, height + 2, 7);
    }
  }

  public getActiveSosTableIds(): string[] {
    return Array.from(this.activeTableIds);
  }

  public destroy(): void {
    this.graphics.destroy();
    for (const label of this.labels.values()) {
      label.destroy();
    }
    this.labels.clear();
    this.activeTableIds.clear();
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
