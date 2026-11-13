import { describe, expect, it } from 'vitest';
import { ChatBubble } from '../game/entities/ChatBubble';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import type { RoomChatMessage, RoomEvent, RoomPlayerDto } from '../services/roomApi';
import { applyRoomEvent } from '../services/roomEventReducer';

describe('Room Chat Event Reducer & 4-Second Overhead Chat Bubble (#18)', () => {
  describe('applyRoomEvent ROOM_CHAT reduction', () => {
    it('appends incoming ROOM_CHAT to recentMessages and caps at 30 items', () => {
      let recentMessages: RoomChatMessage[] = [];
      let seq = 10;

      for (let i = 1; i <= 35; i++) {
        seq += 1;
        const msg: RoomChatMessage = {
          id: `msg-${i}`,
          userId: `user-${i}`,
          nickname: `Learner ${i}`,
          avatarId: 'student_glasses',
          content: `Message ${i}`,
          createdAtEpoch: 1_700_000_000_000 + i * 1000,
        };

        const event: RoomEvent = {
          seq,
          type: 'ROOM_CHAT',
          roomId: 'main-library',
          userId: msg.userId,
          previousUserId: null,
          player: null,
          timestampEpoch: msg.createdAtEpoch,
          message: msg,
        };

        const reduced = applyRoomEvent({
          currentPlayers: {},
          currentSeats: {},
          currentTables: [],
          currentRecentMessages: recentMessages,
          currentSeq: seq - 1,
          selfUserId: 'self-1',
          event,
        });

        recentMessages = reduced.nextRecentMessages;
      }

      expect(recentMessages).toHaveLength(30);
      expect(recentMessages[0].content).toBe('Message 6');
      expect(recentMessages[29].content).toBe('Message 35');
    });

    it('ignores duplicate or old event sequence for ROOM_CHAT', () => {
      const msg: RoomChatMessage = {
        id: 'msg-1',
        userId: 'user-1',
        nickname: 'Alice',
        avatarId: 'student_glasses',
        content: 'Old message',
        createdAtEpoch: 1_700_000_000_000,
      };

      const event: RoomEvent = {
        seq: 5,
        type: 'ROOM_CHAT',
        roomId: 'main-library',
        userId: 'user-1',
        previousUserId: null,
        player: null,
        timestampEpoch: 1_700_000_000_000,
        message: msg,
      };

      const reduced = applyRoomEvent({
        currentPlayers: {},
        currentRecentMessages: [],
        currentSeq: 10,
        selfUserId: 'self-1',
        event,
      });

      expect(reduced.nextRecentMessages).toHaveLength(0);
      expect(reduced.nextSeq).toBe(10);
    });
  });

  describe('ChatBubble 4-second lifecycle & reset', () => {
    it('activates for 4000ms and expires automatically', () => {
      const bubble = new ChatBubble();
      const t0 = 10_000;

      bubble.show('Hello world!', t0);
      expect(bubble.isActive()).toBe(true);
      expect(bubble.getText()).toBe('Hello world!');
      expect(bubble.getExpiresAt()).toBe(14_000);

      // At t0 + 2000ms: still active
      bubble.update(12_000, 100, 100);
      expect(bubble.isActive()).toBe(true);

      // At t0 + 4000ms: expired
      bubble.update(14_000, 100, 100);
      expect(bubble.isActive()).toBe(false);
    });

    it('overrides text and resets 4000ms timer when receiving a consecutive message', () => {
      const bubble = new ChatBubble();
      const t0 = 10_000;

      bubble.show('First thought', t0);
      expect(bubble.getExpiresAt()).toBe(14_000);

      // Consecutive message at t0 + 2500ms
      bubble.show('Second thought!', 12_500);
      expect(bubble.getText()).toBe('Second thought!');
      expect(bubble.getExpiresAt()).toBe(16_500);
      expect(bubble.isActive()).toBe(true);

      // At 15_000ms (past original expiry): still active due to reset
      bubble.update(15_000, 100, 100);
      expect(bubble.isActive()).toBe(true);

      // At 16_500ms: expires
      bubble.update(16_500, 100, 100);
      expect(bubble.isActive()).toBe(false);
    });
  });

  describe('RemotePlayersRenderer overhead chat bubble integration', () => {
    it('attaches chat bubble to remote player, updates position, and expires after 4s', () => {
      const renderer = new RemotePlayersRenderer();
      const player: RoomPlayerDto = {
        userId: 'remote-1',
        nickname: 'Bob',
        avatarId: 'student_hoodie',
        role: 'GUEST',
        state: 'FREE_ROAM',
        x: 10,
        y: 10,
        facingDir: 'DOWN',
        tableId: null,
        seatId: null,
        connected: true,
      };

      renderer.syncPlayers({ 'remote-1': player });
      renderer.showChatBubble('remote-1', 'Hey there!', 10_000);

      expect(renderer.getChatBubbleText('remote-1')).toBe('Hey there!');

      // Update position with lerp
      renderer.update(0.28, 12_000);
      expect(renderer.getChatBubbleText('remote-1')).toBe('Hey there!');

      // Expire at 14_000ms
      renderer.update(0.28, 14_000);
      expect(renderer.getChatBubbleText('remote-1')).toBeNull();
    });
  });
});
