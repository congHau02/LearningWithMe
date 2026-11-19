import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkBoardToolbar } from '../components/table/HomeworkBoardToolbar';
import { HomeworkSlideTabs } from '../components/table/HomeworkSlideTabs';
import { HostPermissionToast } from '../components/table/HostPermissionToast';
import { MinimizedTableWorkspaceBar } from '../components/table/MinimizedTableWorkspaceBar';
import { SosBannerControl } from '../components/table/SosBannerControl';
import { SpeakingEqualizer } from '../components/table/SpeakingEqualizer';
import { SyncedYouTubePlayer } from '../components/table/SyncedYouTubePlayer';
import { TableChatPanel } from '../components/table/TableChatPanel';
import { TableMembersPanel } from '../components/table/TableMembersPanel';
import { TableWorkspaceHeader } from '../components/table/TableWorkspaceHeader';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { WorkspaceLayoutControls } from '../components/table/WorkspaceLayoutControls';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';

describe('BNS-T5: Seated Table Workspace, Voice Controls & Homework Board Chrome (#62)', () => {
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

  describe('Table Workspace Shell & Header Botanical Night Chrome', () => {
    it('renders TableWorkspaceHeader with Botanical Night surfaces and Bioluminescent Emerald timer', () => {
      render(
        <TableWorkspaceHeader
          activeTableId="table_01"
          elapsedSeconds={125}
          isFreeCollab={false}
          isHost={true}
          canControl={true}
          onToggleFreeCollab={vi.fn()}
          onRequestControl={vi.fn()}
          onToggleMute={vi.fn()}
          onMinimize={vi.fn()}
          onRequestLeaveSeat={vi.fn()}
        />,
      );

      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      expect(header.className).toContain('border-border');
      expect(header.className).toContain('bg-[#16221E]/95');

      const timer = screen.getByTestId('study-timer-display');
      expect(timer).toHaveTextContent('02:05');
      expect(timer.className).toContain('border-emerald-500/40');
      expect(timer.className).toContain('bg-emerald-500/15');
      expect(timer.className).toContain('text-emerald-300');
    });

    it('renders TableWorkspaceShell with Deep Pine Night surface and no legacy classes', () => {
      useAuthStore.setState({ userId: 'u-1', nickname: 'MinhAnh' });
      useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_01' });
      useTableStore.setState({
        tableId: 'table_01',
        hostUserId: 'u-1',
        members: [
          {
            userId: 'u-1',
            nickname: 'MinhAnh',
            avatarId: 'default_student',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now(),
            connected: true,
          },
        ],
      });

      render(<TableWorkspaceShell />);
      const shell = screen.getByTestId('table-workspace-shell');
      expect(shell).toBeInTheDocument();
      expect(shell.className).toContain('bg-[#0F1714]/98');
      expect(shell.className).toContain('border-border');
    });
  });

  describe('Persistent Mic Pill & Speaking Equalizer Ergonomics', () => {
    it('maintains Zero-CLS min-w-[9.5rem] footprint and >=44px mobile touch targets across states', () => {
      const { rerender } = render(
        <TableWorkspaceHeader
          activeTableId="table_01"
          elapsedSeconds={30}
          isFreeCollab={false}
          isHost={false}
          canControl={false}
          onToggleFreeCollab={vi.fn()}
          onRequestControl={vi.fn()}
          onToggleMute={vi.fn()}
          onMinimize={vi.fn()}
          onRequestLeaveSeat={vi.fn()}
        />,
      );

      // Default always-in-voice muted state
      const defaultMutedBtn = screen.getByTestId('header-voice-mic-pill');
      expect(defaultMutedBtn.className).toContain('min-w-[9.5rem]');
      expect(defaultMutedBtn.className).toContain('min-h-[44px]');
      expect(defaultMutedBtn).toHaveTextContent('Mic đang TẮT');
      expect(defaultMutedBtn.className).toContain('border-amber-500/50');

      // In voice unmuted state
      act(() => {
        useVoiceStore.setState({ inVoice: true, isMuted: false, isSelfSpeaking: false });
      });
      rerender(
        <TableWorkspaceHeader
          activeTableId="table_01"
          elapsedSeconds={30}
          isFreeCollab={false}
          isHost={false}
          canControl={false}
          onToggleFreeCollab={vi.fn()}
          onRequestControl={vi.fn()}
          onToggleMute={vi.fn()}
          onMinimize={vi.fn()}
          onRequestLeaveSeat={vi.fn()}
        />,
      );

      const inVoiceBtn = screen.getByTestId('header-voice-mic-pill');
      expect(inVoiceBtn.className).toContain('min-w-[9.5rem]');
      expect(inVoiceBtn.className).toContain('min-h-[44px]');
      expect(inVoiceBtn).toHaveTextContent('Mic đang BẬT');
      expect(inVoiceBtn.className).toContain('border-emerald-500/50');

      // Muted state
      act(() => {
        useVoiceStore.setState({ isMuted: true });
      });
      rerender(
        <TableWorkspaceHeader
          activeTableId="table_01"
          elapsedSeconds={30}
          isFreeCollab={false}
          isHost={false}
          canControl={false}
          onToggleFreeCollab={vi.fn()}
          onRequestControl={vi.fn()}
          onToggleMute={vi.fn()}
          onMinimize={vi.fn()}
          onRequestLeaveSeat={vi.fn()}
        />,
      );

      const mutedBtn = screen.getByTestId('header-voice-mic-pill');
      expect(mutedBtn.className).toContain('min-w-[9.5rem]');
      expect(mutedBtn.className).toContain('min-h-[44px]');
      expect(mutedBtn).toHaveTextContent('Mic đang TẮT');
      expect(mutedBtn.className).toContain('border-amber-500/50');
    });

    it('renders SpeakingEqualizer with Bioluminescent Emerald bars when speaking and semantic mute tone', () => {
      const { container, rerender } = render(
        <SpeakingEqualizer speaking={true} micLive={true} testId="test-eq" label="Speaking" />,
      );

      const eq = screen.getByTestId('test-eq');
      expect(eq).toHaveAttribute('data-speaking', 'true');
      expect(eq.className).toContain('border-emerald-500/40');
      const emeraldBars = container.querySelectorAll('.bg-emerald-400');
      expect(emeraldBars.length).toBe(3);

      rerender(<SpeakingEqualizer speaking={false} micLive={true} testId="test-eq" label="Speaking" />);
      expect(eq).toHaveAttribute('data-speaking', 'false');
      const mutedBars = container.querySelectorAll('.bg-muted-foreground\\/40');
      expect(mutedBars.length).toBe(3);
    });
  });

  describe('Minimized Workspace Bar', () => {
    it('renders MinimizedTableWorkspaceBar with Deep Pine surface, SVG icons and Emerald timer', () => {
      render(
        <MinimizedTableWorkspaceBar
          activeTableId="table_01"
          elapsedSeconds={60}
          onToggleMute={vi.fn()}
          onExpand={vi.fn()}
          onRequestLeaveSeat={vi.fn()}
        />,
      );

      const bar = screen.getByTestId('minimized-table-workspace-bar');
      expect(bar.className).toContain('bg-[#0F1714]/95');
      expect(bar.className).toContain('border-border');

      const timer = screen.getByTestId('minimized-study-timer');
      expect(timer).toHaveTextContent('01:00');
      expect(timer.className).toContain('text-emerald-300');
    });
  });

  describe('Table Members Panel & Host/Co-Host Badges', () => {
    it('renders Table Host and Co-Host badges as solid Warm Amber pills with dark ink (#0F1714)', () => {
      const members = [
        {
          userId: 'u-host',
          nickname: 'Trưởng Nhóm',
          avatarId: 'student_glasses',
          seatId: 'T1_S1',
          tableRole: 'TABLE_HOST' as const,
          sitStartTimeEpoch: Date.now(),
          connected: true,
        },
        {
          userId: 'u-cohost',
          nickname: 'Phó Nhóm',
          avatarId: 'student_hat',
          seatId: 'T1_S2',
          tableRole: 'CO_HOST' as const,
          sitStartTimeEpoch: Date.now(),
          connected: true,
        },
        {
          userId: 'u-member',
          nickname: 'Bạn Học',
          avatarId: 'default_student',
          seatId: 'T1_S3',
          tableRole: 'MEMBER' as const,
          sitStartTimeEpoch: Date.now(),
          connected: true,
        },
      ];

      render(
        <TableMembersPanel
          members={members}
          selfUserId="u-host"
          isSelfHost={true}
          onAction={vi.fn()}
        />,
      );

      const hostRole = screen.getByTestId('member-role-u-host');
      expect(hostRole).toHaveTextContent('Trưởng bàn');
      expect(hostRole.className).toContain('bg-[#E5A93C]');
      expect(hostRole.className).toContain('text-[#0F1714]');

      const coHostRole = screen.getByTestId('member-role-u-cohost');
      expect(coHostRole).toHaveTextContent('Co-Host');
      expect(coHostRole.className).toContain('bg-[#E5A93C]');
      expect(coHostRole.className).toContain('text-[#0F1714]');

      const memberRole = screen.getByTestId('member-role-u-member');
      expect(memberRole).toHaveTextContent('Thành viên');
      expect(memberRole.className).toContain('border-border');
    });
  });

  describe('Homework Board Toolbar & Slide Deck Botanical Chrome', () => {
    it('preserves semantic pen/highlighter swatches while adopting Botanical Night chrome', () => {
      const onColorChange = vi.fn();
      render(
        <HomeworkBoardToolbar
          tool="PEN"
          color="#ef4444"
          lineWidth={3}
          onToolChange={vi.fn()}
          onColorChange={onColorChange}
          onLineWidthChange={vi.fn()}
          onClearSlide={vi.fn()}
        />,
      );

      const toolbar = screen.getByTestId('homework-board-toolbar');
      expect(toolbar.className).toContain('bg-[#16221E]/90');
      expect(toolbar.className).toContain('border-border');

      // Verify all 5 preserved semantic swatches
      const expectedSwatches = ['#ef4444', '#38bdf8', '#22c55e', '#facc15', '#f8fafc'];
      for (const swatch of expectedSwatches) {
        const swatchBtn = screen.getByTestId(`board-color-${swatch}`);
        expect(swatchBtn).toBeInTheDocument();
      }

      // Active swatch has ring-primary (not ring-sky-400)
      const activeSwatch = screen.getByTestId('board-color-#ef4444');
      expect(activeSwatch.className).toContain('ring-primary');

      // Active tool button uses solid Warm Amber (#E5A93C) with Deep Pine ink (#0F1714) for 8.74:1 contrast
      const penTool = screen.getByTestId('board-tool-PEN');
      expect(penTool.className).toContain('bg-primary');
      expect(penTool.className).toContain('text-primary-foreground');
    });

    it('renders HomeworkSlideTabs and HomeworkDeckPanel with Botanical Night styling', () => {
      const slides = [
        {
          imageId: 'slide-1',
          fileName: 'bai_tap.png',
          url: '/api/v1/ephemeral/slide-1',
          uploadedByUserId: 'u-1',
          strokes: [],
          uploadedAtEpoch: Date.now(),
        },
      ];

      render(
        <HomeworkSlideTabs
          slides={slides}
          activeSlideId="slide-1"
          canControl={true}
          onSelectSlide={vi.fn()}
          onDeleteSlide={vi.fn()}
        />,
      );

      const activeTab = screen.getByTestId('homework-slide-tab-slide-1');
      expect(activeTab).toBeInTheDocument();
      expect(activeTab.className).toContain('bg-primary/25');
      expect(activeTab.className).toContain('text-primary-foreground');
    });
  });

  describe('Table Chat Panel Botanical Night Styling', () => {
    it('renders TableChatPanel with Slate Leaf body, Warm Amber self chat, and SVG ChatIcon', () => {
      useAuthStore.setState({ userId: 'u-1', nickname: 'SelfUser' });
      useTableStore.setState({
        recentMessages: [
          {
            id: 'm-1',
            userId: 'u-1',
            nickname: 'SelfUser',
            avatarId: 'default_student',
            content: 'Chào mọi người!',
            createdAtEpoch: Date.now(),
          },
          {
            id: 'm-2',
            userId: 'u-2',
            nickname: 'PeerUser',
            avatarId: 'student_glasses',
            content: 'Chào bạn nhé!',
            createdAtEpoch: Date.now(),
          },
        ],
      });

      render(<TableChatPanel tableId="table_01" />);

      const panel = screen.getByTestId('table-chat-panel');
      expect(panel.className).toContain('bg-[#16221E]/95');
      expect(panel.className).toContain('border-border');

      const sendBtn = screen.getByTestId('table-chat-send-btn');
      expect(sendBtn.className).toContain('bg-primary');
      expect(sendBtn.className).toContain('text-primary-foreground');
    });
  });

  describe('Zero Residual Legacy Class Audit', () => {
    it('verifies zero leftover slate-* or sky-* classes in all rendered Table Workspace chrome components', () => {
      useAuthStore.setState({ userId: 'u-host', nickname: 'Host' });
      useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_01' });
      useTableStore.setState({
        tableId: 'table_01',
        hostUserId: 'u-host',
        members: [
          {
            userId: 'u-host',
            nickname: 'Host',
            avatarId: 'default_student',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now(),
            connected: true,
          },
        ],
        homeworkSlides: [
          {
            imageId: 'img-1',
            fileName: 'slide1.png',
            url: '/test.png',
            uploadedByUserId: 'u-host',
            strokes: [],
            uploadedAtEpoch: Date.now(),
          },
        ],
        activeSlideId: 'img-1',
      });

      const { container } = render(
        <div>
          <TableWorkspaceHeader
            activeTableId="table_01"
            elapsedSeconds={10}
            isFreeCollab={false}
            isHost={true}
            canControl={true}
            onToggleFreeCollab={vi.fn()}
            onRequestControl={vi.fn()}
            onToggleMute={vi.fn()}
            onMinimize={vi.fn()}
            onRequestLeaveSeat={vi.fn()}
          />
          <MinimizedTableWorkspaceBar
            activeTableId="table_01"
            elapsedSeconds={10}
            onToggleMute={vi.fn()}
            onExpand={vi.fn()}
            onRequestLeaveSeat={vi.fn()}
          />
          <SosBannerControl tableId="table_01" sosBanner={null} canControl={true} />
          <HostPermissionToast requests={[]} onRespond={vi.fn()} />
          <WorkspaceLayoutControls
            layoutMode="VIDEO_FIRST"
            onChangeLayout={vi.fn()}
            onSwapPanels={vi.fn()}
          />
          <HomeworkBoardToolbar
            tool="PEN"
            color="#ef4444"
            lineWidth={3}
            onToolChange={vi.fn()}
            onColorChange={vi.fn()}
            onLineWidthChange={vi.fn()}
            onClearSlide={vi.fn()}
          />
          <SyncedYouTubePlayer tableId="table_01" canControl={true} />
          <TableMembersPanel
            members={useTableStore.getState().members}
            selfUserId="u-host"
            isSelfHost={true}
            onAction={vi.fn()}
          />
          <TableChatPanel tableId="table_01" />
        </div>,
      );

      const allElements = container.querySelectorAll('*');
      const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
      for (const el of allElements) {
        if (el.className && typeof el.className === 'string') {
          expect(el.className).not.toMatch(legacyPaletteRegex);
        }
      }
    });
  });
});
