import type { RoomEvent } from '../services/roomApi';
import type {
  HomeworkSlide,
  LaserPointerPayload,
  PermissionRequestNotification,
  TableChatMessage,
  TableMemberDto,
  TableScratchpadState,
} from '../services/tableApi';
import type { VideoSyncState } from './useTableStore';

export interface LaserPointerState extends LaserPointerPayload {
  lastSeenEpoch: number;
}

export interface TableStoreData {
  tableId: string | null;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  isTableLocked: boolean;
  inviteCode: string | null;
  sosBanner: string | null;
  sitStartTimeEpoch: number | null;
  members: TableMemberDto[];
  pendingPermissionRequests: PermissionRequestNotification[];
  permissionToast: string | null;
  videoState: VideoSyncState;
  recentMessages: TableChatMessage[];
  homeworkSlides: HomeworkSlide[];
  activeSlideId: string | null;
  scratchpadState: TableScratchpadState;
  laserPointers: Record<string, LaserPointerState>;
  isWorkspaceMinimized: boolean;
  unreadChatCount: number;
}

export const roleOf = (uid: string, hostId: string | null, coHosts: string[]) =>
  uid === hostId ? ('TABLE_HOST' as const) : coHosts.includes(uid) ? ('CO_HOST' as const) : ('MEMBER' as const);

export function reduceRoomSeatEvent(s: TableStoreData, event: RoomEvent): Partial<TableStoreData> {
  if (event.type === 'PLAYER_UPDATED' && event.player && s.tableId) {
    const p = event.player;
    const prevId = event.previousUserId && event.previousUserId !== p.userId ? event.previousUserId : null;
    const touchesTable =
      s.members.some((m) => m.userId === p.userId || (prevId !== null && m.userId === prevId)) ||
      (prevId !== null && (s.hostUserId === prevId || s.coHostUserIds.includes(prevId)));
    if (!touchesTable) return s;

    const nextHost = prevId && s.hostUserId === prevId ? p.userId : s.hostUserId;
    const remappedCoHosts = s.coHostUserIds.map((id) => (prevId && id === prevId ? p.userId : id));
    const nextCoHosts = Array.from(new Set(remappedCoHosts)).filter((id) => id !== nextHost);
    const seenIds = new Set<string>();
    const nextMembers = s.members
      .map((m) =>
        m.userId === p.userId || (prevId !== null && m.userId === prevId)
          ? {
              ...m,
              userId: p.userId,
              nickname: p.nickname,
              avatarId: p.avatarId,
              hatId: p.hatId ?? m.hatId,
              deskPetId: p.deskPetId ?? m.deskPetId,
              connected: p.connected,
              studyGoal: p.studyGoal !== undefined ? p.studyGoal : m.studyGoal,
              studyGoalCompleted:
                p.studyGoalCompleted !== undefined ? p.studyGoalCompleted : m.studyGoalCompleted,
            }
          : m,
      )
      .filter((m) => {
        if (seenIds.has(m.userId)) return false;
        seenIds.add(m.userId);
        return true;
      })
      .map((m) => ({ ...m, tableRole: roleOf(m.userId, nextHost, nextCoHosts) }));

    return {
      hostUserId: nextHost,
      coHostUserIds: nextCoHosts,
      members: nextMembers,
    };
  }
  if (!s.tableId || event.tableId !== s.tableId) return s;
  if (event.type === 'TABLE_LOCK_UPDATED') {
    const nextLocked = Boolean(event.isTableLocked);
    return { isTableLocked: nextLocked, inviteCode: nextLocked ? s.inviteCode : null };
  }
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
          hatId: p.hatId,
          deskPetId: p.deskPetId,
          seatId: p.seatId ?? event.seatId ?? '',
          tableRole: roleOf(p.userId, nextHost, nextCoHosts),
          sitStartTimeEpoch: p.sitStartTimeEpoch || event.timestampEpoch,
          connected: p.connected,
          studyGoal: p.studyGoal ?? null,
          studyGoalCompleted: Boolean(p.studyGoalCompleted),
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
