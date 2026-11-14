import type { RoomEvent } from '../services/roomApi';
import type { HomeworkSlide, LaserPointerPayload, PermissionRequestNotification, TableChatMessage, TableMemberDto, TableWorkspaceEvent } from '../services/tableApi';
import type { VideoSyncState } from './useTableStore';

export interface LaserPointerState extends LaserPointerPayload {
  lastSeenEpoch: number;
}

export interface TableStoreData {
  tableId: string | null;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  sosBanner: string | null;
  sitStartTimeEpoch: number | null;
  members: TableMemberDto[];
  pendingPermissionRequests: PermissionRequestNotification[];
  permissionToast: string | null;
  videoState: VideoSyncState;
  recentMessages: TableChatMessage[];
  homeworkSlides: HomeworkSlide[];
  activeSlideId: string | null;
  laserPointers: Record<string, LaserPointerState>;
}

const ROLE_TOAST: Record<string, string> = {
  GRANT: 'Trưởng bàn đã cấp quyền Co-Host cho bạn',
  DENY: 'Yêu cầu xin quyền điều khiển đã bị từ chối',
  REVOKE: 'Quyền Co-Host của bạn đã được thu hồi',
  TRANSFER_HOST: 'Bạn đã trở thành Trưởng bàn mới!',
};

export const roleOf = (uid: string, hostId: string | null, coHosts: string[]) =>
  uid === hostId ? ('TABLE_HOST' as const) : coHosts.includes(uid) ? ('CO_HOST' as const) : ('MEMBER' as const);

export function reduceWorkspaceEvent(
  s: TableStoreData,
  event: TableWorkspaceEvent,
  selfUserId: string | null,
): Partial<TableStoreData> {
  if (s.tableId !== event.tableId) return s;
  if (event.type === 'PERMISSION_REQUESTED') {
    if (selfUserId !== event.hostUserId) return s;
    const rest = s.pendingPermissionRequests.filter((r) => r.requesterUserId !== event.actorUserId);
    return {
      pendingPermissionRequests: [
        ...rest,
        {
          requesterUserId: event.actorUserId,
          requesterNickname: event.requesterNickname || event.actorUserId,
          timestampEpoch: event.timestampEpoch,
        },
      ],
    };
  }
  if (event.type === 'VIDEO_SYNCED' && event.videoState) return { videoState: event.videoState };
  if (event.type === 'SOS_UPDATED') return { sosBanner: event.sosBanner ?? null };
  if (event.type === 'TABLE_CHAT' && event.chatMessage) {
    const msg = event.chatMessage;
    return s.recentMessages.some((m) => m.id === msg.id) ? s : { recentMessages: [...s.recentMessages, msg].slice(-50) };
  }
  if (event.type === 'HOMEWORK_SLIDE_ADDED' || event.type === 'HOMEWORK_SLIDE_SELECTED' || event.type === 'HOMEWORK_SLIDE_DELETED') {
    const nextActive = event.activeSlideId !== undefined ? event.activeSlideId : s.activeSlideId;
    const slideChanged = nextActive !== s.activeSlideId;
    return {
      homeworkSlides: event.homeworkSlides ?? s.homeworkSlides,
      activeSlideId: nextActive,
      laserPointers: slideChanged ? {} : s.laserPointers,
    };
  }
  if (event.type === 'LASER_MOVE' && event.laserPointer) {
    const lp = event.laserPointer;
    return { laserPointers: { ...s.laserPointers, [lp.userId]: { ...lp, lastSeenEpoch: event.timestampEpoch || Date.now() } } };
  }
  if (event.type === 'BOARD_DRAW' && event.slideId && event.drawAction) {
    return {
      homeworkSlides: s.homeworkSlides.map((slide) => {
        if (slide.imageId !== event.slideId) return slide;
        const prev = slide.strokes ?? [];
        if (event.drawAction === 'ADD_STROKE' && event.stroke) {
          return prev.some((st) => st.id === event.stroke?.id) ? slide : { ...slide, strokes: [...prev, event.stroke] };
        }
        if (event.drawAction === 'ERASE_STROKE' && event.erasedStrokeId) {
          return { ...slide, strokes: prev.filter((st) => st.id !== event.erasedStrokeId) };
        }
        return event.drawAction === 'CLEAR_SLIDE' ? { ...slide, strokes: [] } : slide;
      }),
    };
  }
  if (event.type !== 'PERMISSION_UPDATED') return s;
  const nextMembers = s.members.map((m) => ({ ...m, tableRole: roleOf(m.userId, event.hostUserId, event.coHostUserIds) }));
  const nextRequests = event.targetUserId
    ? s.pendingPermissionRequests.filter((r) => r.requesterUserId !== event.targetUserId)
    : s.pendingPermissionRequests;
  const toast =
    selfUserId && event.targetUserId === selfUserId && event.action
      ? (ROLE_TOAST[event.action] ?? s.permissionToast)
      : s.permissionToast;
  return { hostUserId: event.hostUserId, coHostUserIds: event.coHostUserIds, isFreeCollab: event.isFreeCollab, members: nextMembers, pendingPermissionRequests: nextRequests, permissionToast: toast };
}

export function reduceRoomSeatEvent(s: TableStoreData, event: RoomEvent): Partial<TableStoreData> {
  if (!s.tableId || event.tableId !== s.tableId) return s;
  const nextHost = event.hostUserId !== undefined ? event.hostUserId : s.hostUserId;
  let nextCoHosts = s.coHostUserIds.filter((id) => id !== nextHost);
  let nextMembers = s.members;
  if (event.type === 'SEAT_LOCKED' && event.player) {
    const p = event.player;
    if (!nextMembers.some((m) => m.userId === p.userId)) {
      nextMembers = [
        ...nextMembers,
        {
          userId: p.userId,
          nickname: p.nickname,
          avatarId: p.avatarId,
          seatId: p.seatId ?? event.seatId ?? '',
          tableRole: roleOf(p.userId, nextHost, nextCoHosts),
          sitStartTimeEpoch: p.sitStartTimeEpoch || event.timestampEpoch,
          connected: p.connected,
        },
      ];
    }
  } else if (event.type === 'SEAT_RELEASED') {
    nextCoHosts = nextCoHosts.filter((id) => id !== event.userId);
    nextMembers = nextMembers.filter((m) => m.userId !== event.userId);
  }
  return {
    hostUserId: nextHost,
    coHostUserIds: nextCoHosts,
    members: nextMembers.map((m) => ({ ...m, tableRole: roleOf(m.userId, nextHost, nextCoHosts) })),
  };
}
