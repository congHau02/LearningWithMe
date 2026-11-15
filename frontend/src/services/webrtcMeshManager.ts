import { sendTableVoiceSignal } from './tableStompClient';
import type { VoiceSignalPayload } from './tableApi';
import { VoiceAudioAnalyzer } from './voiceAudioAnalyzer';
import { useVoiceStore, type VoicePeerConnectionState } from '../stores/useVoiceStore';

// shortcut: WebRTC P2P Mesh for <= 6 seats/table, upgrade to LiveKit SFU if table size > 8
const RTC_ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

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

function mapConnectionState(state: RTCPeerConnectionState | undefined): VoicePeerConnectionState {
  if (state === 'connected') return 'connected';
  if (state === 'failed') return 'failed';
  if (state === 'disconnected' || state === 'closed') return 'disconnected';
  return 'connecting';
}

export class WebRtcMeshManager {
  private tableId: string | null = null;
  private selfUserId: string | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
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

  bindTable(tableId: string | null, selfUserId: string | null): void {
    this.tableId = tableId;
    this.selfUserId = selfUserId;
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

    sendTableVoiceSignal(this.tableId, { signalType: 'VOICE_JOIN', muted: false });

    const knownPeers = Object.keys(useVoiceStore.getState().peers);
    for (const peerId of knownPeers) {
      if (peerId !== this.selfUserId && this.selfUserId < peerId) {
        await this.createAndSendOffer(peerId);
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
    sendTableVoiceSignal(this.tableId, { signalType: 'MUTE_STATUS', muted: nextMuted });
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
        const existingPc = this.peers.get(senderId);
        store.upsertPeer({
          userId: senderId,
          nickname: signal.senderNickname,
          muted: Boolean(signal.muted),
          connectionState: this.joined ? mapConnectionState(existingPc?.connectionState) : 'ready',
        });
        if (!this.joined || !this.tableId) return;

        if (!signal.targetUserId && existingPc) {
          this.closePeer(senderId);
        }

        if (selfId < senderId) {
          if (!this.peers.has(senderId)) {
            void this.createAndSendOffer(senderId);
          }
        } else if (!signal.targetUserId) {
          sendTableVoiceSignal(this.tableId, {
            signalType: 'VOICE_JOIN',
            targetUserId: senderId,
            muted: store.isMuted,
          });
        }
        return;
      }
      case 'VOICE_LEAVE': {
        this.closePeer(senderId);
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
        void this.handleOffer(senderId, signal.sdp);
        return;
      }
      case 'SDP_ANSWER': {
        if (!this.joined || !signal.sdp) return;
        void this.handleAnswer(senderId, signal.sdp);
        return;
      }
      case 'ICE_CANDIDATE': {
        if (!this.joined || !signal.candidate) return;
        void this.handleIceCandidate(senderId, signal.candidate);
      }
    }
  }

  syncSeatedMembers(seatedUserIds: Set<string>): void {
    const store = useVoiceStore.getState();
    const allPeerIds = new Set([...Object.keys(store.peers), ...this.peers.keys()]);
    for (const peerId of allPeerIds) {
      if (!seatedUserIds.has(peerId)) {
        this.closePeer(peerId);
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
      sendTableVoiceSignal(activeTableId, { signalType: 'VOICE_LEAVE' });
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    for (const peerId of Array.from(this.peers.keys())) {
      this.closePeer(peerId);
    }
    this.pendingIce.clear();
    this.analyzer.destroy();

    const store = useVoiceStore.getState();
    store.setInVoice(false, false);
    for (const peerId of Object.keys(store.peers)) {
      store.upsertPeer({ userId: peerId, speaking: false, connectionState: 'ready' });
    }
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    this.peers.set(peerId, pc);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.joined || !this.tableId) return;
      const candidateInit = typeof event.candidate.toJSON === 'function'
        ? event.candidate.toJSON()
        : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };
      sendTableVoiceSignal(this.tableId, {
        signalType: 'ICE_CANDIDATE',
        targetUserId: peerId,
        candidate: candidateInit,
      });
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0] ?? new MediaStream([event.track]);
      const muted = useVoiceStore.getState().peers[peerId]?.muted ?? false;
      this.analyzer.attachStream(peerId, remoteStream, true, muted);
    };

    pc.onconnectionstatechange = () => {
      useVoiceStore.getState().upsertPeer({
        userId: peerId,
        connectionState: mapConnectionState(pc.connectionState),
      });
    };

    return pc;
  }

  private async createAndSendOffer(peerId: string): Promise<void> {
    if (!this.tableId || !this.joined) return;
    useVoiceStore.getState().upsertPeer({ userId: peerId, connectionState: 'connecting' });
    const pc = this.getOrCreatePeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (!this.joined || !this.tableId) return;
    sendTableVoiceSignal(this.tableId, {
      signalType: 'SDP_OFFER',
      targetUserId: peerId,
      muted: useVoiceStore.getState().isMuted,
      sdp: { type: offer.type, sdp: offer.sdp },
    });
  }

  private async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.tableId || !this.joined) return;
    this.closePeer(peerId);
    const pc = this.getOrCreatePeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushPendingIce(peerId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (!this.joined || !this.tableId) return;
    sendTableVoiceSignal(this.tableId, {
      signalType: 'SDP_ANSWER',
      targetUserId: peerId,
      sdp: { type: answer.type, sdp: answer.sdp },
    });
  }

  private async handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc || !this.joined) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushPendingIce(peerId, pc);
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc || !pc.remoteDescription) {
      const queue = this.pendingIce.get(peerId) ?? [];
      queue.push(candidate);
      this.pendingIce.set(peerId, queue);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushPendingIce(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingIce.get(peerId);
    if (!queued || queued.length === 0) return;
    this.pendingIce.delete(peerId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private closePeer(peerId: string): void {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.peers.delete(peerId);
    }
    this.pendingIce.delete(peerId);
    this.analyzer.detachStream(peerId);
  }
}
