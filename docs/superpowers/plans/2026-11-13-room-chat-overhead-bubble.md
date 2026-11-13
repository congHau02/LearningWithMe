# Room Chat, Redis 30-Message Buffer, Rate Limit & 4-Second Overhead Chat Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time room chat via STOMP `/app/room/{roomId}/chat`, Redis rolling 30-message buffer in Room Snapshot, 5 msgs / 5s sliding-window rate limiting, 4-second overhead chat bubbles in Phaser 3, and a non-intrusive React HUD chat box.

**Architecture:** 
- Backend: Spring Boot STOMP controller routes messages to `RoomChatService`, which verifies input and applies a Redis sliding-window rate limiter (5 msgs / 5s). Valid messages are appended to a Redis list trimmed to 30 items (`room:{roomId}:chat`) and broadcast as `ROOM_CHAT` events to `/topic/room/{roomId}/events`. Violations trigger structured errors to `/user/queue/errors`.
- Frontend: Phaser 3 manages `ChatBubble` entities over sprite heads (safe text, 4s self-clearing timer with override reset). React HUD provides a collapsible `RoomChatBox` with message history and quick reactions, where input focus is shielded from game movement and dialog hotkeys.

**Tech Stack:** Java 21, Spring Boot 3.x, Spring Messaging (STOMP), Spring Data Redis, React 18, Zustand, Phaser 3, TailwindCSS, Testcontainers, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-13-room-chat-overhead-bubble-design.md](file:///e:/Learn%20JavaSpringBoot%20with%20ReactJs/LearningWithMe/docs/superpowers/specs/2026-11-13-room-chat-overhead-bubble-design.md)

## Global Constraints
- React Component (`.tsx`): max 200 lines.
- Phaser Scene / Entity (`src/game/**/*.ts`): max 250 lines.
- Spring Controller: max 150 lines.
- Spring Service: max 250 lines.
- DTO / Record: max 120 lines.
- Plain text rendering only for Chat Bubbles and message streams to prevent XSS.
- Rate limit: max 5 messages in 5 seconds per user.
- Redis buffer: capped at 30 messages per Room Shard.

## Review Focus
1. Blank/whitespace or > 200 character chat input: rejected with `INVALID_CHAT_MESSAGE` and HTTP 400 semantics.
2. Rapid spam (6th message within 5s): rejected with `RATE_LIMIT_EXCEEDED` on `/user/queue/errors`.
3. Consecutive messages from same user in Phaser: overhead bubble replaces text and resets 4000ms timer without orphan timers or coordinate drift.
4. Hotkey safety while seated: typing WASD, space, or Escape in chat input does not trigger movement or leave-table confirmation.
5. Rolling buffer bounds: sending > 30 messages retains exactly the 30 most recent messages in chronological order.

---

### Task 1: Backend Domain Models, Exceptions & Redis Buffer Storage

**Files:**
- Create: `backend/src/main/java/com/studytogether/modules/room/model/RoomChatSendRequest.java`
- Modify: `backend/src/main/java/com/studytogether/modules/room/RoomExceptions.java`
- Modify: `backend/src/main/java/com/studytogether/modules/room/model/RoomEvent.java`
- Modify: `backend/src/main/java/com/studytogether/modules/room/RoomStateStore.java`
- Modify: `backend/src/main/java/com/studytogether/modules/room/RedisRoomStateStore.java`
- Test: `backend/src/test/java/com/studytogether/modules/room/RedisRoomStateStoreChatTest.java`

**Interfaces:**
- Produces: `RoomChatSendRequest(String content)`
- Produces: `RoomExceptions.invalidChatMessage(String reason)`, `RoomExceptions.chatRateLimitExceeded(String userId)`
- Produces: `RoomStateStore.appendChatMessage(String roomId, RoomChatMessage message, int maxBuffer)`
- Consumes: `RoomChatMessage`, `RedisRoomStateStore.chatKey(roomId)`

- [ ] **Step 1: Write failing unit test for RedisRoomStateStore chat buffer operations**

```java
// backend/src/test/java/com/studytogether/modules/room/RedisRoomStateStoreChatTest.java
@Test
void appendChatMessageAppendsAndTrimsToMaxBuffer() {
    // appends 35 messages to roomId "main-library", asserts size is 30 and first is message 6
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn test -Dtest=RedisRoomStateStoreChatTest -pl backend`
Expected: Compilation failure or missing `appendChatMessage` method.

- [ ] **Step 3: Implement DTOs, Exceptions, and Redis buffer trimming in `RedisRoomStateStore`**

Implement `RoomChatSendRequest.java`, add `appendChatMessage` to `RoomStateStore` and `RedisRoomStateStore` using `opsForList().rightPush` and `opsForList().trim(key, -maxBuffer, -1)`, and add `INVALID_CHAT_MESSAGE_TYPE` and `CHAT_RATE_LIMIT_EXCEEDED_TYPE` in `RoomExceptions.java`.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -Dtest=RedisRoomStateStoreChatTest -pl backend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/studytogether/modules/room/ backend/src/test/java/com/studytogether/modules/room/
git commit -m "feat(room): add chat DTO, room exceptions and redis chat buffer storage"
```

---

### Task 2: Backend Sliding-Window Chat Rate Limiter & RoomChatService

**Files:**
- Create: `backend/src/main/java/com/studytogether/modules/room/ChatRateLimiter.java`
- Create: `backend/src/main/java/com/studytogether/modules/room/RoomChatService.java`
- Test: `backend/src/test/java/com/studytogether/modules/room/ChatRateLimiterTest.java`
- Test: `backend/src/test/java/com/studytogether/modules/room/RoomChatServiceTest.java`

**Interfaces:**
- Produces: `ChatRateLimiter.isAllowed(String userId)` -> `boolean` (max 5 per 5000ms)
- Produces: `RoomChatService.sendChatMessage(AuthPrincipal principal, String roomId, RoomChatSendRequest request)` -> `RoomChatMessage`
- Consumes: `RoomStateStore`, `SimpMessagingTemplate`, `RoomExceptions`

- [ ] **Step 1: Write failing tests for Rate Limiter and RoomChatService**

Test sliding window in `ChatRateLimiterTest`: 5 calls pass, 6th fails; after 5000ms passes again.
Test validation in `RoomChatServiceTest`: empty or > 200 chars throws `BusinessException(INVALID_CHAT_MESSAGE)`.

- [ ] **Step 2: Run tests to verify failure**

Run: `mvn test -Dtest=ChatRateLimiterTest,RoomChatServiceTest -pl backend`
Expected: Compilation failure (classes not found).

- [ ] **Step 3: Implement `ChatRateLimiter` and `RoomChatService`**

Implement `ChatRateLimiter` using Redis ZSET (ZREMRANGEBYSCORE older than now-5000ms, ZCARD < 5, ZADD now, PEXPIRE 6000ms).
Implement `RoomChatService` to validate content, check rate limit, persist to Redis buffer, increment room sequence, and broadcast `RoomEvent(seq, "ROOM_CHAT", roomId, userId, ..., chatMessage)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn test -Dtest=ChatRateLimiterTest,RoomChatServiceTest -pl backend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/studytogether/modules/room/ChatRateLimiter.java backend/src/main/java/com/studytogether/modules/room/RoomChatService.java backend/src/test/java/com/studytogether/modules/room/
git commit -m "feat(room): implement redis sliding-window rate limiter and RoomChatService"
```

---

### Task 3: STOMP Chat Controller, Error Routing & Testcontainers Integration Test

**Files:**
- Create: `backend/src/main/java/com/studytogether/modules/room/RoomChatStompController.java`
- Modify: `backend/src/main/java/com/studytogether/modules/room/RoomStompController.java:80-120` (add error code mappings)
- Test: `backend/src/test/java/com/studytogether/RoomChatIntegrationTest.java`

**Interfaces:**
- Produces: `@MessageMapping("/room/{roomId}/chat")` endpoint in `RoomChatStompController`
- Dispatches: Structured error to `/user/queue/errors` on invalid message or rate limit exceeded

- [ ] **Step 1: Write failing integration test for Room Chat end-to-end**

Write `RoomChatIntegrationTest.java` testing:
1. Valid message published to `/topic/room/{roomId}/events` with `ROOM_CHAT`.
2. Message stored in Redis `room:{roomId}:chat` and returned in `GET /api/v1/rooms/{roomId}/state`.
3. Empty or > 200 chars receives `INVALID_CHAT_MESSAGE` on `/user/queue/errors`.
4. 6 messages in under 5 seconds triggers `RATE_LIMIT_EXCEEDED` on `/user/queue/errors`.

- [ ] **Step 2: Run integration test to verify failure**

Run: `mvn test -Dtest=RoomChatIntegrationTest -pl backend`
Expected: FAIL (endpoint or error mappings not found).

- [ ] **Step 3: Implement `RoomChatStompController` and error code mappings**

Create `RoomChatStompController` (under 100 lines) delegating to `RoomChatService`. Map error codes `INVALID_CHAT_MESSAGE` and `RATE_LIMIT_EXCEEDED` in error handler.

- [ ] **Step 4: Run integration test to verify it passes**

Run: `mvn test -Dtest=RoomChatIntegrationTest -pl backend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/studytogether/modules/room/RoomChatStompController.java backend/src/main/java/com/studytogether/modules/room/RoomStompController.java backend/src/test/java/com/studytogether/RoomChatIntegrationTest.java
git commit -m "feat(room): expose STOMP /room/{roomId}/chat endpoint and verify via testcontainers"
```

---

### Task 4: Frontend Room API, Event Reducer & Phaser 3 4-Second Chat Bubble

**Files:**
- Modify: `frontend/src/services/roomApi.ts`
- Modify: `frontend/src/services/roomEventReducer.ts`
- Create: `frontend/src/game/entities/ChatBubble.ts`
- Modify: `frontend/src/game/entities/RemotePlayersRenderer.ts`
- Modify: `frontend/src/game/scenes/ClassroomScene.ts`
- Test: `frontend/src/__tests__/roomChatBubble.test.ts`

**Interfaces:**
- Produces: `ChatBubble.show(text: string, now: number)`
- Produces: `ChatBubble.update(now: number, anchorX: number, anchorY: number)`
- Consumes: `RoomEvent` with `type === 'ROOM_CHAT'`, `message: RoomChatMessage`

- [ ] **Step 1: Write failing Vitest tests for ChatBubble lifecycle & RoomEvent reduction**

Test:
- `applyRoomEvent` appends `ROOM_CHAT` to `recentMessages` (max 30).
- `ChatBubble` displays text, expires after 4000ms, and resets 4000ms when a new message is shown at 2000ms.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- roomChatBubble.test.ts` (in `frontend/`)
Expected: FAIL

- [ ] **Step 3: Implement ChatBubble and wire to ClassroomScene & RemotePlayersRenderer**

1. Update `roomApi.ts` and `roomEventReducer.ts`.
2. Implement `ChatBubble.ts` (Phaser container/text/graphics, safe plain text, auto-wrap max width 160px, 4-second timeout, `destroy()`).
3. Connect incoming `ROOM_CHAT` to trigger bubble on self `actorSprite` in `ClassroomScene` and remote sprite in `RemotePlayersRenderer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- roomChatBubble.test.ts` (in `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/roomApi.ts frontend/src/services/roomEventReducer.ts frontend/src/game/entities/ChatBubble.ts frontend/src/game/entities/RemotePlayersRenderer.ts frontend/src/game/scenes/ClassroomScene.ts frontend/src/__tests__/roomChatBubble.test.ts
git commit -m "feat(game): implement 4-second overhead chat bubble in Phaser and room chat reducer"
```

---

### Task 5: Frontend Room Chat Box HUD Component & Keyboard Isolation

**Files:**
- Create: `frontend/src/components/hud/RoomChatBox.tsx`
- Modify: `frontend/src/services/roomStompClient.ts`
- Modify: `frontend/src/hooks/useRoomSync.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/__tests__/roomChatBox.test.tsx`

**Interfaces:**
- Produces: `RoomChatBox` component
- Produces: `roomStompClient.sendChat(roomId: string, content: string)`
- Guarantees: Typing in input sets `isTypingInFormElement()` to true, preventing WASD/Escape movement or exit dialogs.

- [ ] **Step 1: Write failing Vitest test for RoomChatBox component**

Test:
- Displays recent messages from store.
- Submitting text calls `sendChat` with trimmed text.
- Character counter shows remaining characters up to 200.
- Typing inside input does not trigger Escape leave confirmation or WASD movement.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- roomChatBox.test.tsx` (in `frontend/`)
Expected: FAIL

- [ ] **Step 3: Implement `RoomChatBox` and mount in `App.tsx`**

1. Add `sendChat` to `RoomStompSession` and export helper or integrate with `useRoomSync`.
2. Build `RoomChatBox.tsx` ($\le 200$ lines, Tailwind CSS, toggleable/collapsible panel, message list with auto-scroll, quick reaction buttons `👋`, `🎉`, `☕`, `🔥`, `💡`, `❤️`, input with max length 200).
3. Mount `RoomChatBox` in `App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- roomChatBox.test.tsx` (in `frontend/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/hud/RoomChatBox.tsx frontend/src/services/roomStompClient.ts frontend/src/hooks/useRoomSync.ts frontend/src/App.tsx frontend/src/__tests__/roomChatBox.test.tsx
git commit -m "feat(hud): add RoomChatBox component with quick reactions and keyboard isolation"
```

---

### Task 6: Full Verification & E2E Verification Suite

**Files:**
- Test: Run all backend tests (`mvn test -pl backend`)
- Test: Run all frontend tests (`npm test` in `frontend/`)

- [ ] **Step 1: Run backend tests**

Run: `mvn test -pl backend`
Expected: All tests pass, 0 failures, 0 errors.

- [ ] **Step 2: Run frontend tests & typecheck**

Run: `npm run typecheck` and `npm test` in `frontend/`
Expected: 0 type errors, all test suites pass.

- [ ] **Step 3: Commit any adjustments and final clean up**

```bash
git status
```
