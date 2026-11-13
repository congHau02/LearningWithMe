# Design Document: Room Chat, Redis 30-Message Buffer, Rate Limit & 4-Second Overhead Chat Bubble

## Intent & The Why
In an online co-studying environment, learners need immediate feedback and lightweight ways to communicate, greet each other, and express reactions without leaving their seats or opening heavy video calls. This ticket (#18 / P3-T5) provides a room-wide chat mechanism within the same Room Shard, backed by Redis for quick context catch-up (last 30 messages in Room Snapshot), protected against spam via a sliding-window rate limit (5 msgs / 5s), and rendered visually on the 2D map as a 4-second overhead chat bubble directly above character sprites.

## Goals, Non-Goals, and Anti-Goals
- **Goals**:
  - Enable learners in the same Room Shard to send trimmed text messages ($\le 200$ chars) and quick emoji reactions via STOMP `/app/room/{roomId}/chat`.
  - Validate and reject invalid messages (empty, blank, > 200 characters) or spam exceeding 5 messages in 5 seconds per user with structured errors dispatched to `/user/queue/errors`.
  - Maintain a rolling buffer of up to 30 recent room chat messages in Redis (`room:{roomId}:chat`) with room TTL, served in Room Snapshot (`GET /api/v1/rooms/{roomId}/state`).
  - Broadcast room chat events (`ROOM_CHAT`) to `/topic/room/{roomId}/events`.
  - Display safe plain-text Chat Bubbles above character heads on the 2D map for exactly 4 seconds, resetting the 4s timer and overriding content when new messages arrive from the same learner.
  - Provide a responsive, non-intrusive React HUD Room Chat panel with quick emojis and input field; ensure typing while `SEATED` never triggers unwanted movement or table-exit confirmation.
- **Non-Goals**:
  - Private table chat (P3-T6 / ticket #19).
  - Rich text formatting or HTML rendering (plain text only for XSS protection).
  - Audio/voice chat (Phase 4 / WebRTC).
- **Anti-Goals**:
  - Storing room chat messages in persistent MySQL storage (room chat is ephemeral hot state).
  - Disrupting map movement or unseating players when typing in chat input.

## Constraints
- File size limits: React components $\le 200$ lines, Phaser entities/scenes $\le 250$ lines, Spring controllers $\le 150$ lines, Spring services $\le 250$ lines.
- No HTML injection or XSS execution; bubble and chat box must render strictly sanitized/plain text.
- Maximum 5 messages per 5 seconds per user across room chat.
- Rolling Redis list trimmed to 30 items (`LTRIM` / `opsForList().trim(key, -30, -1)`).

## Approaches Considered
1. **Rate Limiting Mechanism**:
   - *Approach A (Redis Sliding Window with ZSET / Script)*: Records message timestamps per user in Redis ZSET with atomic eviction and count check within a 5000ms window.
   - *Approach B (Redis Counter with Fixed TTL)*: Simple atomic increment with fixed 5s expiry. Allows window boundary bursting (e.g. 5 at 4.9s and 5 at 5.1s).
   - *Decision*: Approach A. Guarantees true sliding-window rate limit protection without boundary leakage.

2. **Overhead Chat Bubble Rendering**:
   - *Approach A (Phaser 3 Canvas Sprite Entity)*: `ChatBubble` class managed in Phaser 3 attached to `PlayerSprite` (local) and `RemotePlayersRenderer` (remote). Follows AGENTS.md rule that 2D entities and overhead bubbles belong to Phaser 60 FPS loop.
   - *Approach B (React DOM Overlay over Canvas)*: Floating HTML divs projected from canvas coordinates. High risk of coordinate desynchronization and jitter during movement lerping.
   - *Decision*: Approach A. Clean separation of concerns and high-performance rendering.

## Architecture & Interfaces
- **STOMP Endpoint**:
  - Destination: `/app/room/{roomId}/chat`
  - Payload: `RoomChatSendRequest(String content)`
- **Error Channel**:
  - Destination: `/user/queue/errors`
  - Codes: `INVALID_CHAT_MESSAGE` (status 400), `RATE_LIMIT_EXCEEDED` (status 429)
- **Room Event**:
  - Destination: `/topic/room/{roomId}/events`
  - Type: `ROOM_CHAT`
  - Payload contains `RoomChatMessage(id, userId, nickname, avatarId, content, createdAtEpoch)`
- **Redis Keys**:
  - Buffer: `room:{roomId}:chat` (List of JSON, max 30)
  - Rate limit: `ratelimit:chat:{userId}` (ZSET of timestamps)
- **Frontend Entities & Stores**:
  - `ChatBubble.ts` in `src/game/entities/`: handles graphics, plain text, 4000ms expiry and reset.
  - `RoomChatBox.tsx` in `src/components/hud/`: collapsible HUD panel for room messages and quick reactions.
