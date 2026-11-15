# TÀI LIỆU ĐẶC TẢ SẢN PHẨM & KỸ THUẬT (PRD & TECHNICAL SPECIFICATION)

- **Tên dự án:** Cùng Nhau Học Bài (Study Together 2D Web Game)
- **Slogan:** *"Cùng nhau học bài - Không còn cô đơn trên hành trình chinh phục tri thức"*
- **Phiên bản tài liệu:** 2.0.0 (Đồng bộ thực tế triển khai Phase 1 – Phase 6)
- **Kiến trúc cốt lõi:** Hybrid 2D Canvas (Phaser 3) + Reactive HUD (ReactJS 18 + TailwindCSS v4) + Stateful Realtime Backend (Spring Boot 3.4, STOMP WebSocket, Redis 7, MySQL 8.0)
- **Tài liệu liên kết:** [GLOSSARY.md](GLOSSARY.md) | [docs/SPEC.md](docs/SPEC.md) | [docs/adr/](docs/adr/) | [AGENTS.md](AGENTS.md)

---

## 1. TỔNG QUAN SẢN PHẨM & LỰA CHỌN ĐỒ HỌA

### 1.1. Tầm nhìn Sản phẩm
Xây dựng một không gian học tập trực tuyến 2D trên trình duyệt (Web-based Social Study Game), nơi người học điều khiển nhân vật đi lại trong phòng học/thư viện ảo (`Room`), ngồi vào bàn học (`Table`) để cùng xem video bài giảng/nhạc Lofi đồng bộ, đăng ảnh bài tập lên bảng chung (`Homework Slide`) để vẽ hướng dẫn giải bài, trò chuyện văn bản hoặc đàm thoại âm thanh (`WebRTC P2P Mesh`) theo thời gian thực.

### 1.2. Định hướng Góc nhìn Đồ họa: 3/4 Top-Down 2D Orthogonal
Dự án sử dụng góc nhìn **3/4 Top-Down 2D** (tương tự *Gather.town*, *Zep.us*, *Stardew Valley*) thay vì Isometric $2.5\text{D}$ vì 4 ưu điểm kỹ thuật và trải nghiệm:
1. **Hiển thị trực quan mặt bàn & biểu cảm:** Góc nhìn 3/4 cho phép nhìn rõ mặt trước của nhân vật, phụ kiện mở khóa (`SKIN`, `HAT`, `DESK_PET`), bong bóng hội thoại (`Chat Bubble` 4 giây) và biển báo cầu cứu bài tập (`SOS Banner`).
2. **Tối ưu thao tác Chạm & Tìm đường ($A^*$ Pathfinding):** Bản đồ chia theo lưới ô vuông chuẩn ($32 \times 32\text{px}$), giúp việc chạm màn hình trên điện thoại chính xác tuyệt đối và thuật toán tìm đường $A^*$ (`EasyStar.js`) hoạt động nhẹ nhàng.
3. **Nguồn sự thật duy nhất cho Sơ đồ Phòng ([ADR-0003](docs/adr/0003-static-shared-map-topology.md)):** File cấu hình bản đồ tĩnh `shared/maps/main-library.json` được dùng chung cho cả Phaser 3 ở Frontend và `RoomTopologyService` ở Backend để xác thực tọa độ đi lại và khóa ghế mà không cần truy vấn MySQL.
4. **Hiệu năng cao trên trình duyệt di động:** Duy trì mức $60\text{ FPS}$ ổn định ngay cả khi mở kèm trình phát YouTube, bảng vẽ HTML5 Canvas 2D và luồng âm thanh WebRTC.

---

## 2. KIẾN TRÚC HỆ THỐNG & TECH STACK

### 2.1. Sơ đồ Kiến trúc Tổng thể

```text
+-----------------------------------------------------------------------------------+
|                        CLIENT (Desktop & Mobile Browser)                          |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | LỚP GIAO DIỆN NỔI - REACTJS HUD LAYER (Vite 6 + TailwindCSS v4)             |  |
|  | - Auth/Onboarding Modal (Guest, Local Email/Password, Google Popup Upgrade) |  |
|  | - HUD: TopBar, RoomChatBox, StudyLeaderboard, StudySessions, Customizer     |  |
|  | - Table Workspace: SyncedYouTubePlayer, HomeworkAnnotationCanvas,           |  |
|  |   HomeworkLaserOverlay, TableChatPanel, SosBannerControl, VoiceChatBar      |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         |                                         |
|              [ Zustand Bridge: useAuthStore / useGameStore /                      |
|                                useTableStore / useVoiceStore ]                    |
|                                         |                                         |
|  +--------------------------------------v--------------------------------------+  |
|  | LỚP GAME 2D - PHASER 3 ENGINE LAYER                                         |  |
|  | - ClassroomScene & classroomMapRenderer (shared/maps/main-library.json)     |  |
|  | - InputController (WASD Priority + Point-and-Click/Touch)                   |  |
|  | - GridPathfinder (EasyStar.js A*), SeatInteractionManager,                  |  |
|  |   PlayerSprite, RemotePlayersRenderer (60 FPS Lerp), ChatBubble, SOSOverlay |  |
|  +--------------------------------------+--------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                                          |
                     WebSocket (STOMP)    |    REST API (HTTPS)
                                          v
+-----------------------------------------------------------------------------------+
|                        BACKEND SERVER (Dockerized Environment)                    |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | JAVA 21 + SPRING BOOT 3.4 APPLICATION                                       |  |
|  | - modules/auth: Hybrid Guest JWT, Local/Google Login, Zero-Interruption     |  |
|  |                 Account Upgrade & Atomic Redis Identity Swap                |  |
|  | - modules/room: Auto-Sharding (50 players/shard), Movement 10Hz,            |  |
|  |                 Atomic Seat Lock (Lua), 30s Grace Period Watchdog, RoomChat |  |
|  | - modules/table: Host/Co-Host Permissions, YouTube Sync, SOS Banner,        |  |
|  |                  Ephemeral Homework Slides (.webp), Whiteboard & WebRTC     |  |
|  | - modules/stats: Study Sessions (>= 1m), Guest Session Staging,             |  |
|  |                  Leaderboard & Character Customizations (Skin/Hat/DeskPet)  |  |
|  +-------------------+-------------------------------------+-------------------+  |
|                      |                                     |                      |
|                      v                                     v                      |
|  +---------------------------------------+   +---------------------------------+  |
|  | REDIS 7.x (In-Memory Hot State)       |   | MYSQL 8.0 (Cold Persistent DB)  |  |
|  | - Room Shards, Players, Seats (Lua)   |   | - users (Registered accounts)   |  |
|  | - Room-scoped Table State & Chat      |   | - study_sessions (Study logs)   |  |
|  | - Guest Staged Sessions & Ephemeral   |   | - character_items (Catalog &    |  |
|  |   Homework Image Metadata (TTL)       |   |   unlock thresholds, Flyway)    |  |
|  +---------------------------------------+   +---------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.2. Chi tiết Công nghệ Sử dụng (Tech Stack)

| Phân hệ | Công nghệ / Thư viện | Vai trò trong dự án |
| :--- | :--- | :--- |
| **Frontend Core** | React 18.3, Vite 6, TypeScript 5.7, TailwindCSS v4 | Xây dựng lớp giao diện nổi (HUD), Modal xác thực, Bảng xếp hạng và Không gian bàn học (`Table Workspace`). |
| **State & Validation** | Zustand 5, TanStack Query v5, React Hook Form v7, Zod | Zustand làm cầu nối duy nhất giữa React và Phaser (qua atomic selectors); Hook Form + Zod kiểm tra dữ liệu đầu vào. |
| **2D Game Engine** | Phaser 3.90 + EasyStar.js | Render bản đồ 2D góc nhìn 3/4 Top-Down, hoạt ảnh nhân vật, phụ kiện, bong bóng chat, xử lý va chạm và tìm đường $A^*$. |
| **Bảng vẽ, Video & Voice** | YouTube IFrame API, HTML5 `<canvas>` 2D, WebRTC P2P Mesh | Đồng bộ video chống giật ($\Delta t = 2.0\text{s}$), vẽ chú thích chuẩn hóa tọa độ `[0.0, 1.0]` ([ADR-0002](docs/adr/0002-native-canvas-normalized-homework-board.md)) và đàm thoại âm thanh P2P ([ADR-0005](docs/adr/0005-webrtc-p2p-mesh-over-stomp.md)). |
| **Backend Core** | Java 21 + Spring Boot 3.4.3 | Xử lý nghiệp vụ, phân quyền máy chủ (`Server-Authoritative`), xác thực JWT/Google OAuth2 và điều phối sự kiện thời gian thực. |
| **Realtime Protocol** | Spring WebSocket + `@stomp/stompjs` | Giao tiếp hai chiều theo mô hình Pub/Sub tách biệt kênh cấp Phòng (`Room Scope`) và kênh cấp Bàn (`Table Scope`). |
| **In-Memory & Atomic State** | Redis 7.x + Lua Scripts | Lưu trạng thái nóng của phòng/bàn, khóa ghế nguyên tử (`atomic_seat_sit.lua`), hoán đổi định danh (`swap_identity.lua`) và TTL dữ liệu tạm. |
| **Database & Migration** | MySQL 8.0 + Flyway (`V1..V3`) + Docker Compose | Lưu trữ bền vững cho `Registered User`, lịch sử `study_sessions` và danh mục vật phẩm `character_items`. |
| **Testing & Quality** | JUnit 5, Testcontainers (MySQL + Redis), Vitest, Testing Library | Kiểm thử tích hợp toàn luồng ở Backend với container thực tế và kiểm thử đơn vị/giao diện ở Frontend. |

---

## 3. ĐẶC TẢ CHI TIẾT CÁC PHÂN HỆ CHỨC NĂNG

### 3.1. Cơ chế Xác thực Kết hợp (Hybrid Auth: Guest-First & Zero-Interruption Upgrade)
Hệ thống ưu tiên trải nghiệm vào phòng học ngay lập tức (**Zero-friction onboarding**) kết hợp nâng cấp tài khoản không gián đoạn ([ADR-0001](docs/adr/0001-redis-only-guest-sessions-until-upgrade.md), [ADR-0004](docs/adr/0004-zero-interruption-account-upgrade.md)):

1. **Chế độ Khách (`Guest Mode` - Mặc định):**
   - Gọi `POST /api/v1/auth/guest` với `nickname` ($\le 20$ ký tự), `studyGoal` ($\le 60$ ký tự) và `avatarId` để nhận `guestId` (UUID) cùng `guestToken` (JWT hạn 7 ngày).
   - **Không ghi rác vào MySQL:** Phiên Guest không tạo dòng trong bảng `users` của MySQL. Các phiên học hợp lệ ($\ge 1$ phút) và trang phục của Guest được lưu tạm trên Redis (`guest:{guestId}:sessions` và `guest:{guestId}:customization`, TTL 7 ngày).
2. **Đăng nhập & Nâng cấp Không Gián Đoạn (`Zero-Interruption Account Upgrade`):**
   - Người học có thể đăng nhập trực tiếp (`POST /api/v1/auth/login`) hoặc nâng cấp từ phiên Guest đang hoạt động (`POST /api/v1/auth/upgrade`) bằng **Email/Password (`LOCAL`)** hoặc **Google Identity Services Popup (`idToken`)** ngay trong Modal mà không cần tải lại trang.
   - **Tạo tài khoản mới từ Guest:** Tái sử dụng `guestId` làm khóa chính `users.id`, chuyển toàn bộ phiên học tạm từ `guest:{guestId}:sessions` sang bảng `study_sessions` trên MySQL và cộng dồn vào `users.total_study_minutes`.
   - **Gộp vào tài khoản `Registered User` đã có sẵn khi đang ngồi bàn (`SEATED`):** Chuyển toàn bộ phiên học tạm vào `registeredUserId`, đồng thời thực thi Lua script `swap_identity.lua` hoán đổi nguyên tử `guestId` $\rightarrow$ `registeredUserId` trên `room:{roomId}:players`, `room:{roomId}:seats` và `table:{roomId}:{tableId}:state` để giữ nguyên ghế ngồi và quyền `TABLE_HOST` / `CO_HOST`.

---

### 3.2. Hệ thống Điều khiển Nhân vật & Máy Trạng thái (Movement & State Machine)

#### A. Ba Trạng thái Bất biến của Nhân vật (`CharacterState`)
1. **`FREE_ROAM` (Đi lại tự do):**
   - Nhân vật chưa gắn với ghế hay bàn nào; di chuyển tự do bằng **Bàn phím (`WASD` / Phím mũi tên)** hoặc **Click/Chạm vào ô sàn bất kỳ** để tìm đường $A^*$.
2. **`WALKING_TO_SEAT` (Đang tự động tiến vào ghế):**
   - Kích hoạt khi người học ở `FREE_ROAM` click/chạm vào một chiếc ghế trống (`Seat`).
   - Nhân vật tự động đi theo lộ trình $A^*$ tới ô ghế đích. Nếu giữa đường có người khác chiếm mất ghế đó (nhận qua sự kiện phòng), nhân vật lập tức hủy lộ trình (`clearPath()`), trở về `FREE_ROAM` tại vị trí hiện tại và hiển thị thông báo nhẹ.
   - Khi chạm tới ô ghế đích $\rightarrow$ gửi `/app/room/{roomId}/seat.sit` $\rightarrow$ chuyển sang `SEATED` khi khóa ghế thành công.
3. **`SEATED` (Đã ngồi vào bàn học):**
   - **Khóa hoàn toàn thao tác di chuyển bản đồ** (`WASD`, phím mũi tên và click bản đồ đều bị vô hiệu hóa) để người dùng gõ chat, điều khiển video và vẽ bài tập không làm nhân vật chạy khỏi ghế.
   - Nhân vật chuyển sang tư thế ngồi quay mặt theo hướng ghế (`FacingDirection`) và mở giao diện **`Table Workspace`**.
   - Chỉ thoát về `FREE_ROAM` khi bấm nút **"Đứng dậy rời bàn"** hoặc xác nhận qua hộp thoại phím `ESC`.

#### B. Quy tắc Ưu tiên Bàn phím Tức thời (`Input Priority Rule`)
- Khi nhân vật đang di chuyển tự động theo lộ trình $A^*$ (ở cả `FREE_ROAM` lẫn `WALKING_TO_SEAT`), nếu người dùng nhấn bất kỳ phím di chuyển nào (`W, A, S, D` hoặc phím mũi tên), hệ thống lập tức gọi **`clearPath()` ngay trong cùng frame đó** và chuyển quyền điều khiển về bàn phím.

---

### 3.3. Đồng bộ Phòng học, Khóa Ghế Nguyên tử & Phân quyền Bàn học

1. **Tự động Phân mảnh Phòng (`Room Sharding`):**
   - Khi gọi `POST /api/v1/rooms/join`, người học được đưa vào phòng mặc định `main-library`. Khi số lượng người trong phòng chạm ngưỡng tối đa **50 người**, hệ thống tự động mở thêm phân mảnh mới (`main-library-2`, `main-library-3`, ...) để đảm bảo không gian thông thoáng.
2. **Khóa Ghế Nguyên tử (`Atomic Seat Lock`) & Quyền Trưởng bàn (`TABLE_HOST`):**
   - Sử dụng Lua script `atomic_seat_sit.lua` trên `room:{roomId}:seats` để đảm bảo tại một thời điểm chỉ duy nhất 1 người chiếm được ghế và 1 người không thể chiếm 2 ghế.
   - Người đầu tiên ngồi vào một bàn đang trống ($0$ người ngồi) tự động trở thành **`TABLE_HOST`**.
3. **Thời gian Giữ ghế 30 giây (`Grace Period`) & Kế nhiệm Trưởng bàn (`Auto-Host Succession`):**
   - Khi người học đang `SEATED` bị mất kết nối WebSocket hoặc tải lại trang (`F5`), `SeatDisconnectWatchdog` bảo lưu ghế ngồi và quyền hạn tại bàn trong đúng **30 giây**. Nếu kết nối lại trong 30 giây, người học được khôi phục thẳng vào ghế và bàn học cũ.
   - Khi `TABLE_HOST` chủ động đứng dậy hoặc hết 30 giây không kết nối lại, hệ thống tự động bầu `TABLE_HOST` kế nhiệm theo thứ tự ưu tiên: **`CO_HOST` ngồi lâu nhất (`sitStartTime` sớm nhất) $\rightarrow$ `MEMBER` ngồi lâu nhất**.
4. **Luồng Xin quyền & Chế độ Hợp tác Tự do (`Free Collaboration`):**
   - `MEMBER` có thể gửi yêu cầu xin quyền điều khiển (`permission.request`). `TABLE_HOST` nhận thông báo nổi (`HostPermissionToast`) để **Chấp nhận (`GRANT_CO_HOST`)**, **Từ chối (`DENY_CO_HOST`)**, **Thu hồi quyền (`REVOKE_CO_HOST`)**, **Nhường quyền Trưởng bàn (`TRANSFER_HOST`)**, hoặc bật gạt **Hợp tác tự do (`SET_FREE_COLLAB`)** cho phép cả bàn cùng chỉnh sửa.

---

### 3.4. Công cụ Học tập Đồng bộ, Gamification & WebRTC Voice Chat

#### A. Cùng Xem Video (`Synced YouTube Player`)
- Đồng bộ siêu dữ liệu `{ videoId, isPlaying, currentTime, lastUpdatedEpoch }` qua STOMP WebSocket.
- **Chống giật hình (`Drift Tolerance` $\Delta t = 2.0\text{s}$):** Tính thời gian đích thực tế:
  $$T_{\text{current}} = T_{\text{saved}} + \frac{\text{Epoch}_{\text{now}} - \text{Epoch}_{\text{updated}}}{1000}$$
  Chỉ gọi `player.seekTo(T_current)` khi độ lệch $\ge 2.0\text{ giây}$. Bộ đếm thời gian phiên học (`useStudyTimer`) cũng tính theo mốc thời gian hệ thống (`Date.now()`) để không bị trình duyệt làm chậm khi ẩn tab.

#### B. Bảng chiếu Bài tập Tạm thời (`Ephemeral Homework Board` - [ADR-0002](docs/adr/0002-native-canvas-normalized-homework-board.md))
- **Tải ảnh & Dán nhanh (`Ctrl + V`):** Tự động nén ảnh sang định dạng `.webp` ở phía Client trước khi gửi lên `POST /api/v1/tables/{tableId}/homework-image`. Backend kiểm tra kích thước ($\le 5\text{MB}$), giới hạn tối đa **5 trang (`Homework Slide`) mỗi bàn**, và kiểm tra **magic bytes** thực tế (`JPEG`, `PNG`, `WEBP`).
- **Chú thích Thời gian thực & Tọa độ Chuẩn hóa `[0.0, 1.0]`:** Hỗ trợ **Bút viết (`PEN`)**, **Bút dạ quang (`HIGHLIGHTER`)**, **Chèn chữ (`TEXT`)**, **Tẩy từng nét (`ERASER`)**, **Xóa toàn trang (`CLEAR`)** và **Con trỏ giảng bài (`LASER` throttle 10Hz, không lưu vào Redis)**.
- **Tự động Dọn rác (`Auto-Cleanup`):** Toàn bộ file ảnh `.webp` và dữ liệu bảng vẽ trên Redis bị xóa ngay lập tức khi người cuối cùng rời bàn ($0$ người ngồi) hoặc khi chạm TTL tối đa **6 giờ** (`EphemeralCleanupScheduler`).

#### C. Giao tiếp 2 Tầng, Tín hiệu SOS, Thành tích & Đàm thoại WebRTC ([ADR-0005](docs/adr/0005-webrtc-p2p-mesh-over-stomp.md))
- **Trò chuyện 2 tầng & Bong bóng Chat:**
  - *Room Chat (`/app/room/{roomId}/chat`):* Trò chuyện toàn phòng kèm **`Chat Bubble`** hiển thị phía trên đầu nhân vật trên bản đồ 2D trong 4 giây.
  - *Table Chat (`/app/table/{tableId}/chat`):* Kênh thảo luận riêng tư của những người đang ngồi cùng bàn, tự động xóa khi bàn trống.
- **Biển báo Cầu cứu Bài tập (`SOS Banner`):** Trưởng bàn hoặc người đồng điều khiển có thể bật/tắt cờ SOS kèm chủ đề môn học để hiển thị biểu tượng SOS phát sáng ngay trên bàn học ngoài bản đồ 2D.
- **Ghi nhận Giờ học, Bảng xếp hạng & Mở khóa Vật phẩm:**
  - Mọi phiên ngồi học (`Study Session`) có thời lượng **$\ge 1\text{ phút}$** đều được tự động ghi nhận khi rời ghế (phiên $< 1\text{ phút}$ được bỏ qua để chống spam).
  - Người học theo dõi lịch sử học tập cá nhân, **Bảng xếp hạng cộng đồng (`Study Leaderboard`)**, và mở khóa/trang bị các vật phẩm **`SKIN` (Trang phục)**, **`HAT` (Mũ/Tai nghe)**, **`DESK_PET` (Thú cưng để bàn)** theo tổng số phút học tích lũy.
- **Đàm thoại Âm thanh tại Bàn (`WebRTC P2P Mesh`):** Các thành viên ngồi cùng bàn ($\le 6$ người) có thể bật/tắt mic (`Mute/Unmute`) kết nối âm thanh trực tiếp giữa các trình duyệt qua kênh báo hiệu `/app/table/{tableId}/voice.signal`, kèm vòng sáng báo hiệu người đang nói (`voiceAudioAnalyzer`) và tự động ngắt toàn bộ luồng âm thanh ngay khi rời bàn.

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU (MYSQL & REDIS)

### 4.1. Cấu trúc Bảng MySQL 8.0 (Quản lý qua Flyway Migrations `V1..V3`)

```sql
-- 1. Bảng Người dùng (Chỉ lưu Registered Users hoặc Guest đã nâng cấp - ADR-0001)
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    nickname VARCHAR(50) NOT NULL,
    avatar_sprite_id VARCHAR(50) NOT NULL DEFAULT 'default_student',
    equipped_hat_id VARCHAR(50) NOT NULL DEFAULT 'hat_none',
    equipped_desk_pet_id VARCHAR(50) NOT NULL DEFAULT 'pet_sprout_pot',
    auth_provider ENUM('GUEST', 'LOCAL', 'GOOGLE') NOT NULL DEFAULT 'GUEST',
    total_study_minutes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_leaderboard
    ON users (auth_provider, total_study_minutes DESC, created_at ASC, id ASC);

-- 2. Bảng Lịch sử Phiên học (Chỉ ghi nhận các phiên có duration_minutes >= 1)
CREATE TABLE study_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    room_id VARCHAR(50) NOT NULL,
    table_id VARCHAR(50) NOT NULL,
    study_goal VARCHAR(120),
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    duration_minutes INT NOT NULL,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Bảng Danh mục Trang phục / Vật phẩm mở khóa theo số phút học
CREATE TABLE character_items (
    id VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    item_type ENUM('SKIN', 'HAT', 'DESK_PET') NOT NULL,
    required_study_minutes INT NOT NULL DEFAULT 0
);
```

### 4.2. Cấu trúc Dữ liệu trên Redis 7.x (In-Memory Realtime State)

| Redis Key Pattern | Kiểu dữ liệu | Nội dung lưu trữ & Cơ chế Vòng đời / TTL |
| :--- | :--- | :--- |
| `rooms:shards` | `SET` | Danh sách mã các `Room Shard` đang hoạt động (VD: `main-library`, `main-library-2`). |
| `room:{roomId}:players` | `HASH` | Map `userId` $\rightarrow$ JSON `RoomPlayerState` (vị trí, hướng nhìn, trạng thái ngồi, mục tiêu học, trang phục đang mặc). |
| `room:{roomId}:seats` | `HASH` | Map `seatId` $\rightarrow$ `userId`. Khóa nguyên tử qua Lua script `atomic_seat_sit.lua`. |
| `room:{roomId}:disconnects` | `HASH` | Map `userId` $\rightarrow$ `disconnectedAtEpoch` phục vụ cơ chế giữ ghế 30 giây (`Grace Period`). |
| `room:{roomId}:seq` | `STRING` | Bộ đếm thứ tự sự kiện (`eventSeq`) tăng dần của từng phòng. |
| `room:{roomId}:chat` | `LIST` | Lưu bộ đệm các tin nhắn `Room Chat` gần nhất của phòng. |
| `table:{roomId}:{tableId}:state` | `STRING (JSON)` | Lưu `RedisTableState` phân vùng theo cả phòng và bàn ([ADR-0006](docs/adr/0006-room-scoped-table-redis-keys.md)): `hostUserId`, `coHostUserIds`, `isFreeCollab`, `sosBanner`, `videoState`, `homeworkSlides`, `activeSlideId`. Tự động `DEL` khi bàn về $0$ người ngồi. |
| `table:{roomId}:{tableId}:chat` | `LIST` | Bộ đệm tin nhắn trò chuyện nội bộ của bàn; tự động `DEL` khi bàn về $0$ người ngồi. |
| `ephemeral:img:{imageId}` | `STRING (JSON)` | Lưu metadata đường dẫn file ảnh bài tập tạm kèm TTL `21600s` ($6\text{ giờ}$). |
| `guest:{guestId}:sessions` | `LIST` | Lưu danh sách các `Study Session` ($\ge 1$ phút) của Guest kèm TTL $7\text{ ngày}$, tự động chuyển vào MySQL khi nâng cấp tài khoản. |
| `guest:{guestId}:customization` | `STRING (JSON)` | Lưu cấu hình trang phục (`SKIN`, `HAT`, `DESK_PET`) của Guest kèm TTL $7\text{ ngày}$. |

---

## 5. ĐẶC TẢ GIAO THỨC WEBSOCKET & REST API

### 5.1. Danh sách Kênh WebSocket (STOMP Endpoints — Kết nối tại `/ws`)

#### Luồng Cả Phòng (`Room Scope`):
- **Client gửi lên:**
  - `/app/room/{roomId}/join`: Đăng ký phiên STOMP vào phòng sau khi gọi REST join/snapshot.
  - `/app/room/{roomId}/move`: Gửi cập nhật vị trí và hướng di chuyển (throttle tối đa $10\text{ gói/giây}$).
  - `/app/room/{roomId}/seat.sit`: Yêu cầu chiếm ghế nguyên tử (`{ tableId, seatId }`).
  - `/app/room/{roomId}/seat.leave`: Chủ động đứng dậy rời khỏi bàn học.
  - `/app/room/{roomId}/chat`: Gửi tin nhắn trò chuyện phòng (hiển thị kèm `Chat Bubble` 4 giây trên đầu nhân vật).
- **Client lắng nghe (Subscribe):**
  - `/topic/room/{roomId}/events`: Nhận mọi sự kiện cấp phòng (vào/rời phòng, di chuyển, ngồi/đứng dậy, đổi Trưởng bàn, bật/tắt SOS, tin nhắn phòng, hoán đổi định danh khi nâng cấp tài khoản).

#### Luồng Riêng Từng Bàn (`Table Scope` — Chỉ cho phép khi `state === SEATED` tại bàn đó):
- **Client gửi lên:**
  - `/app/table/{tableId}/permission.request`: Thành viên xin quyền điều khiển từ Trưởng bàn.
  - `/app/table/{tableId}/permission.respond`: Trưởng bàn xử lý phân quyền (`GRANT_CO_HOST`, `DENY_CO_HOST`, `REVOKE_CO_HOST`, `TRANSFER_HOST`, `SET_FREE_COLLAB`).
  - `/app/table/{tableId}/video.sync`: Đồng bộ trạng thái YouTube (`PLAY`, `PAUSE`, `SEEK`, `CHANGE_VIDEO`).
  - `/app/table/{tableId}/sos.toggle`: Bật hoặc tắt biển báo cầu cứu bài tập (`SOS Banner`).
  - `/app/table/{tableId}/chat`: Gửi tin nhắn trò chuyện nội bộ trong bàn.
  - `/app/table/{tableId}/board.slide`: Chuyển trang bài tập đang mở (`SELECT_SLIDE`) hoặc xóa trang bài tập (`DELETE_SLIDE`).
  - `/app/table/{tableId}/board.draw`: Vẽ nét mới (`ADD_STROKE`), tẩy nét vẽ (`ERASE_STROKE`), xóa sạch bảng (`CLEAR_SLIDE`) hoặc phát tín hiệu con trỏ (`LASER`).
  - `/app/table/{tableId}/voice.signal`: Trao đổi tín hiệu WebRTC P2P (`JOIN`, `LEAVE`, `OFFER`, `ANSWER`, `ICE_CANDIDATE`, `MUTE_STATE`).
- **Client lắng nghe (Subscribe):**
  - `/topic/table/{tableId}/workspace`: Nhận toàn bộ sự kiện đồng bộ của bàn học.
  - `/user/queue/errors`: Nhận thông báo lỗi nghiệp vụ/phân quyền có cấu trúc riêng cho từng người dùng.

### 5.2. Danh sách REST API Chính
- **Xác thực (`Auth`):**
  - `POST /api/v1/auth/guest`: Khởi tạo phiên Guest và cấp JWT `guestToken` 7 ngày.
  - `POST /api/v1/auth/login`: Đăng nhập vào tài khoản `Registered User` (Email/Password hoặc Google `idToken`).
  - `POST /api/v1/auth/upgrade`: Nâng cấp phiên Guest hiện tại lên `Registered User`, gộp giờ học và hoán đổi định danh trực tiếp trên Redis.
  - `GET /api/v1/auth/me`: Lấy thông tin định danh và thống kê phiên hiện tại từ Bearer JWT.
- **Phòng & Bàn học (`Room & Table`):**
  - `POST /api/v1/rooms/join`: Chọn phân mảnh phòng khả dụng (`main-library`, `main-library-2`, ...) và đăng ký hiện diện.
  - `GET /api/v1/rooms/{roomId}/state`: Lấy toàn bộ `Room Snapshot` (danh sách người chơi, ghế đã có chủ, tóm tắt các bàn, tin nhắn phòng gần nhất).
  - `GET /api/v1/rooms/{roomId}/tables/{tableId}/state`: Lấy `TableWorkspaceSnapshot` khi vừa ngồi vào bàn.
- **Bảng bài tập tạm thời (`Ephemeral Homework`):**
  - `POST /api/v1/tables/{tableId}/homework-image`: Tải lên ảnh bài tập (`multipart/form-data`, kiểm tra quyền `HOST`/`CO_HOST` và magic bytes).
  - `GET /api/v1/ephemeral-files/{fileName}`: Tải file ảnh bài tập tạm thời đang hoạt động.
- **Thống kê, Bảng xếp hạng & Trang phục (`Stats & Gamification`):**
  - `GET /api/v1/stats/me`: Xem tổng số phút tích lũy và lịch sử các `Study Session` của bản thân.
  - `GET /api/v1/stats/leaderboard?limit=20`: Xem bảng xếp hạng học tập cộng đồng.
  - `GET /api/v1/items`: Lấy danh mục toàn bộ vật phẩm (`SKIN`, `HAT`, `DESK_PET`), trạng thái mở khóa và trang bị hiện tại.
  - `PATCH /api/v1/users/me/customization`: Thay đổi trang phục, mũ hoặc thú cưng để bàn đang trang bị.
- **Kiểm tra sức khỏe hệ thống (`Health`):**
  - `GET /api/v1/health`: Kiểm tra trạng thái kết nối thực tế tới MySQL và Redis.

---

## 6. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
LearningWithMe/
├── docker-compose.yml                  # Khởi chạy MySQL 8.0, Redis 7, Backend, Frontend
├── .env.example                        # Mẫu cấu hình biến môi trường
├── AGENTS.md                           # Quy chuẩn kiến trúc & giới hạn dòng cho AI Agent
├── GLOSSARY.md                         # Từ điển miền nghiệp vụ thống nhất (Ubiquitous Language)
├── docs/
│   ├── SPEC.md                         # Đặc tả kỹ thuật tổng thể 6 Phases (47 User Stories)
│   └── adr/                            # Architecture Decision Records (ADR-0001 .. ADR-0006)
├── shared/
│   └── maps/
│       └── main-library.json           # Bản đồ Tiled JSON dùng chung cho Phaser 3 & Backend
├── backend/                            # Spring Boot 3.4 (Java 21, Maven)
│   ├── src/main/java/com/studytogether/
│   │   ├── config/                     # SecurityConfig, AppProperties, GlobalExceptionHandler, HealthController
│   │   └── modules/
│   │       ├── auth/                   # GuestAuth, AuthLogin, AccountUpgrade, RedisIdentitySwap
│   │       ├── room/                   # RoomPresence, Movement, SeatService, Watchdog, RoomChat, StompConfig
│   │       ├── table/                  # TableWorkspace, Video, Sos, Homework, Board, Voice, CleanupScheduler
│   │       └── stats/                  # StudySession, GuestSessionStaging, Leaderboard, CharacterCustomization
│   ├── src/main/resources/
│   │   ├── db/migration/               # Flyway SQL migrations (V1..V3)
│   │   └── redis/                      # Lua scripts (atomic_seat_sit.lua, swap_identity.lua)
│   ├── src/test/java/                  # Unit Tests & Testcontainers Integration Tests
│   └── Dockerfile
└── frontend/                           # React 18 + Vite 6 + TypeScript + TailwindCSS v4
    ├── src/
    │   ├── game/                       # Logic Phaser 3 tách biệt hoàn toàn khỏi DOM
    │   │   ├── controllers/            # InputController, keyboardMapping
    │   │   ├── entities/               # PlayerSprite, RemotePlayersRenderer, ChatBubble, TableSosOverlay, Accessories
    │   │   ├── managers/               # SeatInteractionManager
    │   │   ├── pathfinding/            # GridPathfinder (EasyStar.js A*)
    │   │   ├── scenes/                 # ClassroomScene, classroomMapRenderer
    │   │   └── topology/               # roomTopology, tiledMapParser
    │   ├── components/
    │   │   ├── auth/                   # GuestOnboardingModal, AccountUpgradeModal, RegisteredLoginPanel
    │   │   ├── game/                   # ClassroomCanvas
    │   │   ├── hud/                    # TopBar, RoomChatBox, StudyLeaderboardModal, StudySessionsModal, CharacterCustomizerModal
    │   │   └── table/                  # TableWorkspaceShell, SyncedYouTubePlayer, HomeworkAnnotationCanvas, VoiceChatBar...
    │   ├── stores/                     # Zustand (useAuthStore, useGameStore, useTableStore, useVoiceStore)
    │   ├── hooks/                      # useAppBootstrap, useRoomSync, useTableWorkspaceSync, useStudyTimer, useTableVoiceChat...
    │   ├── services/                   # REST API clients, STOMP clients, WebRTC Mesh Manager, Audio Analyzer
    │   ├── utils/                      # homeworkCanvasMath, homeworkImageCompression, youtubeSync
    │   └── __tests__/                  # Bộ kiểm thử Vitest & React Testing Library (Phases 1 - 6)
    └── Dockerfile
```

---

## 7. HƯỚNG DẪN KHỞI CHẠY & KIỂM THỬ (GETTING STARTED)

### 7.1. Chạy toàn bộ hệ thống bằng Docker Compose (Khuyến nghị)
```bash
# 1. Tạo file .env từ mẫu cấu hình
cp .env.example .env

# 2. Build và khởi chạy MySQL, Redis, Backend (8080) và Frontend (5173)
docker compose up --build
```
- **Giao diện Web (Frontend):** `http://localhost:5173`
- **Backend API & Health Check:** `http://localhost:8080/api/v1/health`

**Profile `prod` & Kiểm tra Redis AOF Persistence:**
- Khi chạy thực tế (`SPRING_PROFILES_ACTIVE=prod`), Backend yêu cầu đủ biến môi trường bí mật trong `.env` (không fallback về giá trị dev), tin cậy `X-Forwarded-For` từ reverse proxy (`server.forward-headers-strategy: framework`), chỉ mở `/actuator/health`, ẩn stack trace khỏi `ProblemDetail`, xuất log dạng JSON (`logstash`), và giới hạn `10 requests/phút` theo IP cho `/api/v1/auth/{guest,login,upgrade}`.
- Service `redis` trong `docker-compose.yml` chạy với `--appendonly yes --appendfsync everysec` gắn volume `redis_data:/data`. Kiểm chứng thủ công: ghi phiên học tạm của Guest (`RPUSH guest:<id>:sessions ...`), chạy `docker compose restart redis` và xác nhận `LRANGE guest:<id>:sessions 0 -1` giữ nguyên dữ liệu sau khi container khởi động lại.

### 7.2. Chạy môi trường Phát triển & Kiểm thử (Local Dev & Tests)

**Frontend (`frontend/`):**
```bash
cd frontend
npm install
npm run dev         # Chạy Vite dev server tại http://localhost:5173
npm run lint        # Kiểm tra ESLint
npm run typecheck   # Kiểm tra kiểu TypeScript
npm test            # Chạy toàn bộ unit & integration tests với Vitest
```

**Backend (`backend/`):**
```bash
cd backend
./mvnw spring-boot:run   # Chạy Backend (yêu cầu MySQL 8.0 & Redis 7 đang chạy)
./mvnw test              # Chạy toàn bộ Unit Test & Testcontainers Integration Test
./mvnw verify            # Chạy Testcontainers + cổng kiểm tra độ phủ JaCoCo (>= 70% trên modules/**)
```

**Kiểm tra giới hạn số dòng theo `AGENTS.md` (từ thư mục gốc):**
```bash
node scripts/check-file-limits.mjs             # Kiểm tra toàn bộ file nguồn; thoát khác 0 nếu vượt ngưỡng
node --test scripts/check-file-limits.test.mjs # Chạy unit test cho script kiểm tra
```
Ngưỡng áp dụng: `.tsx` $\le 200$, Phaser (`src/game/**/*.ts`) $\le 250$, Zustand stores (`src/stores/*.ts`) $\le 150$, TS khác $\le 250$, Java Controller/Handler $\le 150$, Java DTO/Record/Entity $\le 120$, Java Service/khác $\le 250$. (CI trong `.github/workflows/ci.yml` chạy song song 3 job: `file-limits`, `backend`, `frontend` trên mỗi PR vào `main`.)

### 7.3. Triển khai Production (Vercel Frontend + Oracle ARM VM + Caddy + CD)

Kiến trúc triển khai 0 đồng ([ADR-0007](docs/adr/0007-free-tier-oracle-vercel-topology.md)):
- **Frontend (Vercel Hobby):** Deploy qua Git integration (Root Directory: `frontend`, cấu hình [frontend/vercel.json](frontend/vercel.json)) với biến build-time `VITE_API_BASE_URL` và `VITE_WS_BASE_URL` (không chứa `localhost` trong bản production).
- **Backend + DB + TLS Proxy (Oracle Always Free ARM VM):** Chạy qua [docker-compose.prod.yml](docker-compose.prod.yml) và [deploy/Caddyfile](deploy/Caddyfile) (`mysql`, `redis` AOF, `backend` profile `prod`, `caddy` tự động cấp TLS cho subdomain DuckDNS).
- **CD tự động:** Merge vào `main` kích hoạt [.github/workflows/cd.yml](.github/workflows/cd.yml) để build Docker image đa kiến trúc (`linux/arm64,linux/amd64`), đẩy lên GHCR và SSH vào VM chạy `docker compose -f docker-compose.prod.yml pull && up -d`.
- **Wizard cấp phát hạ tầng:** Chạy script tương tác [scripts/setup-prod-infra.sh](scripts/setup-prod-infra.sh) (hỗ trợ WSL/Git Bash/macOS/Linux) để đi từng bước qua Oracle Cloud VM, DuckDNS, Vercel env, tạo `.env.prod.local` quyền `0600` và nạp GitHub Secrets (`VM_HOST`, `VM_USER`, `VM_SSH_KEY`):
  ```bash
  ./scripts/setup-prod-infra.sh
  ```

---

## 8. TRẠNG THÁI TRIỂN KHAI (6 PHASES COMPLETED)

- [x] **Phase 1 — Foundation, Docker Infra & Hybrid Auth:** Docker Compose, Flyway migrations, Guest onboarding không rác DB, nâng cấp tài khoản không gián đoạn và hoán đổi định danh nguyên tử trên Redis.
- [x] **Phase 2 — 2D Classroom Engine & Character State Machine:** Bản đồ Tiled JSON dùng chung, tìm đường $A^*$ (`EasyStar.js`), máy trạng thái `FREE_ROAM` $\leftrightarrow$ `WALKING_TO_SEAT` $\leftrightarrow$ `SEATED`, ưu tiên bàn phím tức thời và khóa di chuyển khi ngồi.
- [x] **Phase 3 — Realtime Room Sync, Atomic Seat Lock & Grace Period:** Tự động phân mảnh phòng (50 người/phòng), đồng bộ di chuyển 10Hz + nội suy 60 FPS, khóa ghế nguyên tử bằng Lua script, giữ ghế 30 giây khi rớt mạng, tự động kế nhiệm Trưởng bàn và `Room Chat` kèm `Chat Bubble` 4 giây.
- [x] **Phase 4 — Table Workspace: Host Permissions, Synced YouTube & SOS:** Phân quyền `TABLE_HOST` / `CO_HOST` / `MEMBER` và `Free Collaboration`, đồng bộ YouTube chống giật ($\Delta t = 2.0\text{s}$), bộ đếm giờ học theo `Epoch`, `Table Chat` và biển báo `SOS Banner`.
- [x] **Phase 5 — Ephemeral Homework Whiteboard & Auto-Cleanup:** Tải/dán ảnh bài tập `Ctrl + V` nén `.webp`, kiểm tra magic bytes, tối đa 5 slides/bàn, vẽ chú thích chuẩn hóa tọa độ `[0.0, 1.0]`, con trỏ `Laser Pointer` 10Hz và tự động xóa sạch khi bàn trống hoặc sau 6 giờ.
- [x] **Phase 6 — Study Sessions Persistence, Gamification & WebRTC Voice:** Lưu phiên học $\ge 1\text{ phút}$, bảng xếp hạng học tập, mở khóa & trang bị `SKIN` / `HAT` / `DESK_PET`, và đàm thoại âm thanh `WebRTC P2P Mesh` tại bàn học.
