import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MathWorkspaceTabsPanel } from '../components/table/MathWorkspaceTabsPanel';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import * as tableApi from '../services/tableApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useTableStore } from '../stores/useTableStore';

function mockCanvas2d() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
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
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
    cb(new Blob(['RIFF....WEBPVP8 '], { type: 'image/webp' }));
  });
}

describe('P10-T5 Function Grapher & Scientific Solver UI (#69)', () => {
  const sendScratchpadUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas2d();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'HostAn',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });
    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      homeworkSlides: [],
      scratchpadState: {
        content: 'Bước 0: Mở đầu',
        updatedByUserId: 'u-host',
        updatedByNickname: 'HostAn',
        updatedAtEpoch: 1_700_000_000_000,
      },
    });
    setActiveRoomStompSession({
      sendScratchpadUpdate,
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setActiveRoomStompSession(null);
    cleanup();
  });

  it('plots 3 functions, detects special points, and exports graph as 1280x720 webp slide switching to board tab', async () => {
    const uploadSpy = vi.spyOn(tableApi, 'uploadHomeworkImage').mockResolvedValue({
      imageId: 'img-graph-1',
      url: '/api/v1/homework/img-graph-1',
      fileName: 'function-graph.webp',
      uploadedByUserId: 'u-host',
      uploadedAtEpoch: Date.now(),
      strokes: [],
    });

    render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);

    fireEvent.click(screen.getByTestId('math-workspace-tab-grapher'));
    expect(screen.getByTestId('function-grapher-card')).toBeInTheDocument();

    // Add 3rd function h(x) = sin(x) and toggle f'(x)
    fireEvent.change(screen.getByTestId('grapher-input-h'), { target: { value: 'sin(x)' } });
    fireEvent.click(screen.getByTestId('grapher-derivative-toggle'));
    expect(screen.getByTestId('grapher-derivative-toggle')).toHaveAttribute('aria-pressed', 'true');

    // Special points strip shows roots/extrema/intersections for default f(x)=x^2-4, g(x)=x
    const specialText = screen.getByTestId('grapher-special-points').textContent ?? '';
    expect(specialText).toContain('Nghiệm f');
    expect(specialText).toContain('f∩g');

    // Zoom & reset controls update viewport readout
    fireEvent.click(screen.getByTestId('grapher-zoom-in-btn'));
    expect(screen.getByTestId('grapher-crosshair-readout').textContent).toContain('x∈[-6, 6]');
    fireEvent.click(screen.getByTestId('grapher-reset-view-btn'));
    expect(screen.getByTestId('grapher-crosshair-readout').textContent).toContain('x∈[-8, 8]');

    // Export to Homework Slide (.webp) and auto-switch to board tab
    fireEvent.click(screen.getByTestId('grapher-export-slide-btn'));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });
    const [calledTableId, uploadedFile] = uploadSpy.mock.calls[0];
    expect(calledTableId).toBe('table_01');
    expect(uploadedFile.type).toBe('image/webp');
    expect(uploadedFile.name).toMatch(/\.webp$/);

    await waitFor(() => {
      expect(screen.getByTestId('math-workspace-tab-board')).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('computes expression, derivative, Simpson integral, polynomial & linear systems and inserts into Scratchpad', () => {
    render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);
    fireEvent.click(screen.getByTestId('math-workspace-tab-grapher'));

    // Default expression: sin(pi/6) + ln(e^2) + sqrt(16) = 0.5 + 2 + 4 = 6.5
    expect(screen.getByTestId('solver-expr-result').textContent).toBe('= 6.5');

    // Default f(x)=x^2: f'(2) = 4, int_0^3 x^2 dx = 9
    expect(screen.getByTestId('solver-deriv-result').textContent).toContain("f'(2) ≈ 4");
    expect(screen.getByTestId('solver-int-result').textContent).toContain('∫[0, 3] ≈ 9');

    // Insert integral into Math Scratchpad
    fireEvent.click(screen.getByTestId('solver-int-insert-btn'));
    expect(sendScratchpadUpdate).toHaveBeenCalledWith(
      'table_01',
      expect.stringContaining('\\int_{0}^{3} (x^2)\\,dx \\approx 9'),
    );

    // Switch to Polynomial solver: default x^2 - 5x + 6 = 0 => x1 = 2, x2 = 3
    fireEvent.click(screen.getByTestId('solver-mode-polynomial'));
    expect(screen.getByTestId('solver-poly-result').textContent).toContain('x₁ = 2, x₂ = 3');

    // Switch to cubic x^3 - 7x + 6 = 0 => -3, 1, 2
    fireEvent.click(screen.getByTestId('solver-poly-deg-3'));
    fireEvent.change(screen.getByTestId('solver-poly-b'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('solver-poly-c'), { target: { value: '-7' } });
    fireEvent.change(screen.getByTestId('solver-poly-d'), { target: { value: '6' } });
    expect(screen.getByTestId('solver-poly-result').textContent).toContain('x₁ = -3, x₂ = 1, x₃ = 2');

    // Switch to Linear System solver: default 2x+y=5, x-y=1 => x = 2, y = 1
    fireEvent.click(screen.getByTestId('solver-mode-linear'));
    expect(screen.getByTestId('solver-linear-result').textContent).toContain('x = 2, y = 1');

    fireEvent.click(screen.getByTestId('solver-linear-use-btn'));
    expect(sendScratchpadUpdate).toHaveBeenLastCalledWith(
      'table_01',
      expect.stringContaining('x = 2,\\; y = 1'),
    );
  });

  it('strictly adheres to Botanical Night Studio tokens: Double-Bezel solver, .botanical-cta, zero slate/sky classes', () => {
    const { container } = render(<MathWorkspaceTabsPanel tableId="table_01" canControl={true} />);
    fireEvent.click(screen.getByTestId('math-workspace-tab-grapher'));

    const solverCard = screen.getByTestId('scientific-solver-card');
    expect(solverCard.className).toContain('botanical-bezel-outer');
    expect(solverCard.querySelector('.botanical-bezel-inner')).not.toBeNull();
    expect(screen.getByTestId('grapher-export-slide-btn').className).toContain('botanical-cta');

    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    container.querySelectorAll('*').forEach((el) => {
      if (typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    });
  });
});
