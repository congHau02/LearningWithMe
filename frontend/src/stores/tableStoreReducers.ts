import type { TableWorkspaceEvent } from '../services/tableApi';
import { reduceRoomSeatEvent, roleOf, type LaserPointerState, type TableStoreData } from './tableSeatReducer';

export { reduceRoomSeatEvent, roleOf, type LaserPointerState, type TableStoreData };

const ROLE_TOAST: Record<string, string> = {
  GRANT: 'Trưởng bàn đã cấp quyền Co-Host cho bạn',
  DENY: 'Yêu cầu xin quyền điều khiển đã bị từ chối',
  REVOKE: 'Quyền Co-Host của bạn đã được thu hồi',
  TRANSFER_HOST: 'Bạn đã trở thành Trưởng bàn mới!',
};

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
  return {
    hostUserId: event.hostUserId,
    coHostUserIds: event.coHostUserIds,
    isFreeCollab: event.isFreeCollab,
    members: nextMembers,
    pendingPermissionRequests: nextRequests,
    permissionToast: toast,
  };
}
