# Đặc Tả Kỹ Thuật Tổng Thể (Master Spec) — Cùng Nhau Học Bài (6 Phases)

## Problem Statement

Người học trực tuyến (học sinh, sinh viên, người tự học) thường xuyên gặp cảm giác cô đơn, thiếu động lực duy trì sự tập trung và không có không gian tương tác trực quan để vừa học cùng nhau (xem bài giảng, nghe nhạc Lofi đồng bộ), vừa hỏi bài và chữa bài tập tức thời. Các nền tảng gọi video truyền thống (Zoom, Google Meet) tạo áp lực bật camera, tốn băng thông và thiếu tính gắn kết không gian; trong khi các kênh chat văn bản lại không hỗ trợ đồng bộ thời gian thực cho trình phát bài giảng và bảng nháp giải bài tập.

## Solution

Xây dựng **Cùng Nhau Học Bài (Study Together 2D Web Game)** — một không gian học tập trực tuyến 2D góc nhìn **3/4 Top-Down Orthogonal** ngay trên trình duyệt (Desktop và Mobile), được triển khai theo **6 Phase (Vertical Slices)**:

- **Phase 1 — Foundation, Docker Infra & Hybrid Auth**: Thiết lập nền tảng cơ sở dữ liệu bền vững (MySQL 8.0) và bộ nhớ trạng thái thời gian thực (Redis 7.x), cho phép người học bước ngay vào **Room** mặc định với tư cách **Guest** không cần đăng ký, và hỗ trợ **Account Upgrade** không gián đoạn lên **Registered User** để bảo toàn toàn bộ thời gian học.
- **Phase 2 — 2D Classroom Engine & Character State Machine**: Xây dựng bản đồ **Room** 2D tương tác với tìm đường tự động $A^*$, máy trạng thái nhân vật 3 trạng thái bất biến (`FREE_ROAM` $\leftrightarrow$ `WALKING_TO_SEAT` $\leftrightarrow$ `SEATED`), quy tắc ưu tiên bàn phím tức thời và khóa di chuyển khi đang ngồi học.
- **Phase 3 — Realtime Room Sync, Atomic Seat Lock & Grace Period**: Đồng bộ vị trí và hoạt ảnh của mọi người học trong **Room** ở tần suất 10Hz kèm nội suy mượt 60 FPS, khóa **Seat** nguyên tử chống trùng chỗ, bảo lưu chỗ ngồi và vai trò **Table Host** trong **Grace Period** 30 giây khi rớt mạng, tự động thực hiện **Auto-Host Succession**, và hiển thị bong bóng chat chung trên đầu nhân vật.
- **Phase 4 — Table Workspace: Host Permissions, Synced YouTube & SOS**: Cung cấp **Table Workspace** riêng tư cho từng **Table**, hệ thống phân quyền **Table Host** / **Co-Host** / **Table Member** kèm chế độ **Free Collaboration**, trình phát YouTube đồng bộ chống giật ($\Delta t = 2.0\text{s}$), bộ đếm giờ học chính xác cả khi ẩn tab, kênh trò chuyện nội bộ bàn và biển báo **SOS Banner** kêu gọi hỗ trợ giải bài.
- **Phase 5 — Ephemeral Homework Whiteboard & Auto-Cleanup**: Cho phép tải lên hoặc dán nhanh (`Ctrl + V`) tối đa 5 **Homework Slide** mỗi **Table** (định dạng `.webp`), vẽ hướng dẫn thời gian thực bằng các công cụ **Stroke** (`PEN`, `HIGHLIGHTER`, `TEXT`, `ERASER`) và **Laser Pointer** chuẩn hóa tọa độ `[0.0, 1.0]`, đồng thời tự động xóa sạch dữ liệu tạm ngay khi **Table** về `0` người ngồi.
- **Phase 6 — Study Sessions Persistence, Gamification & WebRTC Voice**: Ghi nhận các **Study Session** hợp lệ ($\ge 1\text{ phút}$), mở khóa trang phục và thú cưng để bàn theo tổng số phút học tích lũy, hiển thị bảng xếp hạng học tập, và tích hợp đàm thoại âm thanh **WebRTC P2P Mesh** cho các thành viên ngồi cùng **Table**.

## User Stories

### Phase 1: Foundation, Docker Infra & Hybrid Auth
1. As a **Guest**, I want to enter the study space immediately by only choosing an avatar, a nickname ($\le 20$ characters), and today's study goal ($\le 60$ characters), so that I can start studying without registration friction.
2. As a **Guest**, I want my temporary identity and session token to persist across browser refreshes for up to 7 days, so that I do not lose my temporary study progress if I reload the tab.
3. As a **Guest**, I want my temporary session creation to avoid creating database bloat in persistent storage, so that the system remains fast and clean.
4. As a **Guest**, I want to perform an **Account Upgrade** using Email/Password or Google sign-in via an in-app modal without reloading the page, so that my active study session and seat are never interrupted.
5. As a **Guest** upgrading to a new **Registered User**, I want all valid **Study Sessions** accumulated during my guest session to be automatically merged into my permanent account's total study minutes, so that none of my prior effort is lost.
6. As a **Guest** logging into an existing **Registered User** account while already **`SEATED`**, I want my active **Seat** ownership and **Table Host** / **Co-Host** privileges to seamlessly transfer to my registered identity in real time, so that I remain seated at the same **Table**.
7. As a **Registered User**, I want to log in directly with my Email/Password or Google account, so that I can access my unlocked items and cumulative study history across devices.

### Phase 2: 2D Classroom Engine & Character State Machine (Local)
8. As a learner in **`FREE_ROAM`**, I want to view the classroom in a 3/4 Top-Down 2D perspective at a smooth 60 FPS on both desktop and mobile browsers, so that I can clearly see tables, seats, character faces, and status indicators.
9. As a learner in **`FREE_ROAM`**, I want to move my character freely using `WASD` or Arrow keys with collision detection against walls and furniture, so that I can explore the **Room** naturally.
10. As a learner in **`FREE_ROAM`**, I want to click or tap any walkable tile on the map to have my character automatically navigate around obstacles via $A^*$ pathfinding, so that I can move comfortably on mobile and desktop.
11. As a learner in **`FREE_ROAM`**, I want to click or tap directly on an empty **Seat** to enter **`WALKING_TO_SEAT`** and automatically walk to that **Seat**, so that sitting down at a **Table** is effortless.
12. As a learner whose character is automatically following an $A^*$ path (`PathFollowing` or **`WALKING_TO_SEAT`**), I want pressing any movement key (`WASD` / Arrow keys) to immediately cancel the automatic path in the exact same frame and hand control back to the keyboard, so that manual movement always feels responsive.
13. As a learner who has reached my target **Seat** and transitioned to **`SEATED`**, I want all map movement inputs (`WASD`, Arrow keys, and map clicks/taps) to be completely locked, so that typing in chat, controlling videos, or drawing on homework slides never causes my character to walk away accidentally.
14. As a learner in **`SEATED`** state, I want my character sprite to switch to a seated posture facing the **Table**, so that everyone in the **Room** can visually tell I am studying at that **Table**.
15. As a learner in **`SEATED`** state, I want to leave the **Table** only when I explicitly click the "Stand Up / Leave Table" button or confirm pressing `ESC`, so that I never exit my study session by mistake.

### Phase 3: Realtime Room Sync, Atomic Seat Lock & Grace Period
16. As a learner entering a **Room**, I want to immediately receive the full snapshot of all current learners, occupied **Seats**, **Table Hosts**, and active **SOS Banners**, so that my map view is accurate from the first second.
17. As a learner moving in a **Room**, I want my movement updates to be throttled to at most 10 packets per second while remote learners' movements are linearly interpolated (`Lerp`) at 60 FPS, so that movement looks smooth without wasting network bandwidth.
18. As a learner clicking an empty **Seat**, I want the server to lock the **Seat** atomically when my character arrives at the **Seat**, so that two learners can never occupy the exact same **Seat** simultaneously.
19. As a learner in **`WALKING_TO_SEAT`** heading toward a specific **Seat**, I want my character to immediately stop pathfinding and revert to **`FREE_ROAM`** with a gentle notification if another learner sits in that target **Seat** before I arrive, so that I do not keep walking into an already occupied **Seat**.
20. As the first learner to transition to **`SEATED`** at a completely empty **Table** ($0$ occupied seats), I want to be automatically assigned as the **Table Host** with a crown/star badge, so that the **Table** immediately has an active coordinator.
21. As a **`SEATED`** learner (including a **Table Host**) who experiences a temporary network drop or refreshes the browser (`F5`), I want the system to preserve my **Seat** and my **Table Host** / **Co-Host** role for a 30-second **Grace Period**, so that reconnecting within 30 seconds restores me directly to my **Seat** and **Table Workspace** without interruption.
22. As a **Table Member** or **Co-Host** at a **Table**, I want the system to automatically trigger **Auto-Host Succession** when the current **Table Host** stands up or fails to reconnect within the 30-second **Grace Period**—prioritizing the longest-seated **Co-Host**, or if none exists, the longest-seated **Table Member**—so that the **Table** is never left without a **Table Host**.
23. As a learner in a **Room**, I want to send room-wide chat messages or reactions that also appear as a chat bubble above my character's head for 4 seconds, so that I can greet or interact with people nearby.

### Phase 4: Table Workspace — Host Permissions, Synced YouTube & SOS
24. As a **`SEATED`** learner, I want the **Table Workspace** interface to open automatically and subscribe exclusively to my **Table**'s realtime channel, so that I only receive workspace events relevant to the **Table** where I am sitting.
25. As a **Table Host** or **Co-Host**, I want to paste a YouTube URL, play, pause, or seek the video and have all learners **`SEATED`** at my **Table** synchronize to that state in real time, so that we can watch lectures or listen to Lofi music together.
26. As a learner joining a **Table** where a video is already playing or receiving a sync update, I want my player to calculate the real-time target timestamp and only seek when the drift is $\ge 2.0\text{ seconds}$, so that playback remains smooth without micro-stutters.
27. As a **`SEATED`** learner who switches to another browser tab or minimizes the window while studying, I want my study timer and video synchronization to rely on real system timestamps (`Epoch`) rather than throttled browser intervals, so that my study duration is always accurate.
28. As a **Table Member** who wants to change the video or present homework on the board, I want to click a "Request Control" button to send a permission request to the **Table Host**, so that I can ask to collaborate.
29. As a **Table Host**, I want to see a compact toast/popover when a **Table Member** requests control with `[Accept]` and `[Decline]` buttons, so that I can grant them **Co-Host** permissions with one click.
30. As a **Table Host**, I want a quick toggle for **Free Collaboration** (`isFreeCollab`) that grants all current and future learners sitting at the **Table** **Co-Host** capabilities, so that group study sessions can operate without manual approvals.
31. As a **Table Host**, I want to transfer my **Table Host** role directly to another learner at the **Table**, so that I can hand over leadership before leaving.
32. As a **Table Host**, I want to toggle an **SOS Banner** with a custom subject description (e.g., *"Need help with Calculus integrals"*), so that a glowing SOS indicator appears above our **Table** on the 2D map to invite helpers from **`FREE_ROAM`**.
33. As a **`SEATED`** learner, I want to send text messages and emojis in a private **Table** chat visible only to people sitting at the same **Table**, so that our group discussion does not spam the entire **Room**.

### Phase 5: Ephemeral Homework Whiteboard & Auto-Cleanup
34. As a **Table Host** or **Co-Host**, I want to upload an image file (`.jpg`, `.png`, `.webp` up to $5\text{MB}$) or press `Ctrl + V` to paste a screenshot directly onto the **Table Workspace** as a **Homework Slide**, so that we can inspect a problem together in seconds.
35. As a **Table Host** or **Co-Host**, I want my uploaded or pasted homework image to be compressed to `.webp` on the client prior to upload and validated by magic bytes on the server, so that slides load instantaneously for everyone at the **Table** while remaining secure.
36. As a **Table Host** or **Co-Host**, I want to manage up to 5 **Homework Slides** simultaneously per **Table** and switch the active slide for everyone at the **Table**, so that we can work through multi-part exercises.
37. As a **Table Host** or **Co-Host**, I want to draw **Strokes** on the active **Homework Slide** using a freehand Pen, a semi-transparent Highlighter, or short Text labels, so that I can explain step-by-step solutions visually.
38. As a **Table Host** or **Co-Host**, I want all **Strokes** and **Laser Pointer** coordinates to be normalized to `[0.0, 1.0]` relative to the image's dimensions, so that annotations align with 100% precision across desktop monitors and mobile screens.
39. As a **Table Host** or **Co-Host**, I want to move a **Laser Pointer** across the **Homework Slide** (throttled at 10Hz and never persisted in storage) to highlight specific parts of a formula while speaking, so that tablemates can follow my explanation in real time.
40. As a **Table Host** or **Co-Host**, I want to erase individual **Strokes** with the Eraser tool or clear all **Strokes** on the current **Homework Slide**, so that I can correct mistakes cleanly.
41. As a learner, I want all **Homework Slides** (both physical `.webp` files and in-memory stroke state) to be permanently deleted the instant the last person leaves the **Table** ($0$ seated learners) or after a maximum 6-hour TTL, so that temporary homework images never consume permanent storage.

### Phase 6: Study Sessions Persistence, Gamification & WebRTC Voice
42. As a **`SEATED`** learner who stands up from a **Table** (or whose 30-second **Grace Period** expires) after studying for at least $1\text{ minute}$, I want my **Study Session** duration to be recorded automatically, so that my study time is tracked accurately.
43. As a learner, I want sessions shorter than $1\text{ minute}$ to be ignored when recording **Study Sessions**, so that accidental sit-and-leave actions do not pollute study logs.
44. As a learner, I want to view a Study Leaderboard and my personal study statistics, so that I stay motivated by seeing my progress alongside the community.
45. As a learner, I want to unlock character customizations (`SKIN`, `HAT`, `DESK_PET`) automatically once my `total_study_minutes` meets each item's requirement and equip them on my character, so that my dedication is rewarded visually in the **Room**.
46. As a **`SEATED`** learner, I want to opt into voice chat at my **Table** by toggling my microphone (Mute/Unmute) over a low-latency **WebRTC P2P Mesh** connection with my tablemates, so that we can discuss homework verbally without setting up external call links.
47. As a **`SEATED`** learner in voice chat, I want to see visual speaking indicators next to tablemates who are currently talking and have all audio streams automatically disconnected the moment I leave the **Table**, so that my privacy and audio state are always clear.

## Implementation Decisions

### 1. Phased Vertical-Slice Delivery Architecture
- The system is divided into 6 sequential/parallelizable vertical slices (**Phase 1** through **Phase 6**), where each phase delivers an end-to-end testable increment across Backend and Frontend while respecting strict module size limits (React components $\le 200$ lines, Phaser modules $\le 250$ lines, Zustand stores $\le 150$ lines, Spring Controllers/Handlers $\le 150$ lines, Spring Services $\le 250$ lines, DTOs/Entities $\le 120$ lines).

### 2. Hybrid Auth & Zero-Interruption Account Upgrade (ADR-0001 & ADR-0004)
- **Guest Onboarding**: `POST /api/v1/auth/guest` issues a signed 7-day JWT (`guestToken`) with a generated UUID `guestId` without inserting a row into the MySQL `users` table.
- **Persistent Schema**: The `users` table stores `id` (UUID), `email` (nullable unique), `password_hash` (nullable BCrypt hash for `LOCAL` auth), `nickname`, `avatar_sprite_id`, `auth_provider` (`GUEST`, `LOCAL`, `GOOGLE`), and `total_study_minutes`.
- **Guest Session Staging**: Completed **Study Sessions** ($\ge 1\text{ minute}$) for a **Guest** are appended to Redis under `guest:{guestId}:sessions` with a 7-day TTL.
- **Zero-Interruption Upgrade**: `POST /api/v1/auth/upgrade` accepts either `LOCAL` credentials (email + password) or a Google Identity Services popup `idToken` alongside the current `guestToken`.
  - When creating a new **Registered User**, the database record reuses `guestId` as `users.id`, flushes all staged sessions from `guest:{guestId}:sessions` into MySQL `study_sessions`, increments `users.total_study_minutes`, and issues a registered JWT.
  - When merging into an already-existing **Registered User**, the backend flushes the staged sessions into `study_sessions` under the existing `registeredUserId` and executes an atomic Redis Lua script to swap `guestId` $\rightarrow$ `registeredUserId` across `room:{roomId}:players`, `room:{roomId}:seats`, and `table:{tableId}:state` so the learner remains **`SEATED`** without dropping their WebSocket session or **Table Host** status.

### 3. Shared Static Room Topology & Single Default Room (ADR-0003)
- Learners bypass any multi-room lobby and enter the default **Room** (`main-library`, auto-sharding to `main-library-2`, etc. if capacity exceeds 50 concurrent learners).
- Both the Phaser 3 Tilemap engine and the Spring Boot `RoomTopologyRegistry` read the exact same static Tiled-compatible JSON map definition (`32x32px` grid) containing collision layers and seat metadata (`tableId`, `seatId`, tile coordinates, seat capacity per table, and facing direction).

### 4. Character State Machine, Input Priority & Zustand Bridge
- **Canvas ↔ DOM Isolation**: Phaser 3 manages the 60 FPS canvas loop, tilemap rendering, $A^*$ pathfinding (`EasyStar.js`), and character sprites. React manages all HUD modals and the **Table Workspace**. Communication between Phaser and React occurs exclusively through Zustand stores (`useGameStore`, `useTableStore`, `useAuthStore`) using atomic selectors.
- **State Machine Shape**:
```ts
type CharacterState = 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED';
```
- **Invariants**:
  1. Pressing any directional key (`WASD` / Arrow keys) while following an $A^*$ path in `FREE_ROAM` or `WALKING_TO_SEAT` immediately invokes `clearPath()` within the same frame and transitions to manual keyboard movement in `FREE_ROAM`.
  2. When in `WALKING_TO_SEAT`, if a room broadcast indicates the target `seatId` has been claimed by another learner, the client immediately invokes `clearPath()`, transitions back to `FREE_ROAM` at its current coordinates, and surfaces a non-blocking notification.
  3. Reaching the target `seatId` tile triggers a `/app/room/{roomId}/seat.sit` request; upon atomic lock confirmation, the character transitions to `SEATED`, locks all map movement inputs, and opens the **Table Workspace**.

### 5. Realtime Room Synchronization, Atomic Seat Lock & 30s Grace Period
- **Hot State in Redis**:
  - `room:{roomId}:players` (`HASH`): Maps `userId` $\rightarrow$ player state JSON (`nickname`, `avatarId`, `x`, `y`, `dir`, `state`, `tableId`, `seatId`, `studyGoal`, `sitStartTime`).
  - `room:{roomId}:seats` (`HASH`): Maps `seatId` $\rightarrow$ `userId`.
  - `room:{roomId}:disconnects` (`HASH`): Maps `userId` $\rightarrow$ `disconnectedAtEpoch`.
- **Atomic Seat Claim**: Executed via a Redis Lua script / `HSETNX` on `room:{roomId}:seats`. If the **Table** previously had $0$ seated learners, `table:{tableId}:state` is initialized with `hostUserId = userId`.
- **10Hz Throttling**: Movement packets (`/app/room/{roomId}/move`) are throttled to at most 10 packets/sec (`100ms`) on the client and rate-limited on the server; clients interpolate remote coordinates at 60 FPS.
- **30-Second Grace Period & Deterministic Auto-Host Succession**:
  - On `SessionDisconnectEvent` for a **`SEATED`** learner, `SeatDisconnectWatchdog` records the disconnect timestamp in Redis and schedules a 30-second verification task via Spring's `TaskScheduler`.
  - Reconnecting within 30 seconds cancels the scheduled cleanup and restores the learner's **`SEATED`** state and **Table** role.
  - If still disconnected after 30 seconds (or when a learner voluntarily sends `/app/room/{roomId}/seat.leave`), the backend releases the **Seat** in Redis, records the **Study Session** if duration $\ge 1\text{ minute}$, and evaluates remaining seated learners at that **Table**:
    - If $> 0$ learners remain and the departing learner was `hostUserId`, **Auto-Host Succession** promotes the **Co-Host** with the earliest `sitStartTime`, or if no **Co-Host** exists, the **Table Member** with the earliest `sitStartTime`, removing the new host from `coHostUserIds` while preserving `videoState`, `homeworkSlides`, `isFreeCollab`, and `sosBanner`.
    - If $0$ learners remain at the **Table**, `table:{tableId}:state` is deleted and `EphemeralStorageService.purgeTableHomework(tableId)` immediately deletes all associated `.webp` files and Redis keys.

### 6. Table Workspace, Synced YouTube & Native Normalized Whiteboard (ADR-0002)
- **Server-Authoritative Permissions**: Every workspace mutation (`video.sync`, slide upload/delete, stroke draw/clear, `sos.toggle`) is verified on the server to ensure the sender is `hostUserId`, listed in `coHostUserIds`, or `isFreeCollab == true`. Unauthorized mutations are rejected with a structured error message to `/user/queue/errors`.
- **YouTube Drift Tolerance**: Server stores `{ videoId, isPlaying, currentTime, lastUpdatedEpoch }`. Clients compute $T_{\text{current}} = T_{\text{saved}} + (\text{Epoch}_{\text{now}} - \text{Epoch}_{\text{updated}}) / 1000$ and only invoke `player.seekTo(T_current)` when $|T_{\text{player}} - T_{\text{current}}| \ge 2.0\text{s}$.
- **Ephemeral Homework Board**:
  - Client compresses selected/pasted images (`Ctrl + V`) to `.webp` (`maxDimension = 1920`, `quality = 0.85`) before uploading to `POST /api/v1/tables/{tableId}/homework-image`.
  - Backend validates file size ($\le 5\text{MB}$), slide count ($\le 5$ slides per **Table**), and actual magic bytes (`JPEG`, `PNG`, `WEBP`), normalizes storage as `.webp` inside the ephemeral volume, and sets a 6-hour Redis TTL key `ephemeral:img:{imageId}`.
  - Annotations are rendered via a native HTML5 `<canvas>` 2D hook using normalized coordinates `[0.0, 1.0]`. Completed **Strokes** (`PEN`, `HIGHLIGHTER`, `TEXT`) and `ERASER` actions (by `strokeId`) persist in `table:{tableId}:state`, whereas **Laser Pointer** coordinates are broadcast ephemerally at 10Hz without Redis persistence.

### 7. Study Sessions, Gamification & WebRTC P2P Mesh Voice Chat (ADR-0005)
- **Study Session Recording**: Triggered on seat release (voluntary leave or Grace Period expiry). Sessions with `durationMinutes >= 1` are persisted to MySQL `study_sessions` (for **Registered Users**) or staged in Redis `guest:{guestId}:sessions` (for **Guests**).
- **Character Customizations**: `character_items` defines unlockable `SKIN`, `HAT`, and `DESK_PET` items gated by `required_study_minutes <= users.total_study_minutes`.
- **WebRTC P2P Mesh Voice Chat**: Seated learners at the same **Table** ($\le 6$ seats) establish direct browser-to-browser `RTCPeerConnection` audio streams using `/app/table/{tableId}/voice.signal` over STOMP to exchange `SDP Offer/Answer` and `ICE Candidates`.

## Testing Decisions

### Philosophy: External Behavior at the Highest Seams
Tests verify observable behavior across two primary seams without coupling to internal private helper classes:

1. **Seam 1 — Backend HTTP & STOMP Protocol Seam (with Testcontainers MySQL 8.0 + Redis 7.x)**:
   - Exercises REST controllers (`/api/v1/**`) and STOMP WebSocket handlers (`/app/room/**`, `/app/table/**`) against real containerized MySQL and Redis instances plus a temporary filesystem directory (`@TempDir`).
   - **Modules under test**:
     - *Hybrid Auth & Account Upgrade Module*: Verifies guest JWT issuance creates zero MySQL rows; verifies upgrading flushes staged Redis study sessions into MySQL `study_sessions` and atomically swaps identity on active Redis seats/tables.
     - *Room & Atomic Seat Lock Module*: Uses concurrent threads (`CountDownLatch`) attempting to claim the same `seatId` simultaneously to assert that exactly one learner transitions to `SEATED` and becomes `TABLE_HOST` while all others receive a seat-occupied rejection.
     - *Grace Period & Auto-Host Succession Module*: Simulates WebSocket disconnection of a `TABLE_HOST`, asserting seat retention within the Grace Period and deterministic succession (`CO_HOST` oldest `sitStartTime` $\rightarrow$ `MEMBER` oldest `sitStartTime`) after expiry.
     - *Table Workspace & Ephemeral Storage Module*: Asserts server-authoritative permission enforcement, magic-byte validation on image uploads, normalized stroke persistence, and immediate deletion of `.webp` files and Redis keys when a **Table** reaches $0$ seated learners.
     - *Study Session & Gamification Module*: Verifies the $\ge 1\text{ minute}$ session threshold, leaderboard aggregation, and item unlock eligibility.

2. **Seam 2 — Frontend Zustand Bridge & Pure Domain Controllers (Vitest)**:
   - Exercises the Zustand stores (`useGameStore`, `useTableStore`, `useAuthStore`) alongside the headless `CharacterStateMachine`, `GridPathfinder`, `YouTubeDriftCalculator`, and `CoordinateNormalizer`.
   - **Modules under test**:
     - *Character State Machine & Input Priority*: Verifies `FREE_ROAM` $\leftrightarrow$ `WALKING_TO_SEAT` $\leftrightarrow$ `SEATED` transitions, immediate `clearPath()` on `WASD` input, mid-walk abort when target seat is taken remotely, and complete movement lock while `SEATED`.
     - *YouTube Drift & Background Timer*: Verifies `seekTo` is skipped when drift $< 2.0\text{s}$ and triggered when drift $\ge 2.0\text{s}$ using epoch timestamps.
     - *Normalized Canvas Coordinates*: Verifies lossless round-trip mapping between viewport pixel coordinates and `[0.0, 1.0]` normalized coordinates across desktop and mobile aspect ratios.

## Out of Scope

- **Multi-Room CRUD / Custom User-Created Rooms**: Learners join the shared default **Room** (`main-library`) with automatic capacity sharding; custom room creation and map editors are excluded.
- **Persistent Homework Archive**: **Homework Slides** and **Strokes** are strictly ephemeral for the active table session and are never archived to permanent cloud storage.
- **Video / Screen Sharing Media Servers (SFU)**: Video synchronization uses YouTube IFrame metadata only, and table voice chat uses P2P WebRTC Mesh ($\le 6$ peers/table) without deploying LiveKit or Mediasoup servers.
- **Native Mobile Apps (iOS/Android)**: The product is delivered as a responsive Desktop and Mobile Web application.

## Further Notes

- Related Domain Documentation: `GLOSSARY.md` and `docs/adr/0001` through `docs/adr/0005`.
- Delivery Order:
  - **Phase 1**: Foundation, Docker Infra & Hybrid Auth
  - **Phase 2**: 2D Classroom Engine & Character State Machine (Local)
  - **Phase 3**: Realtime Room Sync, Atomic Seat Lock & Grace Period (depends on Phase 1 & Phase 2)
  - **Phase 4**: Table Workspace — Host Permissions, Synced YouTube & SOS (depends on Phase 3)
  - **Phase 5**: Ephemeral Homework Whiteboard & Auto-Cleanup Lifecycle (depends on Phase 4)
  - **Phase 6**: Study Sessions Persistence, Gamification & WebRTC Voice Chat (depends on Phase 4 & Phase 5)
