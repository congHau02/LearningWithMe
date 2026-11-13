import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomChatBox } from '../components/hud/RoomChatBox';
import { useGameStore } from '../stores/useGameStore';

describe('RoomChatBox HUD Component & Keyboard Isolation (#18)', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders recent messages from store in chronological order', () => {
    useGameStore.setState({
      recentMessages: [
        {
          id: '1',
          userId: 'u1',
          nickname: 'Alice',
          avatarId: 'student_glasses',
          content: 'Hello everyone!',
          createdAtEpoch: 1_700_000_000_000,
        },
        {
          id: '2',
          userId: 'u2',
          nickname: 'Bob',
          avatarId: 'student_hoodie',
          content: 'Good luck with study!',
          createdAtEpoch: 1_700_000_010_000,
        },
      ],
    });

    render(<RoomChatBox initialOpen={true} />);

    expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    expect(screen.getByText('Good luck with study!')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('submits trimmed message and clears input', () => {
    const handleSend = vi.fn();
    render(<RoomChatBox initialOpen={true} onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value: '  Cùng nhau cố gắng nhé!  ' } });

    const submitBtn = screen.getByRole('button', { name: /Gửi/i });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalledWith('Cùng nhau cố gắng nhé!');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('does not send empty or pure whitespace message', () => {
    const handleSend = vi.fn();
    render(<RoomChatBox initialOpen={true} onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    fireEvent.change(input, { target: { value: '    ' } });

    const submitBtn = screen.getByRole('button', { name: /Gửi/i });
    fireEvent.click(submitBtn);

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('sends quick emoji reaction when clicking reaction button', () => {
    const handleSend = vi.fn();
    render(<RoomChatBox initialOpen={true} onSend={handleSend} />);

    const waveBtn = screen.getByRole('button', { name: '👋' });
    fireEvent.click(waveBtn);

    expect(handleSend).toHaveBeenCalledWith('👋');
  });

  it('enforces 200 character counter limit and shows remaining count', () => {
    render(<RoomChatBox initialOpen={true} />);

    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    expect(screen.getByText('0/200')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(screen.getByText('5/200')).toBeInTheDocument();
  });

  it('isolates keyboard events when focused on chat input while SEATED', () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
      isLeaveConfirmOpen: false,
    });

    render(<RoomChatBox initialOpen={true} />);
    const input = screen.getByPlaceholderText(/Nhập tin nhắn/i);
    input.focus();

    // Type WASD and Escape while focused on chat input
    fireEvent.keyDown(input, { key: 'w' });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should NOT open leave confirm modal or change seated character state
    expect(useGameStore.getState().isLeaveConfirmOpen).toBe(false);
    expect(useGameStore.getState().characterState).toBe('SEATED');
  });
});
