import type {
  FacingDirection,
  TileCoordinate,
} from '../topology/roomTopology';
import type { CharacterState } from '../../stores/useGameStore';
import type { SeatTransitionKind } from '../fx/seatTransitionJuice';

export type CharacterPosture = 'STANDING' | 'STEPPING' | 'SITTING' | 'STANDING_UP' | 'SEATED';

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
  skin_scholar_blazer: 'default_student',
  student_glasses: 'student_glasses',
  student_default_02: 'student_glasses',
  student_hoodie: 'student_hoodie',
  student_default_03: 'student_hoodie',
  skin_hoodie_blue: 'student_hoodie',
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
  private characterState: CharacterState = 'FREE_ROAM';
  private isMoving = false;
  private nickname: string;
  private avatarId: StarterAvatarKey;
  private skinId: string;
  private hatId: string;
  private deskPetId: string;

  constructor(options: {
    tileX: number;
    tileY: number;
    tileSize?: number;
    facingDir?: FacingDirection;
    nickname?: string;
    avatarId?: string;
    hatId?: string;
    deskPetId?: string;
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
    this.skinId = options.avatarId ?? 'default_student';
    this.avatarId = resolveAvatarTextureKey(this.skinId);
    this.hatId = options.hatId ?? 'hat_none';
    this.deskPetId = options.deskPetId ?? 'pet_sprout_pot';
  }

  public syncFromStore(state: {
    tileX: number;
    tileY: number;
    facingDir: FacingDirection;
    characterState: CharacterState;
    isMoving: boolean;
    isSeatTransitioning?: boolean;
    seatTransitionKind?: SeatTransitionKind;
    nickname?: string;
    avatarId?: string;
    hatId?: string;
    deskPetId?: string;
    snapImmediately?: boolean;
  }): void {
    this.tileX = state.tileX;
    this.tileY = state.tileY;
    this.facingDir = state.facingDir;
    this.characterState = state.characterState;
    this.isMoving = state.isMoving;
    if (state.nickname !== undefined) this.nickname = state.nickname;
    if (state.avatarId !== undefined) {
      this.skinId = state.avatarId;
      this.avatarId = resolveAvatarTextureKey(state.avatarId);
    }
    if (state.hatId !== undefined) this.hatId = state.hatId;
    if (state.deskPetId !== undefined) this.deskPetId = state.deskPetId;

    if (state.characterState === 'SEATED' && (state.snapImmediately ?? true)) {
      const center = tileToWorldCenter(this.tileX, this.tileY, this.tileSize);
      this.pixelX = center.x;
      this.pixelY = center.y;
    }

    const transitionKind: SeatTransitionKind =
      state.seatTransitionKind ??
      (state.isSeatTransitioning ? (state.characterState === 'SEATED' ? 'sit' : 'stand') : 'idle');
    this.setSeatTransitionKind(transitionKind);
  }

  public setSeatTransitionKind(kind: SeatTransitionKind): void {
    if (kind === 'sit') {
      this.posture = 'SITTING';
    } else if (kind === 'stand' && !this.isMoving) {
      this.posture = 'STANDING_UP';
    } else if (this.characterState === 'SEATED') {
      this.posture = 'SEATED';
    } else if (this.isMoving) {
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
    if (Math.abs(target.x - this.pixelX) < 0.5) this.pixelX = target.x;
    if (Math.abs(target.y - this.pixelY) < 0.5) this.pixelY = target.y;
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

  public getSkinId(): string {
    return this.skinId;
  }

  public getHatId(): string {
    return this.hatId;
  }

  public getDeskPetId(): string {
    return this.deskPetId;
  }
}
