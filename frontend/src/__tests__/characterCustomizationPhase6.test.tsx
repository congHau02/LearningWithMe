import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { applyRoomEvent } from '../services/roomEventReducer';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

function encodeFakeJwt(payload: Record<string, unknown>): string {
  const encodePart = (obj: Record<string, unknown>) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${encodePart({ alg: 'HS256', typ: 'JWT' })}.${encodePart(payload)}.sig`;
}

const SAMPLE_CATALOG = {
  totalStudyMinutes: 140,
  equipped: {
    skinId: 'default_student',
    hatId: 'hat_none',
    deskPetId: 'pet_sprout_pot',
  },
  items: [
    {
      id: 'default_student',
      itemName: 'Học Sinh Mặc Định',
      itemType: 'SKIN',
      requiredStudyMinutes: 0,
      unlocked: true,
      remainingMinutes: 0,
      equipped: true,
    },
    {
      id: 'skin_hoodie_blue',
      itemName: 'Áo Hoodie Xanh Thư Viện',
      itemType: 'SKIN',
      requiredStudyMinutes: 60,
      unlocked: true,
      remainingMinutes: 0,
      equipped: false,
    },
    {
      id: 'hat_none',
      itemName: 'Không Đội Mũ',
      itemType: 'HAT',
      requiredStudyMinutes: 0,
      unlocked: true,
      remainingMinutes: 0,
      equipped: true,
    },
    {
      id: 'hat_headphones',
      itemName: 'Tai Nghe Lofi Chống Ồn',
      itemType: 'HAT',
      requiredStudyMinutes: 120,
      unlocked: true,
      remainingMinutes: 0,
      equipped: false,
    },
    {
      id: 'hat_graduation_cap',
      itemName: 'Mũ Cử Nhân Chăm Chỉ',
      itemType: 'HAT',
      requiredStudyMinutes: 600,
      unlocked: false,
      remainingMinutes: 460,
      equipped: false,
    },
    {
      id: 'pet_sprout_pot',
      itemName: 'Chậu Cây Mầm Nhỏ',
      itemType: 'DESK_PET',
      requiredStudyMinutes: 0,
      unlocked: true,
      remainingMinutes: 0,
      equipped: true,
    },
    {
      id: 'pet_sleepy_cat',
      itemName: 'Mèo Vàng Ngủ Gật',
      itemType: 'DESK_PET',
      requiredStudyMinutes: 180,
      unlocked: false,
      remainingMinutes: 40,
      equipped: false,
    },
  ],
};

describe('P6-T3 Character Customizer Modal, Avatar Layering & Live Sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens Character Customizer from TopBar while SEATED, updates SKIN/HAT/DESK_PET, and preserves seat', async () => {
    const userId = 'reg-custom-1';
    const token = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      nickname: 'Minh Thư',
      avatarId: 'default_student',
      studyGoal: 'Ôn IELTS',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId,
      nickname: 'Minh Thư',
      avatarSpriteId: 'default_student',
      hatId: 'hat_none',
      deskPetId: 'pet_sprout_pot',
      studyGoal: 'Ôn IELTS',
      authProvider: 'LOCAL',
      totalStudyMinutes: 140,
      token,
    });
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });

    let patchBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            authProvider: 'LOCAL',
            nickname: 'Minh Thư',
            avatarId: 'default_student',
            hatId: 'hat_none',
            deskPetId: 'pet_sprout_pot',
            studyGoal: 'Ôn IELTS',
            totalStudyMinutes: 140,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            totalStudyMinutes: 140,
            totalSessions: 4,
            recentSessions: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/v1/items') && method === 'GET') {
        return new Response(JSON.stringify(SAMPLE_CATALOG), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/users/me/customization') && method === 'PATCH') {
        patchBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            skinId: patchBody.skinId,
            hatId: patchBody.hatId,
            deskPetId: patchBody.deskPetId,
            totalStudyMinutes: 140,
            roomId: 'main-library',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<App />);

    const openBtn = await screen.findByTestId('customizer-open-btn');
    fireEvent.click(openBtn);

    const modal = await screen.findByTestId('character-customizer-modal');
    expect(within(modal).getByText('Áo Hoodie Xanh Thư Viện')).toBeTruthy();

    fireEvent.click(within(modal).getByTestId('customizer-item-skin_hoodie_blue'));
    fireEvent.click(within(modal).getByTestId('customizer-tab-HAT'));
    expect(within(modal).getByText(/Cần thêm 460 phút/i)).toBeTruthy();
    fireEvent.click(within(modal).getByTestId('customizer-item-hat_headphones'));

    fireEvent.click(within(modal).getByTestId('customizer-tab-DESK_PET'));
    expect(within(modal).getByText(/Cần thêm 40 phút/i)).toBeTruthy();

    fireEvent.click(within(modal).getByTestId('customizer-save-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('character-customizer-modal')).toBeNull();
    });

    expect(patchBody).toEqual({
      skinId: 'skin_hoodie_blue',
      hatId: 'hat_headphones',
      deskPetId: 'pet_sprout_pot',
    });
    expect(useAuthStore.getState().avatarSpriteId).toBe('skin_hoodie_blue');
    expect(useAuthStore.getState().hatId).toBe('hat_headphones');
    expect(useAuthStore.getState().deskPetId).toBe('pet_sprout_pot');
    expect(useGameStore.getState().characterState).toBe('SEATED');

    const portrait = screen.getByTestId('topbar-avatar-portrait');
    expect(portrait.getAttribute('data-hat-id')).toBe('hat_headphones');
    expect(portrait.getAttribute('data-desk-pet-id')).toBe('pet_sprout_pot');
  });

  it('displays server 403 ProblemDetail error without mutating equipped store when save fails', async () => {
    const userId = 'guest-err-1';
    useAuthStore.getState().setSession({
      userId,
      nickname: 'Khách',
      avatarSpriteId: 'default_student',
      hatId: 'hat_none',
      deskPetId: 'pet_sprout_pot',
      studyGoal: 'Học bài',
      authProvider: 'GUEST',
      totalStudyMinutes: 140,
      token: 'jwt-err',
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/items') && method === 'GET') {
        return new Response(JSON.stringify(SAMPLE_CATALOG), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/users/me/customization') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            status: 403,
            title: 'Character Item Locked',
            detail: "Item 'skin_hoodie_blue' requires 60 study minutes to unlock (current: 10)",
          }),
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<App />);
    fireEvent.click(await screen.findByTestId('customizer-open-btn'));
    const modal = await screen.findByTestId('character-customizer-modal');
    fireEvent.click(within(modal).getByTestId('customizer-item-skin_hoodie_blue'));
    fireEvent.click(within(modal).getByTestId('customizer-save-btn'));

    expect(
      await within(modal).findByText(/requires 60 study minutes to unlock/i),
    ).toBeTruthy();
    expect(useAuthStore.getState().avatarSpriteId).toBe('default_student');
  });

  it('applies PLAYER_UPDATED room event customization onto remotePlayers without dropping SEATED state', () => {
    const result = applyRoomEvent({
      currentPlayers: {
        'peer-1': {
          userId: 'peer-1',
          nickname: 'Tuấn',
          avatarId: 'default_student',
          hatId: 'hat_none',
          deskPetId: 'pet_sprout_pot',
          role: 'REGISTERED',
          state: 'SEATED',
          x: 6,
          y: 5,
          facingDir: 'UP',
          tableId: 'table_01',
          seatId: 'T1_S2',
          connected: true,
        },
      },
      currentSeq: 4,
      selfUserId: 'self-1',
      event: {
        seq: 5,
        type: 'PLAYER_UPDATED',
        roomId: 'main-library',
        userId: 'peer-1',
        previousUserId: null,
        player: {
          userId: 'peer-1',
          nickname: 'Tuấn',
          avatarId: 'skin_scholar_blazer',
          hatId: 'hat_graduation_cap',
          deskPetId: 'pet_wise_owl',
          role: 'REGISTERED',
          state: 'SEATED',
          x: 6,
          y: 5,
          facingDir: 'UP',
          tableId: 'table_01',
          seatId: 'T1_S2',
          connected: true,
        },
        timestampEpoch: Date.now(),
      },
    });

    const updated = result.nextPlayers['peer-1'];
    expect(updated?.avatarId).toBe('skin_scholar_blazer');
    expect(updated?.hatId).toBe('hat_graduation_cap');
    expect(updated?.deskPetId).toBe('pet_wise_owl');
    expect(updated?.state).toBe('SEATED');
    expect(updated?.tableId).toBe('table_01');

    const renderer = new RemotePlayersRenderer({ tileSize: 32 });
    renderer.syncPlayers(result.nextPlayers);
    const snap = renderer.getSnapshot('peer-1');
    expect(snap?.skinId).toBe('skin_scholar_blazer');
    expect(snap?.hatId).toBe('hat_graduation_cap');
    expect(snap?.deskPetId).toBe('pet_wise_owl');
    expect(snap?.avatarKey).toBe('default_student');
    renderer.destroy();
  });
});
