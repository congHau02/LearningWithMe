import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useTableWorkspaceSync } from '../hooks/useTableWorkspaceSync';
import type { RoomSnapshotResponse } from '../services/roomApi';
import {
  RoomStompSession,
  setActiveRoomStompSession,
  type StompTransport,
  type StompTransportConfig,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';

class FakeStompTransport implements StompTransport {
  public readonly subscriptions = new Map<string, (body: string) => void>();
  public readonly published: Array<{ destination: string; body: string }> = [];

  constructor(public readonly config: StompTransportConfig) {}

  activate(): void {
    this.config.onConnect();
  }

  subscribe(destination: string, handler: (body: string) => void): () => void {
    this.subscriptions.set(destination, handler);
    return () => {
      this.subscriptions.delete(destination);
    };
  }

  publish(destination: string, body: string): void {
    this.published.push({ destination, body });
  }

  disableReconnect(): void {}

  async deactivate(): Promise<void> {}

  emit(destination: string, payload: unknown): void {
    const handler = this.subscriptions.get(destination);
    if (!handler) {
      throw new Error(`No subscription for ${destination}`);
    }
    handler(JSON.stringify(payload));
  }
}

function WorkspaceSyncHarness() {
  useTableWorkspaceSync();
  return <TableWorkspaceShell />;
}

describe('P8-T3 Frontend Room-Scoped Table STOMP & Private /user/queue/voice', () => {
  let transport: FakeStompTransport;
  let session: RoomStompSession;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
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

    class FakeMediaStream {
      getTracks() {
        return [{ kind: 'audio', enabled: true, stop: vi.fn() }];
      }
      getAudioTracks() {
        return [{ kind: 'audio', enabled: true, stop: vi.fn() }];
      }
    }

    class FakeRTCPeerConnection {
      remoteDescription: RTCSessionDescriptionInit | null = null;
      connectionState: RTCPeerConnectionState = 'new';
      onicecandidate: ((ev: { candidate: RTCIceCandidate | null }) => void) | null = null;
      ontrack: ((ev: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;
      addTrack = vi.fn();
      createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'v=0-offer' }));
      createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'v=0-answer' }));
      setLocalDescription = vi.fn(async () => {});
      setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
        this.remoteDescription = desc;
      });
      addIceCandidate = vi.fn(async () => {});
      close = vi.fn();
    }

    vi.stubGlobal('MediaStream', FakeMediaStream);
    vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection);
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

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => new FakeMediaStream()),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          roomId: 'main-library-2',
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
              sitStartTimeEpoch: Date.now() - 10_000,
              connected: true,
            },
            {
              userId: 'u-bob',
              nickname: 'Bob',
              avatarId: 'avatar_02',
              seatId: 'T1_S2',
              tableRole: 'MEMBER',
              sitStartTimeEpoch: Date.now() - 5_000,
              connected: true,
            },
          ],
        }),
      }),
    );

    const snapshot: RoomSnapshotResponse = {
      roomId: 'main-library-2',
      capacityLimit: 50,
      eventSeq: 1,
      players: [],
      seats: {},
      tables: [],
      recentMessages: [],
    };
    session = new RoomStompSession({
      wsUrl: 'ws://localhost:8080/ws',
      joinShard: async () => ({ roomId: 'main-library-2', capacityLimit: 50, activeLearnerCount: 2 }),
      fetchSnapshot: async () => snapshot,
      transportFactory: (cfg) => {
        transport = new FakeStompTransport(cfg);
        return transport;
      },
    });
    setActiveRoomStompSession(session);
    await session.start('jwt-alice');
  });

  afterEach(async () => {
    await session.stop();
    setActiveRoomStompSession(null);
  });

  it('subscribes to /topic/room/{roomId}/table/{tableId}/workspace and /user/queue/voice, handles private SDP/ICE and unsubscribes on leave', async () => {
    render(<WorkspaceSyncHarness />);

    act(() => {
      useGameStore.setState({
        roomId: 'main-library-2',
        connectionStatus: 'CONNECTED',
        characterState: 'SEATED',
        currentTableId: 'table_01',
        currentSeatId: 'T1_S1',
      });
    });

    await waitFor(() => {
      expect(transport.subscriptions.has('/topic/room/main-library-2/table/table_01/workspace')).toBe(true);
      expect(transport.subscriptions.has('/user/queue/voice')).toBe(true);
    });
    expect(transport.subscriptions.has('/topic/table/table_01/workspace')).toBe(false);

    await waitFor(() => expect(screen.getByTestId('table-member-u-bob')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('voice-join-btn'));
    await waitFor(() => expect(useVoiceStore.getState().inVoice).toBe(true));

    // Broadcast MUTE_STATUS arrives on room-scoped workspace topic
    act(() => {
      transport.emit('/topic/room/main-library-2/table/table_01/workspace', {
        type: 'VOICE_SIGNAL',
        roomId: 'main-library-2',
        tableId: 'table_01',
        actorUserId: 'u-bob',
        coHostUserIds: [],
        isFreeCollab: false,
        homeworkSlides: [],
        voiceSignal: {
          signalType: 'MUTE_STATUS',
          senderUserId: 'u-bob',
          senderNickname: 'Bob',
          muted: true,
        },
        timestampEpoch: Date.now(),
      });
    });
    expect(screen.getByTestId('voice-mute-badge-u-bob')).toHaveTextContent('Mic tắt');

    // Private SDP_OFFER arrives on /user/queue/voice and triggers SDP_ANSWER publish
    await act(async () => {
      transport.emit('/user/queue/voice', {
        type: 'VOICE_SIGNAL',
        roomId: 'main-library-2',
        tableId: 'table_01',
        actorUserId: 'u-bob',
        targetUserId: 'u-alice',
        coHostUserIds: [],
        isFreeCollab: false,
        homeworkSlides: [],
        voiceSignal: {
          signalType: 'SDP_OFFER',
          senderUserId: 'u-bob',
          senderNickname: 'Bob',
          targetUserId: 'u-alice',
          sdp: { type: 'offer', sdp: 'v=0-bob-offer' },
        },
        timestampEpoch: Date.now(),
      });
    });

    await waitFor(() => {
      expect(transport.published).toContainEqual({
        destination: '/app/table/table_01/voice.signal',
        body: expect.stringContaining('"signalType":"SDP_ANSWER"'),
      });
    });

    // Stale /user/queue/voice signal from another table or shard is ignored
    act(() => {
      transport.emit('/user/queue/voice', {
        type: 'VOICE_SIGNAL',
        roomId: 'main-library',
        tableId: 'table_01',
        actorUserId: 'u-other',
        targetUserId: 'u-alice',
        coHostUserIds: [],
        isFreeCollab: false,
        homeworkSlides: [],
        voiceSignal: {
          signalType: 'VOICE_JOIN',
          senderUserId: 'u-other',
          senderNickname: 'Other',
          muted: false,
        },
        timestampEpoch: Date.now(),
      });
    });
    expect(useVoiceStore.getState().peers['u-other']).toBeUndefined();

    // Leaving seat unsubscribes both room-scoped workspace topic and /user/queue/voice
    act(() => {
      useGameStore.getState().leaveSeat();
      useTableStore.getState().leaveTable();
    });

    await waitFor(() => {
      expect(transport.subscriptions.has('/topic/room/main-library-2/table/table_01/workspace')).toBe(false);
      expect(transport.subscriptions.has('/user/queue/voice')).toBe(false);
    });
  });
});
