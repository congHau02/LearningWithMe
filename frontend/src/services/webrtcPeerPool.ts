import type { VoiceSignalRequest } from './tableApi';
import type { VoicePeerConnectionState } from '../stores/useVoiceStore';

// shortcut: WebRTC P2P Mesh for <= 6 seats/table, upgrade to LiveKit SFU if table size > 8
const RTC_ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function mapConnectionState(state: RTCPeerConnectionState | undefined): VoicePeerConnectionState {
  if (state === 'connected') return 'connected';
  if (state === 'failed') return 'failed';
  if (state === 'disconnected' || state === 'closed') return 'disconnected';
  return 'connecting';
}

export interface WebRtcPeerPoolCallbacks {
  isActive: () => boolean;
  getLocalStream: () => MediaStream | null;
  getIsMuted: () => boolean;
  sendSignal: (payload: VoiceSignalRequest) => void;
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerStateChange: (peerId: string, state: VoicePeerConnectionState) => void;
  onPeerClosed: (peerId: string) => void;
}

/**
 * Manages RTCPeerConnection instances, SDP/ICE negotiation, and early ICE buffering.
 */
export class WebRtcPeerPool {
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private readonly callbacks: WebRtcPeerPoolCallbacks;

  constructor(callbacks: WebRtcPeerPoolCallbacks) {
    this.callbacks = callbacks;
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  getConnectionState(peerId: string): VoicePeerConnectionState {
    return mapConnectionState(this.peers.get(peerId)?.connectionState);
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
    this.peers.set(peerId, pc);

    const localStream = this.callbacks.getLocalStream();
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.callbacks.isActive()) return;
      const candidateInit = typeof event.candidate.toJSON === 'function'
        ? event.candidate.toJSON()
        : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };
      this.callbacks.sendSignal({
        signalType: 'ICE_CANDIDATE',
        targetUserId: peerId,
        candidate: candidateInit,
      });
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0] ?? new MediaStream([event.track]);
      this.callbacks.onRemoteStream(peerId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      this.callbacks.onPeerStateChange(peerId, mapConnectionState(pc.connectionState));
    };

    return pc;
  }

  async createAndSendOffer(peerId: string): Promise<void> {
    if (!this.callbacks.isActive()) return;
    this.callbacks.onPeerStateChange(peerId, 'connecting');
    const pc = this.getOrCreatePeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!this.callbacks.isActive()) return;
      this.callbacks.sendSignal({
        signalType: 'SDP_OFFER',
        targetUserId: peerId,
        muted: this.callbacks.getIsMuted(),
        sdp: { type: offer.type, sdp: offer.sdp },
      });
    } catch {
      this.markFailedIfCurrent(peerId, pc);
    }
  }

  async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.callbacks.isActive()) return;
    if (this.peers.has(peerId)) {
      this.closePeer(peerId);
    }
    const pc = this.getOrCreatePeerConnection(peerId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.flushPendingIce(peerId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (!this.callbacks.isActive()) return;
      this.callbacks.sendSignal({
        signalType: 'SDP_ANSWER',
        targetUserId: peerId,
        sdp: { type: answer.type, sdp: answer.sdp },
      });
    } catch {
      this.markFailedIfCurrent(peerId, pc);
    }
  }

  async handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc || !this.callbacks.isActive()) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.flushPendingIce(peerId, pc);
    } catch {
      this.markFailedIfCurrent(peerId, pc);
    }
  }

  async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc || !pc.remoteDescription) {
      const queue = this.pendingIce.get(peerId) ?? [];
      queue.push(candidate);
      this.pendingIce.set(peerId, queue);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      this.markFailedIfCurrent(peerId, pc);
    }
  }

  private async flushPendingIce(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingIce.get(peerId);
    if (!queued || queued.length === 0) return;
    this.pendingIce.delete(peerId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private markFailedIfCurrent(peerId: string, pc: RTCPeerConnection): void {
    if (this.callbacks.isActive() && this.peers.get(peerId) === pc) {
      this.callbacks.onPeerStateChange(peerId, 'failed');
    }
  }

  closePeer(peerId: string): void {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.peers.delete(peerId);
    }
    this.pendingIce.delete(peerId);
    this.callbacks.onPeerClosed(peerId);
  }

  closeAll(): void {
    for (const peerId of Array.from(this.peers.keys())) {
      this.closePeer(peerId);
    }
    this.pendingIce.clear();
  }
}
