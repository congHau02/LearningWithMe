import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomChatBox } from '../components/hud/RoomChatBox';
import { MathWorkspaceTabsPanel } from '../components/table/MathWorkspaceTabsPanel';
import { TableChatPanel } from '../components/table/TableChatPanel';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import {
  extractActiveScratchpadStep,
  extractLatexFormulaForSlide,
  insertMathToken,
  parseMathSegments,
  splitDerivationSteps,
} from '../utils/mathLatex';

describe('P10-T4 Collaborative Math Scratchpad & Inline/Block LaTeX in Table/Room Chat (#68)', () => {
  const sendTableChat = vi.fn();
  const sendScratchpadUpdate = vi.fn();
  const sendBoardDraw = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'HostAn',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });
    setActiveRoomStompSession({
      sendTableChat,
      sendScratchpadUpdate,
      sendBoardDraw,
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    vi.useRealTimers();
    setActiveRoomStompSession(null);
    cleanup();
  });

  it('parses inline, block, escaped, and unmatched dollar delimiters cleanly', () => {
    expect(parseMathSegments('Nghiệm $x = 2$ và $$\\frac{a}{b}$$ giá \\$5 còn $dư')).toEqual([
      { type: 'text', content: 'Nghiệm ' },
      { type: 'inline-math', content: 'x = 2' },
      { type: 'text', content: ' và ' },
      { type: 'block-math', content: '\\frac{a}{b}' },
      { type: 'text', content: ' giá $5 còn $dư' },
    ]);

    expect(insertMathToken('Đáp án: ', 8, 8, '\\sqrt{x}', 200)).toEqual({
      value: 'Đáp án: $\\sqrt{x}$',
      cursor: 18,
    });
    expect(insertMathToken('$x + ', 5, 5, '\\pi', 200)).toEqual({
      value: '$x + \\pi',
      cursor: 8,
    });
    expect(extractActiveScratchpadStep('B1: $a$\nB2: $b$', 10, 10)).toBe('B2: $b$');
    expect(extractLatexFormulaForSlide('Bước 1: $\\Delta = b^2 - 4ac$')).toBe('\\Delta = b^2 - 4ac');
    expect(splitDerivationSteps('Bước 1: $a=1$\n$$\n\\begin{aligned}\nx&=2\\\\\ny&=3\n\\end{aligned}\n$$\nKết luận')).toEqual([
      'Bước 1: $a=1$',
      '$$\n\\begin{aligned}\nx&=2\\\\\ny&=3\n\\end{aligned}\n$$',
      'Kết luận',
    ]);
  });

  it('renders inline and block LaTeX safely without XSS in both Table Chat and Room Chat', () => {
    const xssAndMath =
      '<script>window.__xss=1</script> Giải $x^2 + 1 = 0$ và $$\\int_0^1 x\\,dx$$ $<img src=x onerror=alert(1)>$ $$\\href{javascript:alert(1)}{click}$$';

    useTableStore.setState({
      tableId: 'table_01',
      recentMessages: [
        {
          id: 'tm-1',
          userId: 'u-peer',
          nickname: 'PeerBinh',
          avatarId: 'avatar_02',
          content: xssAndMath,
          createdAtEpoch: 1_700_000_000_000,
        },
      ],
    });
    useGameStore.setState({
      roomId: 'main-library',
      recentMessages: [
        {
          id: 'rm-1',
          userId: 'u-peer',
          nickname: 'PeerBinh',
          avatarId: 'avatar_02',
          content: xssAndMath,
          createdAtEpoch: 1_700_000_000_000,
        },
      ],
    });

    const { container } = render(
      <div>
        <TableChatPanel tableId="table_01" />
        <RoomChatBox initialOpen={true} />
      </div>,
    );

    expect(container.querySelectorAll('[data-math-kind="inline"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('[data-math-kind="block"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('inserts LaTeX symbol snippets from the compact Table Chat quick-insert bar', async () => {
    render(<TableChatPanel tableId="table_01" />);

    const input = screen.getByTestId('table-chat-input') as HTMLInputElement;
    fireEvent.click(screen.getByTestId('table-chat-math-sym-frac'));
    expect(input.value).toBe('$\\frac{a}{b}$');

    fireEvent.click(screen.getByTestId('table-chat-send-btn'));
    await waitFor(() => expect(sendTableChat).toHaveBeenCalledWith('table_01', '$\\frac{a}{b}$'));
  });

  it('navigates 3 Math Workspace tabs with Studio SVG icons, Warm Amber active ink, and zero state unmounting', () => {
    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      homeworkSlides: [],
      activeSlideId: null,
    });

    render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);

    const boardTab = screen.getByTestId('math-workspace-tab-board');
    const scratchpadTab = screen.getByTestId('math-workspace-tab-scratchpad');
    const grapherTab = screen.getByTestId('math-workspace-tab-grapher');

    expect(boardTab).toHaveAttribute('aria-selected', 'true');
    expect(boardTab.className).toContain('bg-primary');
    expect(boardTab.className).toContain('text-primary-foreground');
    expect(boardTab.querySelector('svg')).toBeInTheDocument();
    expect(scratchpadTab.querySelector('svg')).toBeInTheDocument();
    expect(grapherTab.querySelector('svg')).toBeInTheDocument();

    const mountedBoardPanel = screen.getByTestId('homework-deck-panel');

    fireEvent.click(scratchpadTab);
    expect(scratchpadTab).toHaveAttribute('aria-selected', 'true');
    expect(scratchpadTab.className).toContain('bg-primary');
    expect(scratchpadTab.className).toContain('text-primary-foreground');

    const editor = screen.getByTestId('scratchpad-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'Bước 1: $x + 1 = 2$' } });

    // Keyboard ArrowRight switches to Grapher tab without unmounting Board or Scratchpad
    fireEvent.keyDown(scratchpadTab, { key: 'ArrowRight' });
    expect(grapherTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('math-grapher-placeholder')).toBeVisible();
    expect(screen.getByTestId('homework-deck-panel')).toBe(mountedBoardPanel);
    expect((screen.getByTestId('scratchpad-editor') as HTMLTextAreaElement).value).toBe('Bước 1: $x + 1 = 2$');
  });

  it('synchronizes Math Scratchpad edits over STOMP, pushes step to Table Chat, and stamps formula onto active Slide', () => {
    vi.useFakeTimers();
    useGameStore.setState({ characterState: 'SEATED', currentTableId: 'table_01', currentSeatId: 'T1_S1' });
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
            nickname: 'HostAn',
            avatarId: 'avatar_01',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1_700_000_000_000,
            connected: true,
          },
        ],
        homeworkSlides: [
          {
            imageId: 'slide-1',
            fileName: 'oxy.webp',
            url: '/api/v1/ephemeral-files/slide-1.webp',
            uploadedByUserId: 'u-host',
            uploadedAtEpoch: 1_700_000_000_000,
            strokes: [],
          },
        ],
        activeSlideId: 'slide-1',
        scratchpadState: {
          content: 'Bước 1: $x^2 - 4 = 0$',
          updatedByUserId: 'u-cohost',
          updatedByNickname: 'CoHostBinh',
          updatedAtEpoch: 1_700_000_001_000,
        },
      },
      'u-host',
    );

    render(<TableWorkspaceShell />);

    fireEvent.click(screen.getByTestId('math-workspace-tab-scratchpad'));
    const editor = screen.getByTestId('scratchpad-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('Bước 1: $x^2 - 4 = 0$');
    expect(screen.getByTestId('scratchpad-editor-meta')).toHaveTextContent('Cập nhật bởi CoHostBinh');

    // Host edits scratchpad -> debounced STOMP publish
    fireEvent.change(editor, {
      target: { value: 'Bước 1: $x^2 - 4 = 0$\nBước 2: $$x = \\pm 2$$' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(sendScratchpadUpdate).toHaveBeenCalledWith(
      'table_01',
      'Bước 1: $x^2 - 4 = 0$\nBước 2: $$x = \\pm 2$$',
    );

    // Select step 2 and push to Table Chat
    fireEvent.click(screen.getByTestId('scratchpad-step-1'));
    fireEvent.click(screen.getByTestId('scratchpad-push-chat-btn'));
    expect(sendTableChat).toHaveBeenCalledWith('table_01', 'Bước 2: $$x = \\pm 2$$');

    // Stamp step 2 formula onto active Homework Slide
    fireEvent.click(screen.getByTestId('scratchpad-pin-slide-btn'));
    expect(sendBoardDraw).toHaveBeenCalledWith(
      'table_01',
      expect.objectContaining({
        slideId: 'slide-1',
        action: 'ADD_STROKE',
        stroke: expect.objectContaining({
          tool: 'LATEX',
          text: 'x = \\pm 2',
          authorUserId: 'u-host',
        }),
      }),
    );

    // Stale self-echo arriving after a newer local edit must NOT clobber the newer local draft
    fireEvent.change(editor, { target: { value: 'Edit 1: $x$' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(editor, { target: { value: 'Edit 2: $x + 1$' } });
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'UPDATE_SCRATCHPAD',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: ['u-cohost'],
          isFreeCollab: false,
          scratchpadState: {
            content: 'Edit 1: $x$',
            updatedByUserId: 'u-host',
            updatedByNickname: 'HostAn',
            updatedAtEpoch: 1_700_000_004_000,
          },
          timestampEpoch: 1_700_000_004_000,
        },
        'u-host',
      );
    });
    expect(editor.value).toBe('Edit 2: $x + 1$');

    // Remote UPDATE_SCRATCHPAD event from peer synchronizes tablemates
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'UPDATE_SCRATCHPAD',
          tableId: 'table_01',
          actorUserId: 'u-cohost',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: ['u-cohost'],
          isFreeCollab: false,
          scratchpadState: {
            content: 'Kết luận: $S = \\{-2, 2\\}$',
            updatedByUserId: 'u-cohost',
            updatedByNickname: 'CoHostBinh',
            updatedAtEpoch: 1_700_000_005_000,
          },
          timestampEpoch: 1_700_000_005_000,
        },
        'u-host',
      );
    });
    expect(editor.value).toBe('Kết luận: $S = \\{-2, 2\\}$');
  });

  it('enforces Botanical Night Studio compliance: zero backdrop-blur on scrolling bodies and zero slate/sky classes', () => {
    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      scratchpadState: {
        content: 'Bước 1: $$a^2 + b^2 = c^2$$',
        updatedByUserId: 'u-host',
        updatedByNickname: 'HostAn',
        updatedAtEpoch: 1_700_000_000_000,
      },
    });

    const { container } = render(
      <div>
        <MathWorkspaceTabsPanel tableId="table_01" canControl={true} />
        <TableChatPanel tableId="table_01" />
        <RoomChatBox initialOpen={true} />
      </div>,
    );

    fireEvent.click(screen.getByTestId('math-workspace-tab-scratchpad'));

    // Zero backdrop-blur on scrolling containers
    container.querySelectorAll('.overflow-y-auto').forEach((el) => {
      expect(el.className).not.toContain('backdrop-blur');
    });

    // Zero raw slate-* or sky-* classes
    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    container.querySelectorAll('*').forEach((el) => {
      if (typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    });
  });
});
