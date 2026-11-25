import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { LeaveTableConfirmModal } from '../components/hud/LeaveTableConfirmModal';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import * as studyPackExporter from '../utils/studyPackExporter';

describe('P12-T7 Slice 3: Leave-Seat Safeguard Prompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('intercepts workspace leave-seat button when Study Pack content exists and shows safeguard modal with final-learner warning', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const pdfSpy = vi.spyOn(studyPackExporter, 'exportStudyPackAsPdf').mockResolvedValue('table_01-study-pack.pdf');

    useAuthStore.setState({ userId: 'u-last', nickname: 'FinalLearner', authProvider: 'GUEST', token: 'jwt-1' });
    useGameStore.setState({
      roomId: 'main-library',
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-last',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'u-last',
            nickname: 'FinalLearner',
            avatarId: 'default_student',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1000,
            connected: true,
          },
        ],
        homeworkSlides: [
          {
            imageId: 's-1',
            fileName: 'toan-8.webp',
            url: '/api/v1/ephemeral/s-1.webp',
            uploadedByUserId: 'u-last',
            uploadedAtEpoch: 1500,
            strokes: [],
          },
        ],
        activeSlideId: 's-1',
        scratchpadState: {
          content: 'Bước 1: $x + 1 = 3$',
          updatedByUserId: 'u-last',
          updatedByNickname: 'FinalLearner',
          updatedAtEpoch: 1600,
        },
      },
      'u-last',
    );

    render(<App />);

    const workspaceLeaveBtn = await screen.findByTestId('workspace-leave-seat-btn');
    fireEvent.click(workspaceLeaveBtn);

    // Must open LeaveTableConfirmModal instead of leaving immediately
    expect(useGameStore.getState().isPendingSeatLeave).toBe(false);
    expect(screen.getByTestId('leave-seat-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('leave-seat-study-pack-notice')).toBeInTheDocument();
    expect(screen.getByTestId('leave-seat-final-learner-warning')).toHaveTextContent(/người cuối cùng/i);

    const exportAndLeaveBtn = screen.getByTestId('export-and-leave-seat-btn');
    const leaveNowBtn = screen.getByTestId('confirm-leave-seat-btn');
    expect(exportAndLeaveBtn).toHaveTextContent('Tải vở bài giảng & Rời bàn');
    expect(leaveNowBtn).toHaveTextContent('Rời bàn ngay');

    fireEvent.click(exportAndLeaveBtn);
    await waitFor(() => expect(pdfSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useGameStore.getState().characterState).toBe('FREE_ROAM'));
    expect(screen.queryByTestId('leave-seat-confirm-dialog')).not.toBeInTheDocument();
  });

  it('omits final-learner warning when multiple learners are seated and allows immediate exit without export', () => {
    const pdfSpy = vi.spyOn(studyPackExporter, 'exportStudyPackAsPdf');
    const onConfirmLeave = vi.fn();

    useTableStore.setState({
      tableId: 'table_02',
      members: [
        {
          userId: 'u-1',
          nickname: 'One',
          avatarId: 'default_student',
          seatId: 'T2_S1',
          tableRole: 'TABLE_HOST',
          sitStartTimeEpoch: 1000,
          connected: true,
        },
        {
          userId: 'u-2',
          nickname: 'Two',
          avatarId: 'default_student',
          seatId: 'T2_S2',
          tableRole: 'MEMBER',
          sitStartTimeEpoch: 2000,
          connected: true,
        },
      ],
      homeworkSlides: [
        {
          imageId: 's-1',
          fileName: 'hinh.webp',
          url: '/api/v1/ephemeral/s-1.webp',
          uploadedByUserId: 'u-1',
          uploadedAtEpoch: 1000,
          strokes: [],
        },
      ],
    });

    render(
      <LeaveTableConfirmModal
        tableId="table_02"
        seatId="T2_S2"
        onConfirmLeave={onConfirmLeave}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('leave-seat-study-pack-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('leave-seat-final-learner-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('export-and-leave-seat-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-leave-seat-btn'));
    expect(onConfirmLeave).toHaveBeenCalledTimes(1);
    expect(pdfSpy).not.toHaveBeenCalled();
  });

  it('keeps immediate leave behavior on workspace button when board and scratchpad are empty', () => {
    useAuthStore.setState({ userId: 'u-1', nickname: 'EmptyUser' });
    useGameStore.setState({
      roomId: 'main-library',
      characterState: 'SEATED',
      currentTableId: 'table_03',
      currentSeatId: 'T3_S1',
    });
    useTableStore.setState({
      tableId: 'table_03',
      hostUserId: 'u-1',
      members: [
        {
          userId: 'u-1',
          nickname: 'EmptyUser',
          avatarId: 'default_student',
          seatId: 'T3_S1',
          tableRole: 'TABLE_HOST',
          sitStartTimeEpoch: 1000,
          connected: true,
        },
      ],
      homeworkSlides: [],
      scratchpadState: { content: '', updatedByUserId: null, updatedByNickname: null, updatedAtEpoch: 0 },
    });

    render(<TableWorkspaceShell />);
    fireEvent.click(screen.getByTestId('workspace-leave-seat-btn'));
    expect(useGameStore.getState().isPendingSeatLeave).toBe(true);
    expect(useGameStore.getState().isLeaveConfirmOpen).toBe(false);
  });

  it('never blocks "Rời bàn ngay" while PDF export is still in flight', () => {
    vi.spyOn(studyPackExporter, 'exportStudyPackAsPdf').mockImplementation(
      () => new Promise(() => {}), // stays pending
    );
    const onConfirmLeave = vi.fn();

    useTableStore.setState({
      tableId: 'table_04',
      homeworkSlides: [
        {
          imageId: 's-1',
          fileName: 'toan.webp',
          url: '/api/v1/ephemeral/s-1.webp',
          uploadedByUserId: 'u-1',
          uploadedAtEpoch: 1000,
          strokes: [],
        },
      ],
    });

    render(
      <LeaveTableConfirmModal
        tableId="table_04"
        seatId="T4_S1"
        onConfirmLeave={onConfirmLeave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('export-and-leave-seat-btn'));
    const leaveNowBtn = screen.getByTestId('confirm-leave-seat-btn');
    expect(leaveNowBtn).toBeEnabled();
    fireEvent.click(leaveNowBtn);
    expect(onConfirmLeave).toHaveBeenCalledTimes(1);
  });
});
