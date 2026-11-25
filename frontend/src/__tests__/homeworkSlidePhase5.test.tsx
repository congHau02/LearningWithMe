import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { compressImageToWebp } from '../utils/homeworkImageCompression';

describe('P5-T1 Homework Slide Upload, Ctrl+V Paste, WebP Compression & Multi-Slide Deck', () => {
  const sendHomeworkSlideAction = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'HostUser',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });

    setActiveRoomStompSession({
      sendHomeworkSlideAction,
    } as unknown as RoomStompSession);

    useGameStore.setState({
      characterState: 'SEATED',
      roomId: 'main-library',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
      connectionStatus: 'CONNECTED',
    });

    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-host',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'u-host',
            nickname: 'HostUser',
            avatarId: 'avatar_01',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now() - 10_000,
            connected: true,
          },
          {
            userId: 'u-member',
            nickname: 'MemberUser',
            avatarId: 'avatar_02',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: Date.now() - 5_000,
            connected: true,
          },
        ],
        homeworkSlides: [
          {
            imageId: 'img-001',
            fileName: 'img-001.webp',
            url: '/api/v1/ephemeral-files/img-001.webp',
            uploadedByUserId: 'u-host',
            uploadedAtEpoch: 1000,
          },
          {
            imageId: 'img-002',
            fileName: 'img-002.webp',
            url: '/api/v1/ephemeral-files/img-002.webp',
            uploadedByUserId: 'u-host',
            uploadedAtEpoch: 2000,
          },
        ],
        activeSlideId: 'img-001',
      },
      'u-host',
    );
  });

  function mockCanvasWebpCompression(width = 3840, height = 2160) {
    const drawImage = vi.fn();
    const toBlob = vi.fn((cb: BlobCallback, type?: string, quality?: number) => {
      expect(type).toBe('image/webp');
      expect(quality).toBe(0.85);
      cb(new Blob(['RIFF1234WEBP'], { type: 'image/webp' }));
    });
    const origCreateElement = document.createElement.bind(document);
    const fakeCanvas = origCreateElement('canvas');
    fakeCanvas.getContext = (() => ({
      drawImage,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    })) as unknown as typeof fakeCanvas.getContext;
    fakeCanvas.toBlob = toBlob as unknown as typeof fakeCanvas.toBlob;

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        return fakeCanvas;
      }
      return origCreateElement(tagName);
    });

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
    return { fakeCanvas, drawImage, toBlob };
  }

  it('compresses oversized image to maxDimension 1920 and quality 0.85 webp', async () => {
    const { fakeCanvas } = mockCanvasWebpCompression(3840, 2160);
    const input = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'problem.png', {
      type: 'image/png',
    });

    const compressed = await compressImageToWebp(input, { maxDimension: 1920, quality: 0.85 });

    expect(fakeCanvas.width).toBe(1920);
    expect(fakeCanvas.height).toBe(1080);
    expect(compressed.type).toBe('image/webp');
    expect(compressed.name).toBe('problem.webp');
  });

  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  function mockObjectUrlApis() {
    let counter = 0;
    const createObjectURL = vi.fn(() => `blob:homework-${++counter}`);
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    return { createObjectURL, revokeObjectURL };
  }

  it('allows Host to upload via file input and Ctrl+V paste, switch slides, and delete slide', async () => {
    mockCanvasWebpCompression(1200, 800);
    const { revokeObjectURL } = mockObjectUrlApis();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/ephemeral-files/')) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob(['RIFF1234WEBP'], { type: 'image/webp' }),
        };
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({
          imageId: 'img-003',
          fileName: 'img-003.webp',
          url: '/api/v1/ephemeral-files/img-003.webp',
          uploadedByUserId: 'u-host',
          uploadedAtEpoch: 3000,
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<TableWorkspaceShell />);

    expect(screen.getByTestId('homework-slide-counter')).toHaveTextContent('2/5');
    await waitFor(() =>
      expect(screen.getByTestId('homework-active-image')).toHaveAttribute('src', 'blob:homework-1'),
    );
    const imgFetchCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/v1/ephemeral-files/img-001.webp'));
    expect(imgFetchCall).toBeDefined();
    expect(new Headers(imgFetchCall![1]?.headers).get('Authorization')).toBe('Bearer jwt-host');

    // File input upload -> opens Rotate & Crop modal, confirm via 1-tap full image
    const fileInput = screen.getByTestId('homework-file-input') as HTMLInputElement;
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'hw.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [pngFile] } });
    expect(screen.getByTestId('homework-crop-rotate-modal')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-use-full-btn'));
    });

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/homework-image'))).toHaveLength(1),
    );

    // Ctrl+V paste upload -> opens Rotate & Crop modal, confirm upload
    const pastedFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'clip.png', { type: 'image/png' });
    fireEvent.paste(screen.getByTestId('homework-deck-panel'), {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => pastedFile,
          },
        ],
      },
    });
    expect(screen.getByTestId('homework-crop-rotate-modal')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('crop-use-full-btn'));
    });
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/homework-image'))).toHaveLength(2),
    );

    // Switch slide via STOMP
    fireEvent.click(screen.getByTestId('homework-slide-tab-img-002'));
    expect(sendHomeworkSlideAction).toHaveBeenCalledWith('table_01', {
      action: 'SELECT',
      imageId: 'img-002',
    });

    // Delete slide via STOMP
    fireEvent.click(screen.getByTestId('homework-slide-delete-img-001'));
    expect(sendHomeworkSlideAction).toHaveBeenCalledWith('table_01', {
      action: 'DELETE',
      imageId: 'img-001',
    });

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:homework-1');
  });

  it('locks upload, paste, switch and delete controls for unauthorized Member, syncs STOMP events, and revokes ObjectURL on switch/leave', async () => {
    useAuthStore.setState({ userId: 'u-member', token: 'jwt-member' });
    const { revokeObjectURL } = mockObjectUrlApis();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/ephemeral-files/')) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob(['RIFF1234WEBP'], { type: 'image/webp' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TableWorkspaceShell />);

    await waitFor(() =>
      expect(screen.getByTestId('homework-active-image')).toHaveAttribute('src', 'blob:homework-1'),
    );
    expect(screen.queryByTestId('homework-upload-btn')).toBeNull();
    expect(screen.queryByTestId('homework-slide-delete-img-001')).toBeNull();
    expect(screen.getByTestId('homework-slide-tab-img-002')).toBeDisabled();

    // Paste should do nothing for Member
    const pastedFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'clip.png', { type: 'image/png' });
    fireEvent.paste(screen.getByTestId('homework-deck-panel'), {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => pastedFile }],
      },
    });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/homework-image'))).toHaveLength(0);

    // STOMP event updates activeSlideId and revokes previous slide ObjectURL
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'HOMEWORK_SLIDE_SELECTED',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          homeworkSlides: useTableStore.getState().homeworkSlides,
          activeSlideId: 'img-002',
          timestampEpoch: 4000,
        },
        'u-member',
      );
    });

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:homework-1');
    await waitFor(() =>
      expect(screen.getByTestId('homework-active-image')).toHaveAttribute('src', 'blob:homework-2'),
    );

    // Leaving table unmounts workspace and revokes active ObjectURL
    act(() => {
      useGameStore.getState().leaveSeat();
      useTableStore.getState().leaveTable();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:homework-2');
  });
});
