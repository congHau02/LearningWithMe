import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkDeckPanel } from '../components/table/HomeworkDeckPanel';
import { MathWorkspaceTabsPanel } from '../components/table/MathWorkspaceTabsPanel';
import { TableChatPanel } from '../components/table/TableChatPanel';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import * as tableApi from '../services/tableApi';
import { useAuthStore } from '../stores/useAuthStore';
import { CURRICULUM_MODE_STORAGE_KEY, useCurriculumModeStore } from '../stores/useCurriculumModeStore';
import { useTableStore } from '../stores/useTableStore';

function mockCanvas2d() {
  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, mime) => {
    cb(new Blob(['RIFF\x10\x00\x00\x00WEBP'], { type: mime ?? 'image/webp' }));
  });
}

describe('P12-T2 Slice 2: THCS Curriculum Mode, Symbol Bars, Number Line Upload & Exact/Number Theory Solver UI', () => {
  const sendScratchpadUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockCanvas2d();
    useCurriculumModeStore.getState().resetCurriculumMode();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'CoGiaoAn',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });
    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      homeworkSlides: [
        {
          imageId: 'slide-1',
          fileName: 'number-line.webp',
          url: '/api/v1/ephemeral-files/number-line.webp',
          uploadedByUserId: 'u-host',
          uploadedAtEpoch: 1_700_000_000_000,
          strokes: [],
        },
      ],
      activeSlideId: 'slide-1',
      scratchpadState: {
        content: '',
        updatedByUserId: 'u-host',
        updatedByNickname: 'CoGiaoAn',
        updatedAtEpoch: 1_700_000_000_000,
      },
    });
    setActiveRoomStompSession({
      sendScratchpadUpdate,
      sendBoardDraw: vi.fn(),
      sendHomeworkSlideAction: vi.fn(),
      sendTableChat: vi.fn(),
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setActiveRoomStompSession(null);
    window.localStorage.clear();
    cleanup();
  });

  it('defaults to THCS Curriculum Mode, persists toggle across remounts, and preserves active Scratchpad & Grapher inputs', () => {
    const { unmount } = render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);

    expect(screen.getByTestId('curriculum-mode-thcs')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('curriculum-mode-thpt')).toHaveAttribute('aria-pressed', 'false');

    // Type into Math Scratchpad
    fireEvent.click(screen.getByTestId('math-workspace-tab-scratchpad'));
    const editor = screen.getByTestId('scratchpad-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'Bước 1: $\\triangle ABC \\sim \\triangle DEF$' } });

    // Switch to Grapher & Solver
    fireEvent.click(screen.getByTestId('math-workspace-tab-grapher'));
    expect(screen.queryByTestId('grapher-derivative-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('solver-deriv-result')).not.toBeInTheDocument();

    // Apply THCS preset y = ax + b and customize input
    fireEvent.click(screen.getByTestId('grapher-preset-linear'));
    expect((screen.getByTestId('grapher-input-f') as HTMLInputElement).value).toBe('2x + 1');
    fireEvent.click(screen.getByTestId('grapher-preset-parabola'));
    expect((screen.getByTestId('grapher-input-f') as HTMLInputElement).value).toBe('0.5*x^2');
    fireEvent.change(screen.getByTestId('grapher-input-g'), { target: { value: 'x + 2' } });

    // Toggle to THPT / Đại học -> reveals calculus tools & keeps inputs intact
    fireEvent.click(screen.getByTestId('curriculum-mode-thpt'));
    expect(window.localStorage.getItem(CURRICULUM_MODE_STORAGE_KEY)).toBe('THPT');
    expect(screen.getByTestId('grapher-derivative-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('solver-deriv-result')).toBeInTheDocument();
    expect((screen.getByTestId('grapher-input-f') as HTMLInputElement).value).toBe('0.5*x^2');
    expect((screen.getByTestId('grapher-input-g') as HTMLInputElement).value).toBe('x + 2');
    expect((screen.getByTestId('scratchpad-editor') as HTMLTextAreaElement).value).toBe(
      'Bước 1: $\\triangle ABC \\sim \\triangle DEF$',
    );

    // Remount & rehydrate simulates reload -> THPT persists locally
    unmount();
    useCurriculumModeStore.getState().hydrateCurriculumMode();
    render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);
    expect(screen.getByTestId('curriculum-mode-thpt')).toHaveAttribute('aria-pressed', 'true');
  });

  it('provides THCS LaTeX symbol bars across Scratchpad, Homework Slide popover, and Table Chat', () => {
    render(
      <div>
        <MathWorkspaceTabsPanel tableId="table_01" canControl={true} />
        <TableChatPanel tableId="table_01" />
      </div>,
    );

    // Scratchpad THCS symbols
    fireEvent.click(screen.getByTestId('math-workspace-tab-scratchpad'));
    fireEvent.click(screen.getByTestId('scratchpad-math-sym-triangle'));
    fireEvent.click(screen.getByTestId('scratchpad-math-sym-perp'));
    fireEvent.click(screen.getByTestId('scratchpad-math-sym-vdots'));
    const scratchVal = (screen.getByTestId('scratchpad-editor') as HTMLTextAreaElement).value;
    expect(scratchVal).toContain('\\triangle');
    expect(scratchVal).toContain('\\perp');
    expect(scratchVal).toContain('\\vdots');

    // Table Chat THCS symbols
    fireEvent.click(screen.getByTestId('table-chat-math-sym-parallel'));
    expect((screen.getByTestId('table-chat-input') as HTMLInputElement).value).toContain('\\parallel');

    // Homework Slide LATEX popover THCS symbols
    fireEvent.click(screen.getByTestId('math-workspace-tab-board'));
    fireEvent.click(screen.getByTestId('board-tool-LATEX'));
    const canvas = screen.getByTestId('homework-annotation-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByTestId('latex-symbol-angle'));
    expect((screen.getByTestId('homework-latex-input') as HTMLInputElement).value).toContain('\\widehat{ABC}');
  });

  it('uploads a 1280x720 NUMBER_LINE .webp Homework Slide in 1 click', async () => {
    useTableStore.setState({ homeworkSlides: [], activeSlideId: null });
    const uploadSpy = vi.spyOn(tableApi, 'uploadHomeworkImage').mockResolvedValue({
      imageId: 'img-nl',
      fileName: 'math-number-line.webp',
      url: '/api/v1/ephemeral-files/math-number-line.webp',
      uploadedByUserId: 'u-host',
      uploadedAtEpoch: 2000,
      strokes: [],
    });

    render(<HomeworkDeckPanel tableId="table_01" canControl={true} />);
    fireEvent.click(screen.getByTestId('math-template-NUMBER_LINE'));

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1));
    const [, uploadedFile] = uploadSpy.mock.calls[0];
    expect(uploadedFile.type).toBe('image/webp');
    expect(uploadedFile.name).toBe('math-number-line.webp');
  });

  it('computes exact fraction/radical outputs and THCS Number Theory (prime factorization, UCLN, BCNN) with 1-click Scratchpad insertion', () => {
    render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);
    fireEvent.click(screen.getByTestId('math-workspace-tab-grapher'));

    // Exact expression evaluation: 1/3 + 1/6 = 1/2, sqrt(18)+sqrt(8) = 5√2, sqrt(12) + 1/2 = (1 + 4√3)/2
    fireEvent.change(screen.getByTestId('solver-expr-input'), { target: { value: '1/3 + 1/6' } });
    expect(screen.getByTestId('solver-expr-result').textContent).toBe('= 1/2 (0.5)');
    fireEvent.change(screen.getByTestId('solver-expr-input'), { target: { value: 'sqrt(12) + 1/2' } });
    expect(screen.getByTestId('solver-expr-result').textContent).toContain('(1 + 4√3)/2');

    // THCS Number Theory tab: Prime factorization & UCLN/BCNN
    fireEvent.click(screen.getByTestId('solver-mode-number-theory'));
    fireEvent.change(screen.getByTestId('solver-prime-input'), { target: { value: '360' } });
    expect(screen.getByTestId('solver-prime-result').textContent).toBe('360 = 2³ · 3² · 5');

    fireEvent.click(screen.getByTestId('solver-prime-insert-btn'));
    expect(sendScratchpadUpdate).toHaveBeenCalledWith(
      'table_01',
      expect.stringContaining('360 = 2^{3} \\cdot 3^{2} \\cdot 5'),
    );

    fireEvent.change(screen.getByTestId('solver-gcd-input'), { target: { value: '24, 36' } });
    expect(screen.getByTestId('solver-gcd-result').textContent).toBe('ƯCLN(24, 36) = 12; BCNN(24, 36) = 72');

    fireEvent.click(screen.getByTestId('solver-gcd-insert-btn'));
    expect(sendScratchpadUpdate).toHaveBeenLastCalledWith(
      'table_01',
      expect.stringContaining('\\text{ƯCLN}(24, 36) = 12,\\; \\text{BCNN}(24, 36) = 72'),
    );
  });

  it('enforces Botanical Night Studio tokens and zero legacy palette classes in THCS UI', () => {
    const { container } = render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);
    fireEvent.click(screen.getByTestId('math-workspace-tab-grapher'));

    const thcsBtn = screen.getByTestId('curriculum-mode-thcs');
    expect(thcsBtn.className).toContain('bg-primary');
    expect(thcsBtn.className).toContain('text-primary-foreground');
    expect(thcsBtn.className).toContain('min-h-[44px]');

    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    container.querySelectorAll('*').forEach((el) => {
      if (typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    });
  });
});
