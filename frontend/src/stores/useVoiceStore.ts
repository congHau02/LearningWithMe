import { create } from 'zustand';
import type { VoiceSignalPayload } from '../services/tableApi';

export type VoicePeerConnectionState = 'ready' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface VoicePeerState {
  userId: string;
  nickname: string;
  muted: boolean;
  speaking: boolean;
  connectionState: VoicePeerConnectionState;
}

export interface VoiceStoreState {
  inVoice: boolean;
  isJoining: boolean;
  isMuted: boolean;
  isSelfSpeaking: boolean;
  voiceError: string | null;
  peers: Record<string, VoicePeerState>;
  setJoining: (isJoining: boolean) => void;
  setInVoice: (inVoice: boolean, isMuted?: boolean) => void;
  setMuted: (isMuted: boolean) => void;
  setSelfSpeaking: (isSelfSpeaking: boolean) => void;
  setVoiceError: (voiceError: string | null) => void;
  upsertPeer: (peer: Partial<VoicePeerState> & { userId: string }) => void;
  removePeer: (userId: string) => void;
  resetVoice: () => void;
}

const INITIAL_VOICE_STATE = {
  inVoice: false,
  isJoining: false,
  isMuted: false,
  isSelfSpeaking: false,
  voiceError: null as string | null,
  peers: {} as Record<string, VoicePeerState>,
};

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  ...INITIAL_VOICE_STATE,
  setJoining: (isJoining) => set({ isJoining }),
  setInVoice: (inVoice, isMuted) =>
    set((s) => ({
      inVoice,
      isJoining: false,
      isMuted: isMuted ?? s.isMuted,
      isSelfSpeaking: inVoice ? s.isSelfSpeaking : false,
    })),
  setMuted: (isMuted) =>
    set((s) => ({
      isMuted,
      isSelfSpeaking: isMuted ? false : s.isSelfSpeaking,
    })),
  setSelfSpeaking: (isSelfSpeaking) =>
    set((s) => (s.isSelfSpeaking === isSelfSpeaking ? s : { isSelfSpeaking })),
  setVoiceError: (voiceError) => set({ voiceError }),
  upsertPeer: (peer) =>
    set((s) => {
      const prev = s.peers[peer.userId];
      const nextPeer: VoicePeerState = {
        userId: peer.userId,
        nickname: peer.nickname ?? prev?.nickname ?? peer.userId,
        muted: peer.muted ?? prev?.muted ?? false,
        speaking: peer.speaking ?? prev?.speaking ?? false,
        connectionState: peer.connectionState ?? prev?.connectionState ?? 'ready',
      };
      if (
        prev &&
        prev.nickname === nextPeer.nickname &&
        prev.muted === nextPeer.muted &&
        prev.speaking === nextPeer.speaking &&
        prev.connectionState === nextPeer.connectionState
      ) {
        return s;
      }
      return { peers: { ...s.peers, [peer.userId]: nextPeer } };
    }),
  removePeer: (userId) =>
    set((s) => {
      if (!s.peers[userId]) return s;
      const next = { ...s.peers };
      delete next[userId];
      return { peers: next };
    }),
  resetVoice: () => set({ ...INITIAL_VOICE_STATE }),
}));

export interface ActiveVoiceBridge {
  handleSignal: (signal: VoiceSignalPayload) => void;
  teardown: () => void;
}

let activeVoiceBridge: ActiveVoiceBridge | null = null;

export function setActiveVoiceBridge(bridge: ActiveVoiceBridge | null): void {
  activeVoiceBridge = bridge;
}

export function dispatchIncomingVoiceSignal(signal: VoiceSignalPayload): void {
  activeVoiceBridge?.handleSignal(signal);
}

export function teardownActiveVoice(): void {
  activeVoiceBridge?.teardown();
}
