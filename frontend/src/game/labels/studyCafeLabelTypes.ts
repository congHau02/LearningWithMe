import type { PopMotionSample } from '../fx/easingMotion';

export interface CameraProjectionState {
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

export interface ProjectedOverlayPoint {
  readonly leftPercent: number;
  readonly topPercent: number;
  readonly zoom: number;
  readonly inBounds: boolean;
}

export type StudyCafeLabelKind =
  | 'table-plaque'
  | 'zone-sign'
  | 'self-player'
  | 'remote-player'
  | 'ambient-npc'
  | 'chat-bubble'
  | 'sos-banner';

export interface StudyCafeProjectedLabelItem {
  readonly id: string;
  readonly testId: string;
  readonly kind: StudyCafeLabelKind;
  readonly text: string;
  readonly mobileText?: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly originY: 'top' | 'center' | 'bottom';
  readonly alpha: number;
  readonly scale: number;
  readonly isHost?: boolean;
}

export interface LiveSceneLabelFrame {
  readonly camera: CameraProjectionState;
  readonly self?: {
    readonly worldX: number;
    readonly worldY: number;
    readonly bubbleText: string | null;
    readonly bubbleMotion?: PopMotionSample;
  };
  readonly remotePlayers?: ReadonlyArray<{
    readonly userId: string;
    readonly labelText: string;
    readonly isHost: boolean;
    readonly worldX: number;
    readonly worldY: number;
    readonly alpha: number;
    readonly bubbleText: string | null;
    readonly bubbleMotion?: PopMotionSample;
  }>;
  readonly npcs?: ReadonlyArray<{
    readonly npcId: string;
    readonly displayName: string;
    readonly isCounterStaff: boolean;
    readonly worldX: number;
    readonly worldY: number;
    readonly bubbleText: string | null;
    readonly bubbleMotion?: PopMotionSample;
  }>;
  readonly sosBanners?: ReadonlyArray<{
    readonly tableId: string;
    readonly text: string;
    readonly worldX: number;
    readonly worldY: number;
    readonly alpha: number;
    readonly scale: number;
  }>;
}
