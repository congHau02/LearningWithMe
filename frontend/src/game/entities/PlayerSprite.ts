import type {
  FacingDirection,
  TileCoordinate,
} from '../topology/roomTopology';
import type { CharacterState } from '../../stores/useGameStore';

export type CharacterPosture = 'IDLE' | 'WALKING' | 'SEATED';

export interface AvatarPalette {
  id: string;
  shirtColor: number;
  hairColor: number;
  skinColor: number;
  accentColor: number;
}

export const AVATAR_PALETTES: Readonly<Record<string, AvatarPalette>> = {
  default_student: {
    id: 'default_student',
    shirtColor: 0x38bdf8,
    hairColor: 0x1e293b,
    skinColor: 0xf6d2b5,
    accentColor: 0x0284c7,
  },
  student_default_01: {
    id: 'student_default_01',
    shirtColor: 0x38bdf8,
    hairColor: 0x1e293b,
    skinColor: 0xf6d2b5,
    accentColor: 0x0284c7,
  },
  student_glasses: {
    id: 'student_glasses',
    shirtColor: 0x34d399,
    hairColor: 0x3f2e21,
    skinColor: 0xf4c7a1,
    accentColor: 0xe2e8f0,
  },
  student_default_02: {
    id: 'student_default_02',
    shirtColor: 0x34d399,
    hairColor: 0x3f2e21,
    skinColor: 0xf4c7a1,
    accentColor: 0xe2e8f0,
  },
  student_hoodie: {
    id: 'student_hoodie',
    shirtColor: 0xf59e0b,
    hairColor: 0x0f172a,
    skinColor: 0xeab892,
    accentColor: 0x38bdf8,
  },
  student_default_03: {
    id: 'student_default_03',
    shirtColor: 0xf59e0b,
    hairColor: 0x0f172a,
    skinColor: 0xeab892,
    accentColor: 0x38bdf8,
  },
  student_sprout: {
    id: 'student_sprout',
    shirtColor: 0x2dd4bf,
    hairColor: 0x4a3525,
    skinColor: 0xf7d5ba,
    accentColor: 0x4ade80,
  },
  student_default_04: {
    id: 'student_default_04',
    shirtColor: 0x2dd4bf,
    hairColor: 0x4a3525,
    skinColor: 0xf7d5ba,
    accentColor: 0x4ade80,
  },
};

export function resolveAvatarPalette(avatarId: string): AvatarPalette {
  return AVATAR_PALETTES[avatarId] ?? AVATAR_PALETTES.default_student;
}

export function tileToWorldCenter(
  tileX: number,
  tileY: number,
  tileSize = 32,
): { x: number; y: number } {
  return {
    x: tileX * tileSize + tileSize / 2,
    y: tileY * tileSize + tileSize / 2,
  };
}

export class PlayerSprite {
  private tileX: number;
  private tileY: number;
  private pixelX: number;
  private pixelY: number;
  private readonly tileSize: number;
  private facingDir: FacingDirection;
  private posture: CharacterPosture;
  private nickname: string;
  private avatarId: string;
  private walkFrame = 0;

  constructor(options: {
    tileX: number;
    tileY: number;
    tileSize?: number;
    facingDir?: FacingDirection;
    nickname?: string;
    avatarId?: string;
  }) {
    this.tileSize = options.tileSize ?? 32;
    this.tileX = options.tileX;
    this.tileY = options.tileY;
    const center = tileToWorldCenter(this.tileX, this.tileY, this.tileSize);
    this.pixelX = center.x;
    this.pixelY = center.y;
    this.facingDir = options.facingDir ?? 'DOWN';
    this.posture = 'IDLE';
    this.nickname = options.nickname ?? 'Khách học';
    this.avatarId = options.avatarId ?? 'default_student';
  }

  public syncFromStore(state: {
    tileX: number;
    tileY: number;
    facingDir: FacingDirection;
    characterState: CharacterState;
    isMoving: boolean;
    nickname?: string;
    avatarId?: string;
  }): void {
    this.tileX = state.tileX;
    this.tileY = state.tileY;
    this.facingDir = state.facingDir;
    if (state.nickname !== undefined) {
      this.nickname = state.nickname;
    }
    if (state.avatarId !== undefined) {
      this.avatarId = state.avatarId;
    }

    if (state.characterState === 'SEATED') {
      this.posture = 'SEATED';
      const center = tileToWorldCenter(this.tileX, this.tileY, this.tileSize);
      this.pixelX = center.x;
      this.pixelY = center.y;
      this.walkFrame = 0;
    } else if (state.isMoving) {
      this.posture = 'WALKING';
      this.walkFrame = (this.walkFrame + 1) % 4;
    } else {
      this.posture = 'IDLE';
      this.walkFrame = 0;
    }
  }

  public interpolatePosition(lerpFactor = 0.35): { x: number; y: number } {
    const target = tileToWorldCenter(this.tileX, this.tileY, this.tileSize);
    const clampedFactor = Math.max(0, Math.min(1, lerpFactor));
    this.pixelX += (target.x - this.pixelX) * clampedFactor;
    this.pixelY += (target.y - this.pixelY) * clampedFactor;
    if (Math.abs(target.x - this.pixelX) < 0.5) {
      this.pixelX = target.x;
    }
    if (Math.abs(target.y - this.pixelY) < 0.5) {
      this.pixelY = target.y;
    }
    return { x: this.pixelX, y: this.pixelY };
  }

  public getGridCoordinate(): TileCoordinate {
    return { tileX: this.tileX, tileY: this.tileY };
  }

  public getPixelPosition(): { x: number; y: number } {
    return { x: this.pixelX, y: this.pixelY };
  }

  public getFacingDir(): FacingDirection {
    return this.facingDir;
  }

  public getPosture(): CharacterPosture {
    return this.posture;
  }

  public getAnimationKey(): string {
    return `${this.avatarId}:${this.posture.toLowerCase()}:${this.facingDir.toLowerCase()}`;
  }

  public getNickname(): string {
    return this.nickname;
  }

  public getAvatarId(): string {
    return this.avatarId;
  }

  public getWalkFrame(): number {
    return this.walkFrame;
  }
}
