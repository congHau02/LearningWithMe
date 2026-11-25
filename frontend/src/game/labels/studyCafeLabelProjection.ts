import type { RoomPlayerDto, RoomTableSummary } from '../../services/roomApi';
import { computeTileBounds } from '../atlas/bakedStaticRoomLayer';
import {
  AMBIENT_NPC_DEFINITIONS,
  SERVICE_COUNTER_TILES,
  formatSelfCharacterLabel,
} from '../cafe/studyCafeConfig';
import { tileToWorldCenter } from '../entities/PlayerSprite';
import { formatRemoteLabel, isPlayerTableHost } from '../entities/remotePlayerEntryHelper';
import { clampCameraZoom } from '../scenes/classroomCameraController';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  ACTOR_LABEL_OFFSET_Y,
  COUNTER_STAFF_BUBBLE_OFFSET_Y,
  COUNTER_STAFF_LABEL_OFFSET_Y,
  formatSosBannerLabel,
  formatTablePlaqueLabel,
} from '../scenes/ySortDepth';
import { MAIN_LIBRARY_TOPOLOGY, type RoomTopology } from '../topology/roomTopology';
import type {
  CameraProjectionState,
  LiveSceneLabelFrame,
  ProjectedOverlayPoint,
  StudyCafeProjectedLabelItem,
} from './studyCafeLabelTypes';

export type {
  CameraProjectionState,
  LiveSceneLabelFrame,
  ProjectedOverlayPoint,
  StudyCafeLabelKind,
  StudyCafeProjectedLabelItem,
} from './studyCafeLabelTypes';

export function projectWorldPointToOverlay(
  worldX: number,
  worldY: number,
  camera: CameraProjectionState,
): ProjectedOverlayPoint {
  const worldWidth = camera.worldWidth > 0 ? camera.worldWidth : 768;
  const worldHeight = camera.worldHeight > 0 ? camera.worldHeight : 512;
  const zoom = clampCameraZoom(camera.zoom);
  const centerX = worldWidth / 2;
  const centerY = worldHeight / 2;
  const screenX = (worldX - camera.scrollX - centerX) * zoom + centerX;
  const screenY = (worldY - camera.scrollY - centerY) * zoom + centerY;
  const leftPercent = Number(((screenX / worldWidth) * 100).toFixed(4));
  const topPercent = Number(((screenY / worldHeight) * 100).toFixed(4));

  return {
    leftPercent,
    topPercent,
    zoom,
    inBounds: leftPercent >= -8 && leftPercent <= 108 && topPercent >= -8 && topPercent <= 108,
  };
}

export function computeCameraScrollForFollow(options: {
  worldWidth: number;
  worldHeight: number;
  zoom: number;
  followEnabled: boolean;
  targetX: number;
  targetY: number;
}): { scrollX: number; scrollY: number } {
  const { worldWidth, worldHeight, zoom, followEnabled, targetX, targetY } = options;
  const clampedZoom = clampCameraZoom(zoom);
  if (!followEnabled || clampedZoom <= 1) return { scrollX: 0, scrollY: 0 };
  const halfViewW = worldWidth / (2 * clampedZoom);
  const halfViewH = worldHeight / (2 * clampedZoom);
  return {
    scrollX: Math.max(halfViewW, Math.min(worldWidth - halfViewW, targetX)) - worldWidth / 2,
    scrollY: Math.max(halfViewH, Math.min(worldHeight - halfViewH, targetY)) - worldHeight / 2,
  };
}

export function buildStaticStudyCafeMapLabels(
  topology: RoomTopology = MAIN_LIBRARY_TOPOLOGY,
): StudyCafeProjectedLabelItem[] {
  const ts = topology.tileSize;
  const items: StudyCafeProjectedLabelItem[] = [];

  topology.tables.forEach((table, index) => {
    if (table.obstacleTiles.length === 0) return;
    const b = computeTileBounds(table.obstacleTiles);
    items.push({
      id: `table-${table.tableId}`, testId: `map-label-table-${table.tableId}`,
      kind: 'table-plaque', text: formatTablePlaqueLabel(table.tableId, index),
      worldX: b.minX * ts + 22, worldY: b.minY * ts + 1,
      originY: 'center', alpha: 1, scale: 1,
    });
  });

  if (topology.afkZone.length > 0) {
    const b = computeTileBounds(topology.afkZone);
    items.push({
      id: 'zone-chill-lounge', testId: 'map-label-zone-chill-lounge',
      kind: 'zone-sign', text: '🛋️ Chill Lounge (AFK)',
      worldX: ((b.minX + b.maxX + 1) / 2) * ts, worldY: b.minY * ts - 6,
      originY: 'bottom', alpha: 1, scale: 1,
    });
  }

  if (SERVICE_COUNTER_TILES.length > 0) {
    const b = computeTileBounds(SERVICE_COUNTER_TILES);
    items.push({
      id: 'zone-service-counter', testId: 'map-label-zone-service-counter',
      kind: 'zone-sign', text: '☕ Quầy Study Café • Bấm chọn đồ uống',
      mobileText: '☕ Quầy Study Café',
      worldX: ((b.minX + b.maxX + 1) / 2) * ts, worldY: b.minY * ts - 6,
      originY: 'bottom', alpha: 1, scale: 1,
    });
  }

  return items;
}

export function buildDynamicStudyCafeMapLabels(options: {
  topology?: RoomTopology;
  selfNickname: string;
  selfUserId: string | null;
  selfPosition: { x: number; y: number };
  characterState: 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED';
  currentTableId: string | null;
  tableHostUserId: string | null;
  selectedDrinkId: string | null;
  studyGoal: string;
  studyGoalCompleted: boolean;
  remotePlayers: Record<string, RoomPlayerDto>;
  roomTables: RoomTableSummary[];
  liveFrame?: LiveSceneLabelFrame | null;
}): StudyCafeProjectedLabelItem[] {
  const topology = options.topology ?? MAIN_LIBRARY_TOPOLOGY;
  const ts = topology.tileSize;
  const items: StudyCafeProjectedLabelItem[] = [];
  const live = options.liveFrame;

  const selfDefaultPos = tileToWorldCenter(options.selfPosition.x, options.selfPosition.y, ts);
  const selfWorldX = live?.self?.worldX ?? selfDefaultPos.x;
  const selfWorldY = live?.self?.worldY ?? selfDefaultPos.y;
  const isSelfHost =
    options.characterState === 'SEATED' &&
    Boolean(
      options.currentTableId &&
        ((options.tableHostUserId && options.tableHostUserId === options.selfUserId) ||
          options.roomTables.some((t) => t.tableId === options.currentTableId && t.hostUserId === options.selfUserId)),
    );

  items.push({
    id: 'self-player', testId: 'map-label-self-player', kind: 'self-player',
    text: formatSelfCharacterLabel({
      nickname: options.selfNickname || 'Khách học', isHost: isSelfHost,
      isSeated: options.characterState === 'SEATED', drinkId: options.selectedDrinkId,
      studyGoal: options.studyGoal, studyGoalCompleted: options.studyGoalCompleted,
    }),
    worldX: selfWorldX, worldY: selfWorldY + ACTOR_LABEL_OFFSET_Y,
    originY: 'bottom', alpha: 1, scale: 1, isHost: isSelfHost,
  });

  if (live?.self?.bubbleText) {
    const motion = live.self.bubbleMotion;
    items.push({
      id: 'bubble-self', testId: 'map-label-bubble-self', kind: 'chat-bubble',
      text: live.self.bubbleText, worldX: selfWorldX,
      worldY: selfWorldY + ACTOR_BUBBLE_OFFSET_Y + (motion?.offsetY ?? 0),
      originY: 'bottom', alpha: motion?.alpha ?? 1, scale: motion?.scale ?? 1,
    });
  }

  const remoteEntries = live?.remotePlayers ?? Object.values(options.remotePlayers).map((player) => {
    const pos = tileToWorldCenter(player.x, player.y, ts);
    const isHost = isPlayerTableHost(player);
    return {
      userId: player.userId, labelText: formatRemoteLabel(player, isHost), isHost,
      worldX: pos.x, worldY: pos.y, alpha: player.connected ? 1 : 0.55,
      bubbleText: null, bubbleMotion: undefined,
    };
  });

  for (const rp of remoteEntries) {
    items.push({
      id: `remote-${rp.userId}`, testId: `map-label-remote-${rp.userId}`, kind: 'remote-player',
      text: rp.labelText, worldX: rp.worldX, worldY: rp.worldY + ACTOR_LABEL_OFFSET_Y,
      originY: 'bottom', alpha: rp.alpha, scale: 1, isHost: rp.isHost,
    });
    if (rp.bubbleText) {
      items.push({
        id: `bubble-${rp.userId}`, testId: `map-label-bubble-${rp.userId}`, kind: 'chat-bubble',
        text: rp.bubbleText, worldX: rp.worldX,
        worldY: rp.worldY + ACTOR_BUBBLE_OFFSET_Y + (rp.bubbleMotion?.offsetY ?? 0),
        originY: 'bottom', alpha: rp.bubbleMotion?.alpha ?? 1, scale: rp.bubbleMotion?.scale ?? 1,
      });
    }
  }

  const npcEntries = live?.npcs ?? AMBIENT_NPC_DEFINITIONS.filter((d) => d.waypoints.length > 0).map((def) => {
    const pos = tileToWorldCenter(def.waypoints[0].tileX, def.waypoints[0].tileY, ts);
    return {
      npcId: def.npcId, displayName: def.displayName,
      isCounterStaff: def.role === 'BARISTA' || def.role === 'CASHIER',
      worldX: pos.x, worldY: pos.y, bubbleText: null, bubbleMotion: undefined,
    };
  });

  for (const npc of npcEntries) {
    items.push({
      id: `npc-${npc.npcId}`, testId: `map-label-npc-${npc.npcId}`, kind: 'ambient-npc',
      text: npc.displayName, worldX: npc.worldX,
      worldY: npc.isCounterStaff ? npc.worldY + COUNTER_STAFF_LABEL_OFFSET_Y : npc.worldY + ACTOR_LABEL_OFFSET_Y,
      originY: npc.isCounterStaff ? 'top' : 'bottom', alpha: 1, scale: 1,
    });
    if (npc.bubbleText) {
      items.push({
        id: `bubble-${npc.npcId}`, testId: `map-label-bubble-${npc.npcId}`, kind: 'chat-bubble',
        text: npc.bubbleText, worldX: npc.worldX,
        worldY: (npc.isCounterStaff ? npc.worldY + COUNTER_STAFF_BUBBLE_OFFSET_Y : npc.worldY + ACTOR_BUBBLE_OFFSET_Y) + (npc.bubbleMotion?.offsetY ?? 0),
        originY: 'bottom', alpha: npc.bubbleMotion?.alpha ?? 1, scale: npc.bubbleMotion?.scale ?? 1,
      });
    }
  }

  for (const table of topology.tables) {
    const summary = options.roomTables.find((t) => t.tableId === table.tableId);
    if (summary?.isTableLocked && table.obstacleTiles.length > 0) {
      const b = computeTileBounds(table.obstacleTiles);
      items.push({
        id: `lock-${table.tableId}`, testId: `map-label-lock-${table.tableId}`, kind: 'table-lock',
        text: '🔒 Đã khóa', worldX: b.minX * ts + 64, worldY: b.minY * ts + 1,
        originY: 'center', alpha: 1, scale: 1,
      });
    }
  }

  const sosEntries = live?.sosBanners ?? topology.tables.flatMap((table) => {
    const topic = options.roomTables.find((t) => t.tableId === table.tableId)?.sosBanner?.trim();
    if (!topic || table.obstacleTiles.length === 0) return [];
    const b = computeTileBounds(table.obstacleTiles);
    return [{ tableId: table.tableId, text: formatSosBannerLabel(topic), worldX: ((b.minX + b.maxX + 1) / 2) * ts, worldY: b.minY * ts - 12, alpha: 1, scale: 1 }];
  });

  for (const sos of sosEntries) {
    items.push({ id: `sos-${sos.tableId}`, testId: `map-label-sos-${sos.tableId}`, kind: 'sos-banner', text: sos.text, worldX: sos.worldX, worldY: sos.worldY, originY: 'bottom', alpha: sos.alpha, scale: sos.scale });
  }

  return items;
}
