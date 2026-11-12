import type {
  FacingDirection,
  TileCoordinate,
} from '../topology/roomTopology';
import type { CharacterState } from '../../stores/useGameStore';

export type CharacterPosture = 'STANDING' | 'STEPPING' | 'SEATED';

export type StarterAvatarKey =
  | 'default_student'
  | 'student_glasses'
  | 'student_hoodie'
  | 'student_sprout';

export const STARTER_AVATAR_KEYS: readonly StarterAvatarKey[] = [
  'default_student',
  'student_glasses',
  'student_hoodie',
  'student_sprout',
];

const LEGACY_AVATAR_ALIASES: Readonly<Record<string, StarterAvatarKey>> = {
  default_student: 'default_student',
  student_default_01: 'default_student',
  student_glasses: 'student_glasses',
  student_default_02: 'student_glasses',
  student_hoodie: 'student_hoodie',
  student_default_03: 'student_hoodie',
  student_sprout: 'student_sprout',
  student_default_04: 'student_sprout',
};

export function resolveAvatarTextureKey(avatarId: string): StarterAvatarKey {
  return LEGACY_AVATAR_ALIASES[avatarId] ?? 'default_student';
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
  private avatarId: StarterAvatarKey;

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
    this.posture = 'STANDING';
    this.nickname = options.nickname ?? 'Khách học';
    this.avatarId = resolveAvatarTextureKey(options.avatarId ?? 'default_student');
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
      this.avatarId = resolveAvatarTextureKey(state.avatarId);
    }

    if (state.characterState === 'SEATED') {
      this.posture = 'SEATED';
      const center = tileToWorldCenter(this.tileX, this.tileY, this.tileSize);
      this.pixelX = center.x;
      this.pixelY = center.y;
    } else if (state.isMoving) {
      this.posture = 'STEPPING';
    } else {
      this.posture = 'STANDING';
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

  public getAvatarId(): StarterAvatarKey {
    return this.avatarId;
  }
}
