import type { PopMotionSample } from '../fx/easingMotion';
import type { LiveSceneLabelFrame } from './studyCafeLabelTypes';

const qCoord = (value: number): number => Math.round(value * 2) / 2;
const qUnit = (value: number): number => Math.round(value * 100) / 100;

function quantizeMotion(
  text: string | null,
  motion?: PopMotionSample,
): PopMotionSample | undefined {
  if (!text || !motion) return undefined;
  return {
    scale: qUnit(motion.scale),
    alpha: qUnit(motion.alpha),
    offsetY: qCoord(motion.offsetY),
  };
}

function sameMotion(a?: PopMotionSample, b?: PopMotionSample): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.scale === b.scale && a.alpha === b.alpha && a.offsetY === b.offsetY;
}

function sameList<T>(
  a: readonly T[] | undefined,
  b: readonly T[] | undefined,
  eq: (x: T, y: T) => boolean,
): boolean {
  const listA = a ?? [];
  const listB = b ?? [];
  if (listA.length !== listB.length) return false;
  for (let i = 0; i < listA.length; i += 1) {
    if (!eq(listA[i], listB[i])) return false;
  }
  return true;
}

export function quantizeLiveSceneLabelFrame(frame: LiveSceneLabelFrame): LiveSceneLabelFrame {
  return {
    camera: {
      worldWidth: frame.camera.worldWidth,
      worldHeight: frame.camera.worldHeight,
      zoom: frame.camera.zoom,
      scrollX: qCoord(frame.camera.scrollX),
      scrollY: qCoord(frame.camera.scrollY),
    },
    self: frame.self
      ? {
          worldX: qCoord(frame.self.worldX),
          worldY: qCoord(frame.self.worldY),
          bubbleText: frame.self.bubbleText,
          bubbleMotion: quantizeMotion(frame.self.bubbleText, frame.self.bubbleMotion),
        }
      : undefined,
    remotePlayers: frame.remotePlayers?.map((p) => ({
      userId: p.userId,
      labelText: p.labelText,
      isHost: p.isHost,
      worldX: qCoord(p.worldX),
      worldY: qCoord(p.worldY),
      alpha: qUnit(p.alpha),
      bubbleText: p.bubbleText,
      bubbleMotion: quantizeMotion(p.bubbleText, p.bubbleMotion),
    })),
    npcs: frame.npcs?.map((n) => ({
      npcId: n.npcId,
      displayName: n.displayName,
      isCounterStaff: n.isCounterStaff,
      worldX: qCoord(n.worldX),
      worldY: qCoord(n.worldY),
      bubbleText: n.bubbleText,
      bubbleMotion: quantizeMotion(n.bubbleText, n.bubbleMotion),
    })),
    sosBanners: frame.sosBanners?.map((s) => ({
      tableId: s.tableId,
      text: s.text,
      worldX: qCoord(s.worldX),
      worldY: qCoord(s.worldY),
      alpha: qUnit(s.alpha),
      scale: qUnit(s.scale),
    })),
  };
}

export function areLiveSceneLabelFramesEqual(
  a: LiveSceneLabelFrame | null,
  b: LiveSceneLabelFrame | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.camera.worldWidth !== b.camera.worldWidth ||
    a.camera.worldHeight !== b.camera.worldHeight ||
    a.camera.zoom !== b.camera.zoom ||
    a.camera.scrollX !== b.camera.scrollX ||
    a.camera.scrollY !== b.camera.scrollY
  ) {
    return false;
  }
  if (Boolean(a.self) !== Boolean(b.self)) return false;
  if (
    a.self &&
    b.self &&
    (a.self.worldX !== b.self.worldX ||
      a.self.worldY !== b.self.worldY ||
      a.self.bubbleText !== b.self.bubbleText ||
      !sameMotion(a.self.bubbleMotion, b.self.bubbleMotion))
  ) {
    return false;
  }
  return (
    sameList(a.remotePlayers, b.remotePlayers, (x, y) =>
      x.userId === y.userId &&
      x.labelText === y.labelText &&
      x.isHost === y.isHost &&
      x.worldX === y.worldX &&
      x.worldY === y.worldY &&
      x.alpha === y.alpha &&
      x.bubbleText === y.bubbleText &&
      sameMotion(x.bubbleMotion, y.bubbleMotion),
    ) &&
    sameList(a.npcs, b.npcs, (x, y) =>
      x.npcId === y.npcId &&
      x.displayName === y.displayName &&
      x.isCounterStaff === y.isCounterStaff &&
      x.worldX === y.worldX &&
      x.worldY === y.worldY &&
      x.bubbleText === y.bubbleText &&
      sameMotion(x.bubbleMotion, y.bubbleMotion),
    ) &&
    sameList(a.sosBanners, b.sosBanners, (x, y) =>
      x.tableId === y.tableId &&
      x.text === y.text &&
      x.worldX === y.worldX &&
      x.worldY === y.worldY &&
      x.alpha === y.alpha &&
      x.scale === y.scale,
    )
  );
}

export function hasDiscreteLabelFrameChange(
  prev: LiveSceneLabelFrame | null,
  next: LiveSceneLabelFrame,
): boolean {
  if (!prev) return true;
  if (prev.camera.zoom !== next.camera.zoom) return true;
  if ((prev.self?.bubbleText ?? null) !== (next.self?.bubbleText ?? null)) return true;
  return (
    !sameList(prev.remotePlayers, next.remotePlayers, (x, y) =>
      x.userId === y.userId &&
      x.labelText === y.labelText &&
      x.isHost === y.isHost &&
      x.bubbleText === y.bubbleText,
    ) ||
    !sameList(prev.npcs, next.npcs, (x, y) => x.npcId === y.npcId && x.bubbleText === y.bubbleText) ||
    !sameList(prev.sosBanners, next.sosBanners, (x, y) => x.tableId === y.tableId && x.text === y.text)
  );
}
