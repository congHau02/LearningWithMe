import type { VoiceSignalPayload, VoiceSignalRequest } from './tableApi';
import type { VoiceAudioAnalyzer } from './voiceAudioAnalyzer';
import type { WebRtcPeerPool } from './webrtcPeerPool';
import { useVoiceStore } from '../stores/useVoiceStore';

export function mapMicError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Không thể truy cập micro: bạn đã từ chối quyền sử dụng micro.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Không tìm thấy thiết bị micro nào đang kết nối.';
  }
  return 'Không thể khởi động micro. Vui lòng kiểm tra quyền trình duyệt.';
}

export interface WebRtcSignalContext {
  selfUserId: string | null;
  tableId: string | null;
  joined: boolean;
  peerPool: WebRtcPeerPool;
  analyzer: VoiceAudioAnalyzer;
  sendSignal: (payload: VoiceSignalRequest) => void;
}

export function handleIncomingWebRtcSignal(ctx: WebRtcSignalContext, signal: VoiceSignalPayload): void {
  const selfId = ctx.selfUserId;
  if (!selfId || signal.senderUserId === selfId) return;
  if (signal.targetUserId && signal.targetUserId !== selfId) return;

  const senderId = signal.senderUserId;
  const store = useVoiceStore.getState();

  switch (signal.signalType) {
    case 'VOICE_JOIN': {
      const hadPeer = ctx.peerPool.hasPeer(senderId);
      store.upsertPeer({
        userId: senderId,
        nickname: signal.senderNickname,
        muted: Boolean(signal.muted),
        connectionState: ctx.joined ? ctx.peerPool.getConnectionState(senderId) : 'ready',
      });
      if (!ctx.joined || !ctx.tableId) return;

      if (!signal.targetUserId && hadPeer) {
        ctx.peerPool.closePeer(senderId);
      }

      if (selfId < senderId) {
        if (!ctx.peerPool.hasPeer(senderId)) {
          void ctx.peerPool.createAndSendOffer(senderId);
        }
      } else if (!signal.targetUserId) {
        ctx.sendSignal({
          signalType: 'VOICE_JOIN',
          targetUserId: senderId,
          muted: store.isMuted,
        });
      }
      return;
    }
    case 'VOICE_LEAVE': {
      ctx.peerPool.closePeer(senderId);
      store.removePeer(senderId);
      return;
    }
    case 'MUTE_STATUS': {
      const muted = Boolean(signal.muted);
      ctx.analyzer.setMuted(senderId, muted);
      store.upsertPeer({
        userId: senderId,
        nickname: signal.senderNickname,
        muted,
        ...(muted ? { speaking: false } : {}),
      });
      return;
    }
    case 'SDP_OFFER': {
      if (!ctx.joined || !signal.sdp) return;
      store.upsertPeer({
        userId: senderId,
        nickname: signal.senderNickname,
        connectionState: 'connecting',
        ...(typeof signal.muted === 'boolean' ? { muted: signal.muted } : {}),
      });
      void ctx.peerPool.handleOffer(senderId, signal.sdp);
      return;
    }
    case 'SDP_ANSWER': {
      if (!ctx.joined || !signal.sdp) return;
      void ctx.peerPool.handleAnswer(senderId, signal.sdp);
      return;
    }
    case 'ICE_CANDIDATE': {
      if (!ctx.joined || !signal.candidate) return;
      void ctx.peerPool.handleIceCandidate(senderId, signal.candidate);
    }
  }
}
