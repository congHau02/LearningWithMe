import { sendTableVoiceSignal } from './tableStompClient';
import type { VoiceSignalPayload, VoiceSignalRequest } from './tableApi';
import { VoiceAudioAnalyzer } from './voiceAudioAnalyzer';
import { WebRtcPeerPool } from './webrtcPeerPool';
import { useVoiceStore } from '../stores/useVoiceStore';

const SELF_AUDIO_KEY = '__self__';

function mapMicError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Không thể truy cập micro: bạn đã từ chối quyền sử dụng micro.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Không tìm thấy thiết bị micro nào đang kết nối.';
  }
  return 'Không thể khởi động micro. Vui lòng kiểm tra quyền trình duyệt.';
}

/**
 * Coordinates table voice lifecycle, local microphone state, and WebRTC signaling.
 */
export class WebRtcMeshManager {
  private tableId: string | null = null;
  private selfUserId: string | null = null;
  private localStream: MediaStream | null = null;
  private joined = false;
  private joinGeneration = 0;

  private readonly analyzer = new VoiceAudioAnalyzer((key, speaking) => {
    const store = useVoiceStore.getState();
    if (key === SELF_AUDIO_KEY) {
      store.setSelfSpeaking(speaking);
    } else {
      store.upsertPeer({ userId: key, speaking });
    }
  });

  private readonly peerPool = new WebRtcPeerPool({
    isActive: () => this.joined && Boolean(this.tableId),
    getLocalStream: () => this.localStream,
    getIsMuted: () => useVoiceStore.getState().isMuted,
    sendSignal: (payload) => this.sendSignal(payload),
    onRemoteStream: (peerId, stream) => {
      const muted = useVoiceStore.getState().peers[peerId]?.muted ?? false;
      this.analyzer.attachStream(peerId, stream, true, muted);
    },
    onPeerStateChange: (peerId, connectionState) => {
      useVoiceStore.getState().upsertPeer({ userId: peerId, connectionState });
    },
    onPeerClosed: (peerId) => {
      this.analyzer.detachStream(peerId);
    },
  });

  bindTable(tableId: string | null, selfUserId: string | null): void {
    this.tableId = tableId;
    this.selfUserId = selfUserId;
  }

  private sendSignal(payload: VoiceSignalRequest): void {
    if (!this.tableId) return;
    sendTableVoiceSignal(this.tableId, payload);
  }

  async join(): Promise<void> {
    if (this.joined || !this.tableId || !this.selfUserId) return;
    const store = useVoiceStore.getState();
    if (store.isJoining) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      store.setVoiceError('Trình duyệt không hỗ trợ truy cập micro WebRTC.');
      return;
    }

    const myGen = ++this.joinGeneration;
    store.setVoiceError(null);
    store.setJoining(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      if (this.joinGeneration === myGen) {
        store.setJoining(false);
        store.setVoiceError(mapMicError(err));
      }
      return;
    }

    if (this.joinGeneration !== myGen || !this.tableId || !this.selfUserId) {
      stream.getTracks().forEach((track) => track.stop());
      store.setJoining(false);
      return;
    }

    this.localStream = stream;
    this.joined = true;
    this.analyzer.attachStream(SELF_AUDIO_KEY, stream, false, false);
    store.setInVoice(true, false);

    this.sendSignal({ signalType: 'VOICE_JOIN', muted: false });

    const knownPeers = Object.keys(useVoiceStore.getState().peers);
    for (const peerId of knownPeers) {
      if (peerId !== this.selfUserId && this.selfUserId < peerId) {
        await this.peerPool.createAndSendOffer(peerId);
      }
    }
  }

  toggleMute(): boolean {
    if (!this.joined || !this.localStream || !this.tableId) return false;
    const nextMuted = !useVoiceStore.getState().isMuted;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    this.analyzer.setMuted(SELF_AUDIO_KEY, nextMuted);
    useVoiceStore.getState().setMuted(nextMuted);
    this.sendSignal({ signalType: 'MUTE_STATUS', muted: nextMuted });
    return nextMuted;
  }

  handleIncomingSignal(signal: VoiceSignalPayload): void {
    const selfId = this.selfUserId;
    if (!selfId || signal.senderUserId === selfId) return;
    if (signal.targetUserId && signal.targetUserId !== selfId) return;

    const senderId = signal.senderUserId;
    const store = useVoiceStore.getState();

    switch (signal.signalType) {
      case 'VOICE_JOIN': {
        const hadPeer = this.peerPool.hasPeer(senderId);
        store.upsertPeer({
          userId: senderId,
          nickname: signal.senderNickname,
          muted: Boolean(signal.muted),
          connectionState: this.joined ? this.peerPool.getConnectionState(senderId) : 'ready',
        });
        if (!this.joined || !this.tableId) return;

        if (!signal.targetUserId && hadPeer) {
          this.peerPool.closePeer(senderId);
        }

        if (selfId < senderId) {
          if (!this.peerPool.hasPeer(senderId)) {
            void this.peerPool.createAndSendOffer(senderId);
          }
        } else if (!signal.targetUserId) {
          this.sendSignal({
            signalType: 'VOICE_JOIN',
            targetUserId: senderId,
            muted: store.isMuted,
          });
        }
        return;
      }
      case 'VOICE_LEAVE': {
        this.peerPool.closePeer(senderId);
        store.removePeer(senderId);
        return;
      }
      case 'MUTE_STATUS': {
        const muted = Boolean(signal.muted);
        this.analyzer.setMuted(senderId, muted);
        store.upsertPeer({
          userId: senderId,
          nickname: signal.senderNickname,
          muted,
          ...(muted ? { speaking: false } : {}),
        });
        return;
      }
      case 'SDP_OFFER': {
        if (!this.joined || !signal.sdp) return;
        store.upsertPeer({
          userId: senderId,
          nickname: signal.senderNickname,
          connectionState: 'connecting',
          ...(typeof signal.muted === 'boolean' ? { muted: signal.muted } : {}),
        });
        void this.peerPool.handleOffer(senderId, signal.sdp);
        return;
      }
      case 'SDP_ANSWER': {
        if (!this.joined || !signal.sdp) return;
        void this.peerPool.handleAnswer(senderId, signal.sdp);
        return;
      }
      case 'ICE_CANDIDATE': {
        if (!this.joined || !signal.candidate) return;
        void this.peerPool.handleIceCandidate(senderId, signal.candidate);
      }
    }
  }

  syncSeatedMembers(seatedUserIds: Set<string>): void {
    const store = useVoiceStore.getState();
    const allPeerIds = new Set([...Object.keys(store.peers), ...this.peerPool.getPeerIds()]);
    for (const peerId of allPeerIds) {
      if (!seatedUserIds.has(peerId)) {
        this.peerPool.closePeer(peerId);
        store.removePeer(peerId);
      }
    }
  }

  leave(sendSignal = true): void {
    this.joinGeneration += 1;
    const wasJoined = this.joined;
    const activeTableId = this.tableId;
    this.joined = false;

    if (sendSignal && wasJoined && activeTableId) {
      this.sendSignal({ signalType: 'VOICE_LEAVE' });
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.peerPool.closeAll();
    this.analyzer.destroy();

    const store = useVoiceStore.getState();
    store.setInVoice(false, false);
    for (const peerId of Object.keys(store.peers)) {
      store.upsertPeer({ userId: peerId, speaking: false, connectionState: 'ready' });
    }
  }
}
