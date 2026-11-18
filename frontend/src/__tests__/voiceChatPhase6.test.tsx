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
  addTransceiver: ReturnType<typeof vi.fn>;
  getTransceivers: ReturnType<typeof vi.fn>;
  getSenders: ReturnType<typeof vi.fn>;
  replaceTrack: ReturnType<typeof vi.fn>;
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

      replaceTrack = vi.fn(async () => {});
      private transceivers: Array<{
        direction: RTCRtpTransceiverDirection;
        receiver: { track: { kind: string } };
        sender: { track: { kind: string } | null; replaceTrack: ReturnType<typeof vi.fn> };
      }> = [];

      addTrack = vi.fn();
      addTransceiver = vi.fn((kind: string, init?: { direction?: RTCRtpTransceiverDirection }) => {
        const t = {
          direction: init?.direction ?? 'sendrecv',
          receiver: { track: { kind } },
          sender: { track: null, replaceTrack: this.replaceTrack },
        };
        this.transceivers.push(t);
        return t;
      });
      getTransceivers = vi.fn(() => this.transceivers);
      getSenders = vi.fn(() => this.transceivers.map((t) => t.sender));
      createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'v=0-offer-sdp' }));
      createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'v=0-answer-sdp' }));
      setLocalDescription = vi.fn(async () => {});
      setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
        this.remoteDescription = desc;
        if (desc.type === 'offer' && this.transceivers.length === 0) {
          this.transceivers.push({
            direction: 'recvonly',
            receiver: { track: { kind: 'audio' } },
            sender: { track: null, replaceTrack: this.replaceTrack },
          });
        }
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

  it('auto-joins P2P mesh muted (listen-only without mic prompt), negotiates SDP/ICE, lazily acquires mic on unmute & tears down on leave', async () => {
    render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());

    // No separate VoiceChatBar or manual join/leave voice buttons exist
    expect(screen.queryByTestId('voice-chat-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('voice-join-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('voice-leave-btn')).not.toBeInTheDocument();

    // Auto-joins voice muted without prompting getUserMedia
    await waitFor(() => {
      expect(useVoiceStore.getState().inVoice).toBe(true);
      expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', {
        signalType: 'VOICE_JOIN',
        muted: true,
      });
    });
    expect(useVoiceStore.getState().isMuted).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByTestId('voice-peer-status-u-bob')).toHaveTextContent('Sẵn sàng');

    // Bob joins voice -> Alice (u-alice < u-bob) creates RTCPeerConnection with STUN & sendrecv audio transceiver
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
          muted: true,
        }),
      );
    });
    expect(createdPeers[0].config).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    expect(createdPeers[0].addTransceiver).toHaveBeenCalledWith('audio', { direction: 'sendrecv' });

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

    // Simulate connected state & remote audio stream speaking indicator while Alice is still muted
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
      expect(screen.getByTestId('speaking-indicator-u-bob')).toHaveAttribute('data-speaking', 'true');
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
    expect(screen.getByTestId('speaking-indicator-u-bob')).toHaveAttribute('data-speaking', 'false');

    // Alice clicks header mic pill for the first time -> lazily acquires mic & calls replaceTrack
    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
      expect(createdPeers[0].replaceTrack).toHaveBeenCalledWith(localTracks[0]);
      expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', {
        signalType: 'MUTE_STATUS',
        muted: false,
      });
    });
    expect(screen.getByTestId('voice-mute-badge-u-alice')).toHaveTextContent('Mic bật');

    // Alice toggles her own mic back to muted
    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));
    await waitFor(() => {
      expect(localTracks[0].enabled).toBe(false);
      expect(sendVoiceSignal).toHaveBeenCalledWith('table_01', {
        signalType: 'MUTE_STATUS',
        muted: true,
      });
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

  it('stays in voice (listen-only) and shows error banner in TableMembersPanel when mic permission is denied on unmute', async () => {
    const deniedErr = new Error('Permission denied');
    deniedErr.name = 'NotAllowedError';
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(deniedErr),
      },
    });

    render(<WorkspaceHarness />);
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    // User clicks mic pill to unmute -> permission denied
    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));

    await waitFor(() => {
      expect(screen.getByTestId('voice-error-banner')).toHaveTextContent('từ chối quyền');
    });
    // Still connected to table voice (listen-only), mic remains muted
    expect(useVoiceStore.getState().inVoice).toBe(true);
    expect(useVoiceStore.getState().isMuted).toBe(true);
  });

  it('auto-tears down peer connections and mic stream on component unmount and peer seat release', async () => {
    const { unmount } = render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    // Unmute once so a local mic track is active and verified to stop on unmount
    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));
    await waitFor(() => expect(useVoiceStore.getState().isMuted).toBe(false));

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
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    // Unmute once so local track cleanup is also exercised on seat leave
    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));
    await waitFor(() => expect(useVoiceStore.getState().isMuted).toBe(false));

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

  it('flushes early ICE candidates before SDP_OFFER, catches WebRTC errors, filters cross-shard signals & preserves voice on account upgrade', async () => {
    render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));
    await waitFor(() => expect(useVoiceStore.getState().isMuted).toBe(false));

    // 1. Early ICE_CANDIDATE arrives BEFORE SDP_OFFER from 'u-aaa'
    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'ICE_CANDIDATE',
        senderUserId: 'u-aaa',
        senderNickname: 'Aaron',
        targetUserId: 'u-alice',
        candidate: { candidate: 'candidate:early-1', sdpMid: '0', sdpMLineIndex: 0 },
      });
    });

    await act(async () => {
      dispatchIncomingVoiceSignal({
        signalType: 'SDP_OFFER',
        senderUserId: 'u-aaa',
        senderNickname: 'Aaron',
        targetUserId: 'u-alice',
        sdp: { type: 'offer', sdp: 'v=0-aaron-offer' },
      });
    });

    await waitFor(() => {
      expect(createdPeers).toHaveLength(1);
      expect(createdPeers[0].addIceCandidate).toHaveBeenCalledTimes(1);
    });

    // 2. Cross-shard VOICE_SIGNAL from 'main-library-2' is ignored
    const wsHandler = subscribeTableWorkspace.mock.calls.at(-1)?.[2] as ((raw: string) => void) | undefined;
    expect(wsHandler).toBeDefined();
    act(() => {
      wsHandler!(
        JSON.stringify({
          type: 'VOICE_SIGNAL',
          roomId: 'main-library-2',
          tableId: 'table_01',
          actorUserId: 'u-other-shard',
          coHostUserIds: [],
          isFreeCollab: false,
          homeworkSlides: [],
          voiceSignal: {
            signalType: 'VOICE_JOIN',
            senderUserId: 'u-other-shard',
            senderNickname: 'Shard2User',
            muted: false,
          },
          timestampEpoch: Date.now(),
        }),
      );
    });
    expect(useVoiceStore.getState().peers['u-other-shard']).toBeUndefined();

    // 3. Zero-interruption account upgrade (selfUserId changes while seated at same table) keeps voice active
    sendVoiceSignal.mockClear();
    act(() => {
      useAuthStore.setState({ userId: 'u-alice-registered', authProvider: 'LOCAL' });
    });
    expect(useVoiceStore.getState().inVoice).toBe(true);
    expect(localTracks[0].stop).not.toHaveBeenCalled();

    // 4. Rejected setRemoteDescription marks peer connectionState as 'failed' without unhandled rejection
    await act(async () => {
      dispatchIncomingVoiceSignal({
        signalType: 'SDP_OFFER',
        senderUserId: 'u-bad-sdp',
        senderNickname: 'BadPeer',
        targetUserId: 'u-alice-registered',
        sdp: { type: 'offer', sdp: 'corrupted' },
      });
    });
    const badPeerPc = createdPeers.at(-1)!;
    badPeerPc.setRemoteDescription.mockRejectedValueOnce(new Error('Invalid SDP'));
    await act(async () => {
      dispatchIncomingVoiceSignal({
        signalType: 'SDP_ANSWER',
        senderUserId: 'u-bad-sdp',
        senderNickname: 'BadPeer',
        targetUserId: 'u-alice-registered',
        sdp: { type: 'answer', sdp: 'corrupted-answer' },
      });
    });
    expect(useVoiceStore.getState().peers['u-bad-sdp']?.connectionState).toBe('failed');
  });

  it('fetches ICE servers from /api/v1/voice/ice-servers before creating RTCPeerConnection and falls back to default STUN on failure', async () => {
    const turnIceServers: RTCIceServer[] = [
      { urls: ['stun:stun.l.google.com:19302'] },
      {
        urls: [
          'turn:turn.studytogether.example:3478?transport=udp',
          'turns:turn.studytogether.example:5349?transport=tcp',
        ],
        username: '1800003600:u-alice',
        credential: 'hmac-sha1-base64-sig',
      },
    ];

    const workspaceStatePayload = {
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
    };

    let failIceEndpoint = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/voice/ice-servers')) {
        if (failIceEndpoint) {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: async () => ({ title: 'Service Unavailable', status: 503, detail: 'TURN unreachable' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ iceServers: turnIceServers, ttlSeconds: 3600 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => workspaceStatePayload,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstRender = render(<WorkspaceHarness />);
    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());

    // 1. Auto-joins voice when /api/v1/voice/ice-servers succeeds with STUN + TURN
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/voice\/ice-servers$/),
      expect.objectContaining({ method: 'GET' }),
    );

    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'VOICE_JOIN',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: false,
      });
    });

    await waitFor(() => expect(createdPeers).toHaveLength(1));
    expect(createdPeers[0].config).toEqual({
      iceServers: turnIceServers,
    });

    // 2. Leave seat (unmount) then sit down again when /api/v1/voice/ice-servers fails -> gracefully falls back to default STUN
    firstRender.unmount();
    expect(useVoiceStore.getState().inVoice).toBe(false);

    failIceEndpoint = true;
    render(<WorkspaceHarness />);
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    act(() => {
      dispatchIncomingVoiceSignal({
        signalType: 'VOICE_JOIN',
        senderUserId: 'u-bob',
        senderNickname: 'Bob',
        muted: false,
      });
    });
    await waitFor(() => expect(createdPeers).toHaveLength(2));
    expect(createdPeers[1].config).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
  });
});
