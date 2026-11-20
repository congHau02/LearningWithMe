import type { StarterAvatarKey } from '../entities/PlayerSprite';
import type { FacingDirection, TileCoordinate } from '../topology/roomTopology';

export interface VirtualDrinkOption {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  staffReply: string;
}

export interface AmbientNpcWaypoint {
  tileX: number;
  tileY: number;
  facingDir: FacingDirection;
  pauseMs: number;
}

export type AmbientNpcRole = 'BARISTA' | 'CASHIER' | 'SERVER';

export interface AmbientNpcDefinition {
  npcId: string;
  role: AmbientNpcRole;
  displayName: string;
  avatarKey: StarterAvatarKey;
  waypoints: readonly AmbientNpcWaypoint[];
  ambientLines: readonly string[];
  greetingLine: string;
  bubbleIntervalMs: number;
  initialBubbleDelayMs: number;
}

export const SERVICE_COUNTER_TILES: readonly TileCoordinate[] = [
  { tileX: 16, tileY: 12 },
  { tileX: 17, tileY: 12 },
  { tileX: 18, tileY: 12 },
  { tileX: 19, tileY: 12 },
  { tileX: 20, tileY: 12 },
];

export function isServiceCounterTile(tileX: number, tileY: number): boolean {
  return SERVICE_COUNTER_TILES.some((t) => t.tileX === tileX && t.tileY === tileY);
}

export const VIRTUAL_DRINKS: readonly VirtualDrinkOption[] = [
  {
    id: 'iced_milk_coffee',
    name: 'Cà phê sữa đá',
    icon: '☕',
    subtitle: 'Tỉnh táo ôn bài',
    staffReply: 'Cà phê sữa đá đậm đà của bạn đây! Chúc học siêu tập trung nhé ☕',
  },
  {
    id: 'bubble_tea',
    name: 'Trà sữa trân châu',
    icon: '🧋',
    subtitle: 'Ngọt ngào tiếp sức',
    staffReply: 'Trà sữa trân châu vừa lắc xong nè! Uống một ngụm lấy năng lượng nha 🧋',
  },
  {
    id: 'matcha_latte',
    name: 'Matcha Latte',
    icon: '🍵',
    subtitle: 'Thư giãn nhẹ nhàng',
    staffReply: 'Matcha Latte thơm dịu đã sẵn sàng, giữ nhịp bình tĩnh làm bài nhé 🍵',
  },
  {
    id: 'peach_tea',
    name: 'Trà đào cam sả',
    icon: '🧃',
    subtitle: 'Mát lạnh sảng khoái',
    staffReply: 'Ly trà đào cam sả mát lạnh của bạn đây! Học bài thật vui nhé 🧃',
  },
];

export function findVirtualDrink(drinkId: string | null | undefined): VirtualDrinkOption | null {
  if (!drinkId) return null;
  return VIRTUAL_DRINKS.find((drink) => drink.id === drinkId) ?? null;
}

export function appendGoalCompletionBadge(
  base: string,
  studyGoal?: string | null,
  studyGoalCompleted?: boolean,
): string {
  if (!studyGoalCompleted) {
    return base;
  }
  const goal = studyGoal?.trim() ?? '';
  return goal ? `${base}\n✅ ${goal}` : `${base} ✅`;
}

export function formatSelfCharacterLabel(params: {
  nickname: string;
  isHost: boolean;
  isSeated: boolean;
  drinkId?: string | null;
  studyGoal?: string;
  studyGoalCompleted?: boolean;
}): string {
  const crownPrefix = params.isHost ? '👑 ' : '';
  const drink = findVirtualDrink(params.drinkId);
  const drinkBadge = drink ? ` ${drink.icon}` : '';
  const seatedSuffix = params.isSeated ? ' • Đang học' : '';
  const base = `${crownPrefix}${params.nickname}${drinkBadge}${seatedSuffix}`;
  return appendGoalCompletionBadge(base, params.studyGoal, params.studyGoalCompleted);
}

export const AMBIENT_NPC_DEFINITIONS: readonly AmbientNpcDefinition[] = [
  {
    npcId: 'npc_barista',
    role: 'BARISTA',
    displayName: 'Barista Minh',
    avatarKey: 'default_student',
    waypoints: [
      { tileX: 16, tileY: 13, facingDir: 'UP', pauseMs: 3600 },
      { tileX: 17, tileY: 13, facingDir: 'UP', pauseMs: 2800 },
    ],
    ambientLines: [
      'Cà phê rang mộc vừa pha xong thơm nức ☕',
      'Bấm vào quầy để chọn ly nước yêu thích nhé!',
      'Chúc cả quán hôm nay hoàn thành hết Study Goal 💪',
    ],
    greetingLine: 'Chào bạn! Hôm nay muốn nhâm nhi món gì khi học bài nào? ☕',
    bubbleIntervalMs: 16000,
    initialBubbleDelayMs: 2500,
  },
  {
    npcId: 'npc_cashier',
    role: 'CASHIER',
    displayName: 'Thu ngân Linh',
    avatarKey: 'student_glasses',
    waypoints: [
      { tileX: 20, tileY: 13, facingDir: 'UP', pauseMs: 4200 },
    ],
    ambientLines: [
      'Quán Study Café luôn mở 24/7 cho mọi bạn học 📚',
      'Đồ uống ảo miễn phí 100%, mời bạn ghé quầy nhé ✨',
      'Góc Chill Lounge bên trái rất êm cho giờ nghỉ giải lao!',
    ],
    greetingLine: 'Mời bạn xem menu đồ uống của Study Café nhé! 🧋',
    bubbleIntervalMs: 16000,
    initialBubbleDelayMs: 10500,
  },
  {
    npcId: 'npc_server',
    role: 'SERVER',
    displayName: 'Phục vụ An',
    avatarKey: 'student_sprout',
    waypoints: [
      { tileX: 15, tileY: 11, facingDir: 'RIGHT', pauseMs: 2200 },
      { tileX: 15, tileY: 9, facingDir: 'UP', pauseMs: 800 },
      { tileX: 9, tileY: 9, facingDir: 'LEFT', pauseMs: 1400 },
      { tileX: 9, tileY: 2, facingDir: 'UP', pauseMs: 1600 },
      { tileX: 5, tileY: 2, facingDir: 'UP', pauseMs: 2400 },
      { tileX: 9, tileY: 2, facingDir: 'DOWN', pauseMs: 600 },
      { tileX: 9, tileY: 9, facingDir: 'DOWN', pauseMs: 900 },
      { tileX: 6, tileY: 12, facingDir: 'LEFT', pauseMs: 2600 },
      { tileX: 14, tileY: 12, facingDir: 'RIGHT', pauseMs: 800 },
    ],
    ambientLines: [
      'Nhớ uống nước và duỗi vai mỗi 25 phút học nhé 💧',
      'Bánh sừng bò & matcha nóng hổi vừa ra lò 🥐',
      'Cần bạn học cùng? Ngồi vào bàn có tín hiệu SOS nhé!',
    ],
    greetingLine: 'Mình đang phục vụ quanh quán, bạn muốn gọi món gì không? 🍵',
    bubbleIntervalMs: 15500,
    initialBubbleDelayMs: 5000,
  },
];
