import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useTableWorkspaceSync } from '../hooks/useTableWorkspaceSync';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { dispatchIncomingVoiceSignal, teardownActiveVoice, useVoiceStore } from '../stores/useVoiceStore';

interface MockTrack {
  kind: string;
  enabled: boolean;
  stop: ReturnType<typeof vi.fn>;
}

interface MockPeerInstance {
  config: RTCConfiguration | undefined;
  addTrack: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  createAnswer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  addIceCandidate: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  remoteDescription: RTCSessionDescriptionInit | null;
  connectionState: RTCPeerConnectionState;
  onicecandidate: ((ev: { candidate: RTCIceCandidate | null }) => void) | null;
  ontrack: ((ev: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null;
  onconnectionstatechange: (() => void) | null;
}

function WorkspaceHarness() {
  useTableWorkspaceSync();
  return <TableWorkspaceShell />;
}

describe('P6-T4 WebRTC P2P Mesh Voice Chat, Speaking Indicator & Auto-Teardown', () => {
  const subscribeTableWorkspace = vi.fn();
  const unsubscribeTableWorkspace = vi.fn();
  const sendVoiceSignal = vi.fn();
  const sendLeave = vi.fn();

  let createdPeers: MockPeerInstance[];
  let localTracks: MockTrack[];
  let analyserEnergyByStream: Map<unknown, number>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    createdPeers = [];
    localTracks = [];
    analyserEnergyByStream = new Map();

    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();

    useAuthStore.setState({
      userId: 'u-alice',
      token: 'jwt-alice',
      nickname: 'Alice',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });

    setActiveRoomStompSession({
      subscribeTableWorkspace,
      unsubscribeTableWorkspace,
      sendVoiceSignal,
      sendLeave,
    } as unknown as RoomStompSession);

    class FakeMediaStream {
      private readonly tracks: MockTrack[];
      constructor(tracks: MockTrack[] = []) {
        this.tracks = tracks;
      }
      getTracks() {
        return this.tracks;
      }
      getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
      }
    }

    class FakeRTCPeerConnection implements MockPeerInstance {
      config: RTCConfiguration | undefined;
      remoteDescription: RTCSessionDescriptionInit | null = null;
      connectionState: RTCPeerConnectionState = 'new';
      onicecandidate: ((ev: { candidate: RTCIceCandidate | null }) => void) | null = null;
      ontrack: ((ev: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;

      addTrack = vi.fn();
      createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'v=0-offer-sdp' }));
      createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'v=0-answer-sdp' }));
      setLocalDescription = vi.fn(async () => {});
      setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
        this.remoteDescription = desc;
      });
      addIceCandidate = vi.fn(async () => {});
      close = vi.fn(() => {
        this.connectionState = 'closed';
      });

      constructor(config?: RTCConfiguration) {
        this.config = config;
        createdPeers.push(this);
      }
    }

    class FakeAudioContext {
      state: AudioContextState = 'running';
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
      createMediaStreamSource = vi.fn((stream: unknown) => ({
        stream,
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      createAnalyser = vi.fn(() => {
        let boundEnergy = 0;
        return {
          fftSize: 256,
          frequencyBinCount: 16,
          disconnect: vi.fn(),
          getByteFrequencyData: (arr: Uint8Array) => {
            arr.fill(boundEnergy);
          },
          _bindEnergy: (val: number) => {
            boundEnergy = val;
          },
        };
      });
    }

    // Intercept connect so each analyser reads energy mapped to its source stream
    const OrigAudioCtx = FakeAudioContext;
    class MappedAudioContext extends OrigAudioCtx {
      override createMediaStreamSource = vi.fn((stream: unknown) => ({
        connect: (analyser: { _bindEnergy?: (v: number) => void }) => {
          const getter = () => analyserEnergyByStream.get(stream) ?? 0;
          Object.defineProperty(analyser, 'getByteFrequencyData', {
            value: (arr: Uint8Array) => arr.fill(getter()),
          });
        },
        disconnect: vi.fn(),
      }));
    }

    vi.stubGlobal('MediaStream', FakeMediaStream);
    vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection);
    if (typeof HTMLMediaElement !== 'undefined') {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    }
    vi.stubGlobal('RTCSessionDescription', class {
      type: RTCSdpType;
      sdp: string;
      constructor(init: RTCSessionDescriptionInit) {
        this.type = init.type!;
        this.sdp = init.sdp ?? '';
      }
    });
    vi.stubGlobal('RTCIceCandidate', class {
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
      constructor(init: RTCIceCandidateInit) {
        this.candidate = init.candidate ?? '';
        this.sdpMid = init.sdpMid ?? null;
        this.sdpMLineIndex = init.sdpMLineIndex ?? null;
      }
    });
    vi.stubGlobal('AudioContext', MappedAudioContext);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          const track: MockTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
          localTracks.push(track);
          return new FakeMediaStream([track]);
        }),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          roomId: 'main-library',
          tableId: 'table_01',
          hostUserId: 'u-alice',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: null,
          videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
          members: [
            {
              userId: 'u-alice',
              nickname: 'Alice',
              avatarId: 'avatar_01',
              seatId: 'T1_S1',
              tableRole: 'TABLE_HOST',
              sitStartTimeEpoch: Date.now() - 30_000,
              connected: true,
            },
            {
              userId: 'u-bob',
              nickname: 'Bob',
              avatarId: 'avatar_02',
              seatId: 'T1_S2',
              tableRole: 'MEMBER',
              sitStartTimeEpoch: Date.now() - 10_000,
              connected: true,
            },
          ],
        }),
      }),
    );

    useGameStore.setState({
      connectionStatus: 'CONNECTED',
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    vi.useRealTimers();
  });

  it('joins P2P mesh with STUN, negotiates SDP/ICE, toggles mute, shows speaking indicator & tears down on leave', async () => {
    render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());

    // Before joining voice, remote tablemate shows "Chưa vào Voice"
    expect(screen.getByTestId('voice-peer-status-u-bob')).toHaveTextContent('Chưa vào Voice');

    // Join voice
    fireEvent.click(screen.getByTestId('voice-join-btn'));
    await waitFor(() => {
      expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', {
        signalType: 'VOICE_JOIN',
        muted: false,
      });
    });

    // Bob joins voice -> Alice (u-alice < u-bob) creates RTCPeerConnection with STUN and sends SDP_OFFER
    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'VOICE_JOIN',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: false,
      });
    });

    await waitFor(() => {
      expect(createdPeers).toHaveLength(1);
      expect(sendVoiceSignal).toHaveBeenCalledWith(
        'table_01',
        expect.objectContaining({
          signalType: 'SDP_OFFER',
          targetUserId: 'u-bob',
        }),
      );
    });
    expect(createdPeers[0].config).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    expect(createdPeers[0].addTrack).toHaveBeenCalledTimes(1);

    // ICE candidate before SDP_ANSWER is buffered until remoteDescription is set
    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'ICE_CANDIDATE',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        targetUserId: 'u-alice',
        candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
      });
    });
    expect(createdPeers[0].addIceCandidate).not.toHaveBeenCalled();

    await act(async () => {
      dispatchIncomingVoiceSignal({
        signalType: 'SDP_ANSWER',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        targetUserId: 'u-alice',
        sdp: { type: 'answer', sdp: 'v=0-bob-answer' },
      });
    });
    await waitFor(() => {
      expect(createdPeers[0].setRemoteDescription).toHaveBeenCalled();
      expect(createdPeers[0].addIceCandidate).toHaveBeenCalledTimes(1);
    });

    // Simulate connected state & remote audio stream speaking indicator
    const remoteStream = new MediaStream();
    analyserEnergyByStream.set(remoteStream, 42);
    act(() => {
      createdPeers[0].connectionState = 'connected';
      createdPeers[0].onconnectionstatechange?.();
      createdPeers[0].ontrack?.({
        streams: [remoteStream],
        track: {} as MediaStreamTrack,
      });
    });
    expect(screen.getByTestId('voice-peer-status-u-bob')).toHaveTextContent('Đã kết nối');

    await waitFor(() => {
      expect(screen.getByTestId('speaking-indicator-u-bob')).toBeInTheDocument();
    });

    // Bob mutes -> speaking indicator clears & mute badge updates immediately
    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'MUTE_STATUS',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: true,
      });
    });
    expect(screen.getByTestId('voice-mute-badge-u-bob')).toHaveTextContent('Mic tắt');
    expect(screen.queryByTestId('speaking-indicator-u-bob')).not.toBeInTheDocument();

    // Alice toggles her own mic mute
    fireEvent.click(screen.getByTestId('voice-mute-btn'));
    expect(localTracks[0].enabled).toBe(false);
    expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', {
      signalType: 'MUTE_STATUS',
      muted: true,
    });
    expect(screen.getByTestId('voice-mute-badge-u-alice')).toHaveTextContent('Mic tắt');

    // Leave seat teardown: closes RTCPeerConnection, stops mic track, sends VOICE_LEAVE
    act(() => {
      teardownActiveVoice();
    });
    expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', { signalType: 'VOICE_LEAVE' });
    expect(localTracks[0].stop).toHaveBeenCalled();
    expect(createdPeers[0].close).toHaveBeenCalled();
    expect(useVoiceStore.getState().inVoice).toBe(false);
  });

  it('handles denied microphone permissions gracefully without crashing', async () => {
    const deniedErr = new Error('Permission denied');
    deniedErr.name = 'NotAllowedError';
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(deniedErr),
      },
    });

    render(<WorkspaceHarness />);
    fireEvent.click(screen.getByTestId('voice-join-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('voice-error-banner')).toHaveTextContent('từ chối quyền');
    });
    expect(useVoiceStore.getState().inVoice).toBe(false);
    expect(sendVoiceSignal).not.toHaveBeenCalled();
  });

  it('auto-tears down peer connections and mic stream on component unmount and peer seat release', async () => {
    const { unmount } = render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('voice-join-btn'));
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'VOICE_JOIN',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: false,
      });
    });
    await waitFor(() => expect(createdPeers).toHaveLength(1));

    // When Bob leaves seat (SEAT_RELEASED), Bob's peer connection closes immediately
    act(() => {
      useTableStore.getState().syncFromRoomSeatEvent({
        seq: 20,
        type: 'SEAT_RELEASED',
        roomId: 'main-library',
        userId: 'u-bob',
        previousUserId: null,
        player: null,
        timestampEpoch: Date.now(),
        tableId: 'table_01',
        seatId: 'T1_S2',
        hostUserId: 'u-alice',
      });
    });
    await waitFor(() => {
      expect(createdPeers[0].close).toHaveBeenCalled();
      expect(useVoiceStore.getState().peers['u-bob']).toBeUndefined();
    });

    // Unmounting TableWorkspaceShell sends VOICE_LEAVE and stops mic track
    sendVoiceSignal.mockClear();
    unmount();
    expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', { signalType: 'VOICE_LEAVE' });
    expect(localTracks[0].stop).toHaveBeenCalled();
    expect(useVoiceStore.getState().inVoice).toBe(false);
  });

  it('answers incoming SDP_OFFER from a lower userId peer and tears down when clicking Đứng dậy rời bàn', async () => {
    const { rerender } = render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('voice-join-btn'));
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    // Peer with lower ID ('u-aaa' < 'u-alice') sends SDP_OFFER while muted -> Alice responds with SDP_ANSWER and records muted state
    await act(async () => {
      dispatchIncomingVoiceSignal({
        signalType: 'SDP_OFFER',
        senderUserId: 'u-aaa',
        senderNickname: 'Aaron',
        targetUserId: 'u-alice',
        muted: true,
        sdp: { type: 'offer', sdp: 'v=0-aaron-offer' },
      });
    });

    await waitFor(() => {
      expect(createdPeers).toHaveLength(1);
      expect(sendVoiceSignal).toHaveBeenCalledWith(
        'table_01',
        expect.objectContaining({
          signalType: 'SDP_ANSWER',
          targetUserId: 'u-aaa',
        }),
      );
      expect(useVoiceStore.getState().peers['u-aaa']?.muted).toBe(true);
    });

    // If a peer with higher ID ('u-bob' > 'u-alice') refreshes and sends broadcast VOICE_JOIN while old PC is still connected, replace old PC
    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'VOICE_JOIN',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: false,
      });
    });
    await waitFor(() => expect(createdPeers).toHaveLength(2));
    createdPeers[1].connectionState = 'connected';
    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'VOICE_JOIN',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: false,
      });
    });
    await waitFor(() => {
      expect(createdPeers[1].close).toHaveBeenCalled();
      expect(createdPeers).toHaveLength(3);
    });

    // Clicking "Đứng dậy rời bàn" sets isPendingSeatLeave; simulate room sync leave flow
    fireEvent.click(screen.getByTestId('workspace-leave-seat-btn'));
    expect(useGameStore.getState().isPendingSeatLeave).toBe(true);

    act(() => {
      teardownActiveVoice();
      useGameStore.getState().leaveSeat();
      useTableStore.getState().leaveTable();
    });
    rerender(<WorkspaceHarness />);

    expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', { signalType: 'VOICE_LEAVE' });
    expect(createdPeers[0].close).toHaveBeenCalled();
    expect(localTracks[0].stop).toHaveBeenCalled();
    expect(screen.queryByTestId('table-workspace-shell')).not.toBeInTheDocument();
  });
});
