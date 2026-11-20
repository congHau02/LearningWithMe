import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import type { TableWorkspaceSnapshot } from '../services/tableApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

function seedWorkspaceSnapshot(
  currentUserId: string,
  overrides: Partial<TableWorkspaceSnapshot> = {},
) {
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
      homeworkSlides: [],
      activeSlideId: null,
      ...overrides,
    },
    currentUserId,
  );
}

describe('P9-T6 Mobile Direct Camera Capture for Homework Slide Upload', () => {
  const sendHomeworkSlideAction = vi.fn();
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

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

    seedWorkspaceSnapshot('u-host');

    URL.createObjectURL = vi.fn(() => 'blob:homework-camera');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  function mockCanvasWebpCompression(width = 3000, height = 4000) {
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

  it('shows camera capture button for Host, Co-Host, and Free Collab members, and hides it for unauthorized members', () => {
    const { rerender } = render(<TableWorkspaceShell />);

    const cameraBtn = screen.getByTestId('homework-camera-btn');
    expect(cameraBtn).toBeEnabled();
    expect(cameraBtn).toHaveTextContent('Chụp bài tập');
    expect(cameraBtn.textContent).not.toContain('📷');
    expect(cameraBtn.querySelector('svg')).toBeInTheDocument();
    expect(cameraBtn).toHaveAttribute('aria-label', 'Chụp bài tập bằng camera sau');
    expect(cameraBtn.className).toContain('min-h-[44px]');
    expect(cameraBtn.className).toContain('min-w-[44px]');

    const cameraInput = screen.getByTestId('homework-camera-input') as HTMLInputElement;
    expect(cameraInput).toHaveAttribute('type', 'file');
    expect(cameraInput).toHaveAttribute('accept', 'image/*');
    expect(cameraInput).toHaveAttribute('capture', 'environment');

    // Unauthorized Member: hidden
    act(() => {
      useAuthStore.setState({ userId: 'u-member', token: 'jwt-member' });
      seedWorkspaceSnapshot('u-member');
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.queryByTestId('homework-camera-btn')).toBeNull();
    expect(screen.queryByTestId('homework-camera-input')).toBeNull();

    // Co-Host: visible
    act(() => {
      seedWorkspaceSnapshot('u-member', { coHostUserIds: ['u-member'] });
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.getByTestId('homework-camera-btn')).toBeEnabled();

    // Free Collaboration: visible for Member
    act(() => {
      seedWorkspaceSnapshot('u-member', { coHostUserIds: [], isFreeCollab: true });
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.getByTestId('homework-camera-btn')).toBeEnabled();
  });

  it('compresses captured camera photo to 1920px webp (q=0.85), shows uploading feedback, and uploads it', async () => {
    const { fakeCanvas } = mockCanvasWebpCompression(3000, 4000);
    let resolveUpload!: () => void;
    const uploadPromise = new Promise<void>((resolve) => {
      resolveUpload = resolve;
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      await uploadPromise;
      return {
        ok: true,
        status: 201,
        json: async () => ({
          imageId: 'img-cam-1',
          fileName: 'img-cam-1.webp',
          url: '/api/v1/ephemeral-files/img-cam-1.webp',
          uploadedByUserId: 'u-host',
          uploadedAtEpoch: 5000,
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TableWorkspaceShell />);

    const cameraInput = screen.getByTestId('homework-camera-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(cameraInput, 'click');
    fireEvent.click(screen.getByTestId('homework-camera-btn'));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'IMG_20261117.jpg', {
      type: 'image/jpeg',
    });
    await act(async () => {
      fireEvent.change(cameraInput, { target: { files: [photo] } });
    });

    await waitFor(() => {
      const btn = screen.getByTestId('homework-camera-btn');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('Đang tải...');
      expect(btn).toHaveAttribute('aria-label', 'Đang tải...');
    });

    await act(async () => {
      resolveUpload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/homework-image'))).toHaveLength(1);
      expect(screen.getByTestId('homework-camera-btn')).toBeEnabled();
    });
    expect(fakeCanvas.width).toBe(1440);
    expect(fakeCanvas.height).toBe(1920);
  });

  it('disables camera capture button when 5-slide limit is reached and surfaces upload errors', async () => {
    seedWorkspaceSnapshot('u-host', {
      homeworkSlides: Array.from({ length: 5 }, (_, i) => ({
        imageId: `img-00${i + 1}`,
        fileName: `img-00${i + 1}.webp`,
        url: `/api/v1/ephemeral-files/img-00${i + 1}.webp`,
        uploadedByUserId: 'u-host',
        uploadedAtEpoch: 1000 + i,
      })),
      activeSlideId: 'img-001',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () => new Blob(['RIFF1234WEBP'], { type: 'image/webp' }),
      })),
    );

    render(<TableWorkspaceShell />);
    expect(screen.getByTestId('homework-camera-btn')).toBeDisabled();

    // Now test error handling when deck has space (< 5 slides) and invalid file is selected
    act(() => {
      seedWorkspaceSnapshot('u-host');
    });

    const cameraInput = screen.getByTestId('homework-camera-input') as HTMLInputElement;
    const badFile = new File(['not-an-image'], 'notes.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(cameraInput, { target: { files: [badFile] } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('homework-upload-error')).toHaveTextContent(
        'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.',
      );
    });
  });
});
