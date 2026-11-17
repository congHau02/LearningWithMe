import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';

describe('P9-T3 Zero-CLS Voice Mic Indicators & Persistent Table Header Mic Control', () => {
  const sendVoiceSignal = vi.fn();
  let localTracks: Array<{ kind: string; enabled: boolean; stop: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localTracks = [];

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
      subscribeTableWorkspace: vi.fn(),
      unsubscribeTableWorkspace: vi.fn(),
      sendVoiceSignal,
      sendLeave: vi.fn(),
    } as unknown as RoomStompSession);

    class FakeMediaStream {
      private readonly tracks: Array<{ kind: string; enabled: boolean; stop: ReturnType<typeof vi.fn> }>;
      constructor(tracks: Array<{ kind: string; enabled: boolean; stop: ReturnType<typeof vi.fn> }> = []) {
        this.tracks = tracks;
      }
      getTracks() {
        return this.tracks;
      }
      getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
      }
    }

    vi.stubGlobal('MediaStream', FakeMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          const track = { kind: 'audio', enabled: true, stop: vi.fn() };
          localTracks.push(track);
          return new FakeMediaStream([track]);
        }),
      },
    });

    useGameStore.setState({
      connectionStatus: 'CONNECTED',
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });

    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-alice',
      coHostUserIds: [],
      isFreeCollab: false,
      sitStartTimeEpoch: Date.now() - 10_000,
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
    });
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
  });

  it('pre-allocates fixed-size speaking indicator slots without inserting/removing "Bạn đang nói" text', () => {
    render(<TableWorkspaceShell />);

    const selfIndicator = screen.getByTestId('self-speaking-indicator');
    const aliceMemberIndicator = screen.getByTestId('speaking-indicator-u-alice');
    const bobMemberIndicator = screen.getByTestId('speaking-indicator-u-bob');

    expect(selfIndicator).toHaveAttribute('data-speaking', 'false');
    expect(aliceMemberIndicator).toHaveAttribute('data-speaking', 'false');
    expect(bobMemberIndicator).toHaveAttribute('data-speaking', 'false');
    expect(screen.queryByText('Bạn đang nói')).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setInVoice(true, false);
      useVoiceStore.getState().setSelfSpeaking(true);
      useVoiceStore.getState().upsertPeer({
        userId: 'u-bob',
        nickname: 'Bob',
        muted: false,
        speaking: true,
        connectionState: 'connected',
      });
    });

    expect(screen.getByTestId('self-speaking-indicator')).toBe(selfIndicator);
    expect(selfIndicator).toHaveAttribute('data-speaking', 'true');
    expect(aliceMemberIndicator).toHaveAttribute('data-speaking', 'true');
    expect(bobMemberIndicator).toHaveAttribute('data-speaking', 'true');
    expect(screen.queryByText('Bạn đang nói')).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setSelfSpeaking(false);
    });
    expect(screen.getByTestId('self-speaking-indicator')).toBe(selfIndicator);
    expect(selfIndicator).toHaveAttribute('data-speaking', 'false');
  });

  it('renders persistent header mic pill beside timer, joins voice, and syncs explicit BẬT/TẮT state with VoiceChatBar', async () => {
    render(<TableWorkspaceShell />);

    const headerPill = screen.getByTestId('header-voice-mic-pill');
    expect(headerPill).toBeInTheDocument();

    // Quick join from header pill
    fireEvent.click(headerPill);
    await waitFor(() => {
      expect(useVoiceStore.getState().inVoice).toBe(true);
    });

    const activeHeaderPill = screen.getByTestId('header-voice-mic-pill');
    const barMuteBtn = screen.getByTestId('voice-mute-btn');

    expect(activeHeaderPill).toHaveTextContent('Mic đang BẬT');
    expect(activeHeaderPill).toHaveAttribute('aria-pressed', 'true');
    expect(barMuteBtn).toHaveTextContent('Mic đang BẬT');
    expect(barMuteBtn).toHaveAttribute('aria-pressed', 'true');

    // Toggle mute from header pill -> updates both header pill, VoiceChatBar, and audio track
    fireEvent.click(activeHeaderPill);
    expect(localTracks[0].enabled).toBe(false);
    expect(activeHeaderPill).toHaveTextContent('Mic đang TẮT');
    expect(activeHeaderPill).toHaveAttribute('aria-pressed', 'false');
    expect(barMuteBtn).toHaveTextContent('Mic đang TẮT');
    expect(barMuteBtn).toHaveAttribute('aria-pressed', 'false');

    // Toggle unmute from VoiceChatBar -> header pill stays synchronized
    fireEvent.click(barMuteBtn);
    expect(localTracks[0].enabled).toBe(true);
    expect(activeHeaderPill).toHaveTextContent('Mic đang BẬT');
    expect(activeHeaderPill).toHaveAttribute('aria-pressed', 'true');
  });
});
