import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { setActiveRoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import * as studyPackExporter from '../utils/studyPackExporter';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('P12-T7 Slice 2: Study Pack Export Controls (Desktop, Mobile & Member Permissions)', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    setViewportWidth(1280);
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();
    setActiveRoomStompSession(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    setViewportWidth(originalWidth);
    vi.restoreAllMocks();
  });

  it('allows a seated Table Member (canControl=false) to export active slide PNG and full Study Pack PDF', async () => {
    const pngSpy = vi.spyOn(studyPackExporter, 'exportActiveSlideAsPng').mockResolvedValue('table_01-slide-1.png');
    const pdfSpy = vi.spyOn(studyPackExporter, 'exportStudyPackAsPdf').mockResolvedValue('table_01-study-pack.pdf');

    useAuthStore.setState({ userId: 'member-1', nickname: 'HocSinh', token: 'jwt-member' });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'host-1',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'host-1',
            nickname: 'GiaSu',
            avatarId: 'default_student',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1000,
            connected: true,
          },
          {
            userId: 'member-1',
            nickname: 'HocSinh',
            avatarId: 'default_student',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: 2000,
            connected: true,
          },
        ],
        homeworkSlides: [
          {
            imageId: 'slide-1',
            fileName: 'hinh-7.webp',
            url: '/api/v1/ephemeral/slide-1.webp',
            uploadedByUserId: 'host-1',
            uploadedAtEpoch: 1500,
            strokes: [],
          },
        ],
        activeSlideId: 'slide-1',
        scratchpadState: {
          content: 'Bước 1: $\\triangle ABC = \\triangle DEF$',
          updatedByUserId: 'host-1',
          updatedByNickname: 'GiaSu',
          updatedAtEpoch: 2500,
        },
      },
      'member-1',
    );

    render(<HomeworkDeckPanel tableId="table_01" canControl={false} />);

    const pngBtn = screen.getByTestId('export-slide-png-btn');
    const pdfBtn = screen.getByTestId('export-study-pack-pdf-btn');
    expect(pngBtn).toBeEnabled();
    expect(pdfBtn).toBeEnabled();

    fireEvent.click(pngBtn);
    await waitFor(() => expect(pngSpy).toHaveBeenCalledTimes(1));
    expect(pngSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'table_01',
        slideIndex: 0,
        token: 'jwt-member',
      }),
    );

    fireEvent.click(pdfBtn);
    await waitFor(() => expect(pdfSpy).toHaveBeenCalledTimes(1));
    expect(pdfSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'table_01',
        token: 'jwt-member',
      }),
    );
  });

  it('exposes Study Pack PDF export in mobile ⋯ menu (keeping 3 header buttons) and Clear View board', async () => {
    const pdfSpy = vi.spyOn(studyPackExporter, 'exportStudyPackAsPdf').mockResolvedValue('table_02-study-pack.pdf');
    setViewportWidth(375);

    useAuthStore.setState({ userId: 'member-2', nickname: 'MobileLearner', token: 'jwt-m2' });
    useGameStore.setState({
      roomId: 'main-library',
      characterState: 'SEATED',
      currentTableId: 'table_02',
      currentSeatId: 'T2_S2',
    });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_02',
        hostUserId: 'host-2',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'host-2',
            nickname: 'Tutor',
            avatarId: 'default_student',
            seatId: 'T2_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1000,
            connected: true,
          },
          {
            userId: 'member-2',
            nickname: 'MobileLearner',
            avatarId: 'default_student',
            seatId: 'T2_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: 2000,
            connected: true,
          },
        ],
        homeworkSlides: [],
        activeSlideId: null,
        scratchpadState: {
          content: 'Bước 1: $ƯCLN(12, 18) = 6$',
          updatedByUserId: 'host-2',
          updatedByNickname: 'Tutor',
          updatedAtEpoch: 2500,
        },
      },
      'member-2',
    );

    render(<TableWorkspaceShell />);

    // Clear View board has Study Pack PDF button enabled even with 0 slides when scratchpad has content
    expect(screen.getByTestId('export-study-pack-pdf-btn')).toBeEnabled();
    expect(screen.getByTestId('export-slide-png-btn')).toBeDisabled();

    // Mobile ⋯ menu also exposes Study Pack export with >= 44px touch target
    fireEvent.click(screen.getByTestId('workspace-collab-menu-btn'));
    const menuExportBtn = screen.getByTestId('menu-export-study-pack-btn');
    expect(menuExportBtn.className).toContain('min-h-11');
    fireEvent.click(menuExportBtn);

    await waitFor(() => expect(pdfSpy).toHaveBeenCalledTimes(1));
  });
});
