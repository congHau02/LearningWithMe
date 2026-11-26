# TÀI LIỆU ĐẶC TẢ SẢN PHẨM & KỸ THUẬT (PRD & TECHNICAL SPECIFICATION)

- **Tên dự án:** Cùng Nhau Học Bài (Study Together 2D Web Game)
- **Slogan:** *"Cùng nhau học bài - Không còn cô đơn trên hành trình chinh phục tri thức"*
- **Phiên bản tài liệu:** 2.5.0 (Đồng bộ thực tế triển khai Phase 1 – Phase 12 & Giao diện Botanical Night Studio `#57`)
- **Kiến trúc cốt lõi:** Hybrid 2D Canvas (Phaser 3) + Reactive HUD (ReactJS 18 + TailwindCSS v4 — Chủ đề **Botanical Night Studio**) + Stateful Realtime Backend (Spring Boot 3.4, STOMP WebSocket, Redis 7, MySQL 8.0)
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

### 1.3. Ngôn ngữ Thiết kế Giao diện: Botanical Night Studio ("Rừng Đêm & Tập trung Sâu" — Ticket `#57` & [ADR-0010](docs/adr/0010-botanical-night-studio-token-seam.md))
Toàn bộ lớp giao diện React HUD, các hộp thoại Modal, **Table Workspace** và ánh sáng không gian 2D **Study Café** trong Phaser 3 tuân thủ thống nhất hệ quy chuẩn thẩm mỹ **Botanical Night Studio ("Rừng Đêm & Tập trung Sâu")** qua một **Semantic Token Seam** duy nhất (`@theme` trong `frontend/src/index.css` và `BOTANICAL_2D_SCENE` trong `frontend/src/game/botanicalPalette.ts`):

1. **Bảng màu Chuẩn hóa (Semantic Color Palette & Contrast Rules):**
   - **Deep Pine Night (`#0F1714` / `--color-botanical-pine`):** Nền chính của ứng dụng và bao cảnh 2D Canvas (`BOTANICAL_2D_SCENE.canvasBackground`), kết hợp quầng sáng hữu cơ dịu nhẹ (`radial-gradient` emerald `7%` và warm amber `5%`) giúp mắt không bị mỏi trong các phiên học đêm kéo dài.
   - **Slate Leaf (`#16221E` / `--color-botanical-leaf`):** Bề mặt thẻ, thanh công cụ, khung **Table Workspace**, ô cửa sổ quán, nền **Chat Bubble** và **SOS Banner**.
   - **Luminous Hairline Border (`#243630` / `--color-botanical-border`):** Đường viền mảnh `1px` phân tách bề mặt thẻ, khung kính và đường lưới đồ thị.
   - **Morning Mist (`#E6ECE8` / `--color-botanical-mist`) & Muted Sage (`#8FA399` / `--color-botanical-sage`):** Chữ tiêu đề/nội dung chính độ tương phản cao (`#E6ECE8`) và nhãn phụ/siêu dữ liệu (`#8FA399`).
   - **Warm Amber (`#E5A93C` / `--color-botanical-amber`) + Deep Forest Ink (`#0F1714` / `--color-botanical-amber-ink`):** Màu nhấn cho nút hành động chính (`.botanical-cta`), tab đang chọn, huy hiệu **Table Host**, ánh đèn bàn học và quầy pha chế 2D. **Quy tắc tương phản bắt buộc:** Mọi nút CTA đặc và huy hiệu nền `#E5A93C` bắt buộc dùng chữ/biểu tượng màu mực tối `#0F1714` để đạt tỷ lệ tương phản **`8.74:1` (WCAG AAA)**; tuyệt đối không dùng chữ trắng trên nền `#E5A93C` (`~1.96:1`).
   - **Bioluminescent Emerald (`#34D399` / `--color-botanical-emerald`):** Vòng focus bàn phím (`:focus-visible`), chỉ báo đang phát giọng nói WebRTC, chỉ số **Study Streak**, ô ghế trống và đường dẫn tìm đường $A^*$ trên bản đồ 2D.
2. **Kiến trúc Bề mặt 2 Tầng (Double-Bezel & Static Glassmorphism Guardrails):**
   - **Double-Bezel (`.botanical-bezel-outer` + `.botanical-bezel-inner`):** Áp dụng cấu trúc vỏ ngoài (`#121c18` + viền `#243630`) lồng lõi trong (`#16221E` + bóng đổ sâu) và nút CTA dạng *Button-in-Button* cho các khung tiêu điểm (Onboarding/Upgrade Modal, khung Viewport phòng học 2D, bảng Thống kê/Tùy biến nhân vật/Menu đồ uống, khung **Room Chat** nổi).
   - **Static Glassmorphism (`.botanical-glass`):** Hiệu ứng kính mờ (`rgba(22, 34, 30, 0.85)` + `backdrop-filter: blur(12px)`) chỉ được phép đặt trên lớp vỏ cố định/nổi (`TopBar`, header thanh công cụ, popover); **không bao giờ** đặt `backdrop-blur` lên vùng danh sách cuộn (tin nhắn chat, bảng xếp hạng) để giữ tốc độ dựng hình $60\text{ FPS}$.
   - **Chuyển động & Tiếp cận (`Motion & Accessibility`):** Toàn bộ chuyển tiếp dùng đường cong `--ease-botanical: cubic-bezier(0.32, 0.72, 0, 1)`, tự động tắt khi trình duyệt bật `prefers-reduced-motion: reduce`, đảm bảo `CLS = 0` khi bật/tắt mic hoặc đổi trạng thái và kích thước vùng chạm $\ge 44 \times 44\text{px}$ trên di động.
3. **Typography, Bộ Icon SVG `1.5px` & Cấm Lớp Màu Thô (`No Raw Chrome Classes`):**
   - Sử dụng font hiển thị tiếng Việt sắc nét **`Plus Jakarta Sans`** (`--font-sans`) cho toàn bộ giao diện và **`JetBrains Mono`** (`--font-mono`) cho đồng hồ đếm giờ, tọa độ, biểu thức toán học và thông số kỹ thuật.
   - Thay thế toàn bộ emoji trang trí trên nút bấm/thanh công cụ bằng **Studio Icon Kit** (inline SVG nét mảnh `1.5px` đồng nhất, gắn `aria-hidden="true"` kèm nhãn trợ năng); chỉ giữ lại emoji cho nội dung xã hội (thả cảm xúc nhanh trong **Room Chat** và minh họa món nước trong menu **Drink Delivery**).
   - **Cấm tuyệt đối** việc sử dụng các lớp màu Tailwind thô (`slate-*`, `sky-*`) trong UI chrome; chỉ các màu mang ngữ nghĩa nghiệp vụ (bảng màu mực vẽ bài tập trên **Homework Slide**, màu trang phục nhân vật, biểu tượng thương hiệu Google và cảnh báo lỗi/xóa) mới được giữ riêng.

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
4. **Luồng Xin quyền, Hợp tác Tự do (`Free Collaboration`) & Khóa Bàn Học / Link Mời Bàn ([ADR-0014](docs/adr/0014-secondary-math-strokes-table-lock-and-client-study-pack.md)):**
   - `MEMBER` có thể gửi yêu cầu xin quyền điều khiển (`permission.request`). `TABLE_HOST` nhận thông báo nổi (`HostPermissionToast`) để **Chấp nhận (`GRANT_CO_HOST`)**, **Từ chối (`DENY_CO_HOST`)**, **Thu hồi quyền (`REVOKE_CO_HOST`)**, **Nhường quyền Trưởng bàn (`TRANSFER_HOST`)**, bật gạt **Hợp tác tự do (`SET_FREE_COLLAB`)** hoặc bật/tắt **Khóa bàn riêng tư (`TOGGLE_TABLE_LOCK`)**.
   - **Khóa bàn nguyên tử (`Table Lock`) & Liên kết mời vào bàn (`Table Invite Link`):** Khi bật `isTableLocked`, hệ thống sinh `inviteCode` tạm thời lưu trong `RedisTableState` (ẩn hoàn toàn khỏi `RoomSnapshotResponse` và `/topic/room/{roomId}/events` để chống rò rỉ; chỉ người đang `SEATED` đọc được để sao chép link `?room={roomId}&table={tableId}&code={inviteCode}`). Người được mời qua link sẽ ưu tiên vào đúng `Room Shard` qua `POST /api/v1/rooms/join` và tự động dẫn tới ghế trống bằng $A^*$ kèm `inviteCode` trong `seat.sit`; người đi tự do ngoài phòng không thể ngồi vào bàn đang khóa. Khóa bàn được bảo toàn qua **Grace Period** 30 giây và tự hủy khi bàn trống.

---

### 3.4. Công cụ Học tập Đồng bộ, Gamification & WebRTC Voice Chat

#### A. Cùng Xem Video Khóa Đồng Bộ Toàn Bàn (`Synced YouTube Player` - [ADR-0011](docs/adr/0011-authoritative-youtube-iframe-shield-and-heartbeat.md))
- Đồng bộ siêu dữ liệu `{ videoId, isPlaying, currentTime, lastUpdatedEpoch }` qua STOMP WebSocket.
- **Chống giật hình (`Drift Tolerance` $\Delta t = 2.0\text{s}$) & Chu kỳ Heartbeat `3 giây`:** Tính thời gian đích thực tế:
  $$T_{\text{current}} = T_{\text{saved}} + \frac{\text{Epoch}_{\text{now}} - \text{Epoch}_{\text{updated}}}{1000}$$
  Chỉ gọi `player.seekTo(T_current)` khi độ lệch $\ge 2.0\text{ giây}$. Lắng nghe `onStateChange` kết hợp vòng lặp Heartbeat mỗi `3 giây` để tự động kéo mọi thành viên về đúng trạng thái `isPlaying` và mốc thời gian của bàn; nếu trình duyệt chặn Autoplay có tiếng khi mới vào bàn, tự động chuyển sang `Muted Autoplay` kèm nút nổi 1 chạm bật tiếng (màu Warm Amber `#E5A93C` mực `#0F1714`).
- **Lớp chắn Tương tác (`Iframe Click Shield`) & Thanh Tua Thời gian Trực quan:** Phủ lớp chắn DOM trên mặt `<iframe>` YouTube để ngăn `MEMBER` vô tình bấm dừng video cục bộ (chỉ giữ điều khiển âm lượng/tắt tiếng riêng), trong khi click của `TABLE_HOST` / `CO_HOST` hoặc thao tác kéo thanh tua thời gian (`mm:ss / mm:ss`) phát lệnh `video.sync` ngay lập tức cho cả bàn. Bộ đếm thời gian phiên học (`useStudyTimer`) tính theo `Date.now()` để không bị trình duyệt làm chậm khi ẩn tab.

#### B. Bảng chiếu Bài tập Tạm thời & Bộ Công cụ Giải Toán (`Ephemeral Homework Board & Math Suite` - [ADR-0002](docs/adr/0002-native-canvas-normalized-homework-board.md), [ADR-0012](docs/adr/0012-ephemeral-math-workspace-and-multilayer-procedural-audio.md), [ADR-0014](docs/adr/0014-secondary-math-strokes-table-lock-and-client-study-pack.md))
- **Tải ảnh, Cắt/Xoay trước khi đăng, Dán nhanh (`Ctrl + V`) & Trang nháp Toán dựng sẵn:** Hỗ trợ xoay $90^\circ$ và cắt khung ảnh đề bài (`HomeworkCropRotateModal`) trước khi nén sang `.webp` để gửi lên `POST /api/v1/tables/{tableId}/homework-image`, cùng các mẫu mặt phẳng nháp `1280x720` (**Lưới ô vuông**, **Hệ trục tọa độ $Oxy$**, **Trục số `NUMBER_LINE`**, **Bảng trơn**). Backend kiểm tra kích thước ($\le 5\text{MB}$), giới hạn tối đa **5 trang (`Homework Slide`) mỗi bàn**, và kiểm tra **magic bytes** thực tế (`JPEG`, `PNG`, `WEBP`).
- **Chú thích Hình học Phẳng THCS, Công thức $\LaTeX$, Zoom/Pan Cục bộ & Hoàn tác theo Người vẽ (`Per-Author Undo/Redo`):** Hỗ trợ tọa độ chuẩn hóa `[0.0, 1.0]` với **Phóng to / Kéo khung nhìn cá nhân (`1×..3×` Zoom & Pan)** chuyển đổi ngược tọa độ chính xác cho **Bút viết (`PEN`)**, **Bút dạ quang (`HIGHLIGHTER`)**, **Đoạn thẳng (`LINE`)**, **Nét đứt đường phụ (`DASHED_LINE`)**, **Mũi tên vector (`ARROW`)**, **Hình chữ nhật (`RECT`)**, **Đường tròn tâm–bán kính có chấm tâm (`CIRCLE_CENTER`)**, **Đường tròn khung (`CIRCLE`)**, **Tam giác (`TRIANGLE`)**, **Ký hiệu góc/đoạn bằng nhau (`GEO_MARK`)**, **Nhãn đỉnh tự tăng $A, B, C\dots$ (`VERTEX_LABEL`)**, **Chèn chữ (`TEXT`)**, **Công thức toán (`LATEX` qua KaTeX)**, bắt điểm đầu mút & khóa góc $15^\circ / 45^\circ / 90^\circ$, **Tẩy từng nét (`ERASER`)**, **Hoàn tác / Làm lại theo `authorUserId`**, **Xóa toàn trang xác nhận 2 bước (`CLEAR`)** và **Con trỏ giảng bài (`LASER` throttle 10Hz, không lưu vào Redis)**.
- **Chế độ Cấp học (`Curriculum Mode`: `THCS` mặc định Lớp 6–9 & `THPT / Đại học`), Sổ nháp Bước giải (`Math Scratchpad`) & Bộ Vẽ Đồ thị / Máy tính Chính xác:**
  - *`Curriculum Mode` (`THCS` $\leftrightarrow$ `THPT`):* Tự động điều chỉnh thanh ký hiệu nhanh ($\triangle, \widehat{ABC}, \perp, \parallel, \sim, \cong, ^\circ, \begin{cases}\dots\end{cases}, \vdots$), preset đồ thị bậc nhất/bậc hai ($y = ax + b$, $y = ax^2$) và bộ giải Toán THCS & Số học (rút gọn phân số $\frac{a}{b}$, rút gọn căn thức $a\sqrt{b}$, phân tích thừa số nguyên tố, `ƯCLN` / `BCNN`, giải hệ bậc nhất $2\times 2$ nghiệm phân số chính xác), đồng thời vẫn mở rộng sang đạo hàm, tích phân $\int_a^b f(x)dx$ và hệ $3\times 3$ ở chế độ `THPT / Đại học`.
  - *`Math Scratchpad` & `Function Grapher`:* Soạn thảo các bước biến đổi đại số Markdown + $\LaTeX$ đồng bộ thời gian thực cho cả bàn; vẽ tối đa 3 hàm số $y = f(x), g(x), h(x)$ trên hệ trục $Oxy$ chuẩn **Botanical Night Studio**, tự động chấm nghiệm, cực trị, giao điểm và **Xuất sang Trang bài tập (`Homework Slide`)**.
- **Xuất Vở bài giảng Thuần Client-Side (`Study Pack` PNG / PDF Nhiều trang) & Tự động Dọn rác (`Auto-Cleanup`):** Mọi thành viên đang `SEATED` có thể tải trang hiện tại ra `.png` hoặc xuất toàn bộ các **Homework Slide** (kèm mọi **Stroke** & công thức $\LaTeX$) và các bước **Math Scratchpad** thành `.pdf` ngay trên trình duyệt (`0 KB` máy chủ); hộp thoại rời bàn nhắc lưu **Study Pack** khi bàn còn bài học. Toàn bộ file ảnh `.webp` và dữ liệu bảng vẽ trên Redis vẫn bị xóa ngay lập tức khi người cuối cùng rời bàn ($0$ người ngồi) hoặc sau **6 giờ**.

#### C. Giao tiếp 2 Tầng (Hỗ trợ $\LaTeX$), Tín hiệu SOS, Âm thanh Đa tầng & Đàm thoại WebRTC ([ADR-0005](docs/adr/0005-webrtc-p2p-mesh-over-stomp.md), [ADR-0012](docs/adr/0012-ephemeral-math-workspace-and-multilayer-procedural-audio.md))
- **Trò chuyện 2 tầng hỗ trợ công thức $\LaTeX$ (`$...$`, `$$...$$`) & Bong bóng Chat:**
  - *Room Chat (`/app/room/{roomId}/chat`):* Trò chuyện toàn phòng kèm **`Chat Bubble`** hiển thị phía trên đầu nhân vật trên bản đồ 2D trong 4 giây.
  - *Table Chat (`/app/table/{tableId}/chat`):* Kênh thảo luận riêng tư của những người đang ngồi cùng bàn (hiển thị trực tiếp công thức toán KaTeX), tự động xóa khi bàn trống.
- **Biển báo Cầu cứu (`SOS Banner`):**
  - Trưởng bàn hoặc người đồng điều khiển có thể bật/tắt cờ SOS kèm chủ đề môn học để hiển thị biểu tượng SOS phát sáng ngay trên bàn học ngoài bản đồ 2D.
- **Âm thanh Nền Đa tầng (`Ambient Soundscape` 5 kênh) & Âm thanh Phản hồi (`Study SFX`):** Bộ tổng hợp Web Audio `0-KB` đa tầng gồm **Tiếng mưa** (mưa rơi + hạt mưa lộp độp + sấm xa + hiệu ứng mưa ngoài cửa sổ 2D), **Quán nước** (âm nền + tiếng tách sứ), **Lò sưởi** (lửa ấm + củi nổ lách tách), **Tiếng ồn trắng/hồng êm dịu**, và **Giai điệu Lofi Electric Piano $65\text{ BPM}$**, kết hợp kênh **`Study SFX`** bật/tắt độc lập cho hoàn thành `Study Goal`, ngồi ghế và nhận `Drink Delivery`.
- **Chế độ rõ ràng (`Clear View`):** Chế độ hiển thị cá nhân của **Table Workspace** chỉ gồm Bảng giải bài (chụp/tải ảnh kèm cắt xoay, chuyển trang, Zoom/Pan cục bộ, thanh công cụ Bút · Hoàn tác · 3 màu mực · Tẩy · Laser · Xóa trang xác nhận 2 bước) và Table Chat (có nút mở gọn thanh ký hiệu toán); ẩn video YouTube, chức năng SOS cầu cứu, danh sách thành viên và công cụ phụ. Mặc định bật trên điện thoại, bật/tắt từ header và ghi nhớ trên thiết bị.
- **Ghi nhận Giờ học, Bảng xếp hạng & Mở khóa Vật phẩm:**
  - Mọi phiên ngồi học (`Study Session`) có thời lượng **$\ge 1\text{ phút}$** đều được tự động ghi nhận khi rời ghế (phiên $< 1\text{ phút}$ được bỏ qua để chống spam).
  - Người học theo dõi lịch sử học tập cá nhân, **Bảng xếp hạng cộng đồng (`Study Leaderboard`)**, và mở khóa/trang bị các vật phẩm **`SKIN` (Trang phục)**, **`HAT` (Mũ/Tai nghe)**, **`DESK_PET` (Thú cưng để bàn)** theo tổng số phút học tích lũy.
- **Đàm thoại Âm thanh tại Bàn (`WebRTC P2P Mesh`):** Các thành viên ngồi cùng bàn ($\le 6$ người) có thể bật/tắt mic (`Mute/Unmute`) kết nối âm thanh trực tiếp giữa các trình duyệt qua kênh báo hiệu `/app/table/{tableId}/voice.signal`, kèm vòng sáng báo hiệu người đang nói (`voiceAudioAnalyzer`, `CLS = 0`) và tự động ngắt toàn bộ luồng âm thanh ngay khi rời bàn.

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
| `room:{roomId}:reservations` | `HASH` | Map `userId` $\rightarrow$ `expiresAtEpochMs` để giữ chỗ ngắn hạn khi phân mảnh phòng (`reserve_shard_slot.lua` & `atomic_stomp_join.lua`). |
| `room:{roomId}:disconnects` | `HASH` | Map `userId` $\rightarrow$ `disconnectedAtEpoch` phục vụ cơ chế giữ ghế 30 giây (`Grace Period`). |
| `room:{roomId}:seq` | `STRING` | Bộ đếm thứ tự sự kiện (`eventSeq`) tăng dần của từng phòng. |
| `room:{roomId}:chat` | `LIST` | Lưu bộ đệm các tin nhắn `Room Chat` gần nhất của phòng (tối đa 30 tin nhắn). |
| `table:{roomId}:{tableId}:state` | `STRING (JSON)` | Lưu `RedisTableState` phân vùng theo cả phòng và bàn ([ADR-0006](docs/adr/0006-room-scoped-table-redis-keys.md), [ADR-0014](docs/adr/0014-secondary-math-strokes-table-lock-and-client-study-pack.md)): `hostUserId`, `coHostUserIds`, `isFreeCollab`, `isTableLocked`, `inviteCode`, `sosBanner`, `videoState`, `homeworkSlides`, `activeSlideId`, `scratchpadState`. Tự động `DEL` khi bàn về $0$ người ngồi. |
| `table:{roomId}:{tableId}:lock` | `STRING` | Khóa phân tán ngắn hạn (TTL `5s`, giải phóng qua `release_table_lock.lua`) bảo vệ các giao dịch cập nhật trạng thái bàn. |
| `table:{roomId}:{tableId}:chat` | `LIST` | Bộ đệm tin nhắn trò chuyện nội bộ của bàn; tự động `DEL` khi bàn về $0$ người ngồi. |
| `ephemeral:img:{imageId}` | `STRING (JSON)` | Lưu metadata đường dẫn và MIME thực tế của file ảnh bài tập tạm kèm TTL `21600s` ($6\text{ giờ}$). |
| `guest:{guestId}:sessions` | `LIST` | Lưu danh sách các `Study Session` ($\ge 1$ phút) của Guest kèm TTL $7\text{ ngày}$, tự động chuyển vào MySQL khi nâng cấp tài khoản. |
| `guest:{guestId}:customization` | `STRING (JSON)` | Lưu cấu hình trang phục (`SKIN`, `HAT`, `DESK_PET`) của Guest kèm TTL $7\text{ ngày}$. |
| `ratelimit:*` | `ZSET` | Cửa sổ trượt giới hạn tần suất (Auth IP, Room/Table Chat, Table/Board mutations) thực thi nguyên tử qua `sliding_window_rate_limit.lua`. |

---

## 5. ĐẶC TẢ GIAO THỨC WEBSOCKET & REST API

### 5.1. Danh sách Kênh WebSocket (STOMP Endpoints — Kết nối tại `/ws`)

#### Luồng Cả Phòng (`Room Scope`):
- **Client gửi lên:**
  - `/app/room/{roomId}/join`: Đăng ký phiên STOMP vào phòng sau khi gọi REST join/snapshot.
  - `/app/room/{roomId}/move`: Gửi cập nhật vị trí và hướng di chuyển (throttle tối đa $10\text{ gói/giây}$).
  - `/app/room/{roomId}/seat.sit`: Yêu cầu chiếm ghế nguyên tử (`{ tableId, seatId, inviteCode? }`, kiểm tra `isTableLocked` & `inviteCode` qua `atomic_seat_sit.lua`).
  - `/app/room/{roomId}/seat.leave`: Chủ động đứng dậy rời khỏi bàn học.
  - `/app/room/{roomId}/chat`: Gửi tin nhắn trò chuyện phòng (hiển thị kèm `Chat Bubble` 4 giây trên đầu nhân vật).
  - `/app/room/{roomId}/goal.update`: Cập nhật hoặc đánh dấu hoàn thành mục tiêu học tập (`Study Goal`) trực tiếp trong phiên.
- **Client lắng nghe (Subscribe):**
  - `/topic/room/{roomId}/events`: Nhận mọi sự kiện cấp phòng (vào/rời phòng, di chuyển, ngồi/đứng dậy, đổi Trưởng bàn, bật/tắt SOS, tin nhắn phòng, cập nhật `Study Goal`, hoán đổi định danh khi nâng cấp tài khoản).

#### Luồng Riêng Từng Bàn (`Table Scope` — Chỉ cho phép khi `state === SEATED` tại đúng `(roomId, tableId)` đó theo [ADR-0008](docs/adr/0008-room-scoped-table-stomp-and-private-voice-signaling.md)):
- **Client gửi lên:**
  - `/app/table/{tableId}/permission.request`: Thành viên xin quyền điều khiển từ Trưởng bàn.
  - `/app/table/{tableId}/permission.respond`: Trưởng bàn xử lý phân quyền (`GRANT`, `DENY`, `REVOKE`, `TRANSFER_HOST`, `TOGGLE_FREE_COLLAB`, `TOGGLE_TABLE_LOCK`).
  - `/app/table/{tableId}/video.sync`: Đồng bộ trạng thái YouTube (`PLAY`, `PAUSE`, `SEEK`, `CHANGE_URL`).
  - `/app/table/{tableId}/sos.toggle`: Bật hoặc tắt biển báo cầu cứu bài tập (`SOS Banner`).
  - `/app/table/{tableId}/chat`: Gửi tin nhắn trò chuyện nội bộ trong bàn (hỗ trợ công thức toán $\LaTeX$).
  - `/app/table/{tableId}/board.slide`: Chuyển trang bài tập đang mở (`SELECT`) hoặc xóa trang bài tập (`DELETE`).
  - `/app/table/{tableId}/board.draw`: Vẽ nét mới (`ADD_STROKE` gồm `PEN`, `HIGHLIGHTER`, `TEXT`, `LATEX`, `LINE`, `ARROW`, `RECT`, `CIRCLE`, `DASHED_LINE`, `CIRCLE_CENTER`, `TRIANGLE`, `GEO_MARK`), tẩy nét vẽ (`ERASE_STROKE`), hoàn tác nét vẽ của chính người gửi (`UNDO_STROKE`), xóa sạch bảng (`CLEAR_SLIDE`) hoặc phát tín hiệu con trỏ (`LASER_MOVE`).
  - `/app/table/{tableId}/scratchpad.update`: Đồng bộ nội dung Sổ nháp bước giải (`Math Scratchpad`) theo thời gian thực.
  - `/app/table/{tableId}/voice.signal`: Trao đổi tín hiệu WebRTC P2P (`VOICE_JOIN`, `VOICE_LEAVE`, `SDP_OFFER`, `SDP_ANSWER`, `ICE_CANDIDATE`, `MUTE_STATUS`).
- **Client lắng nghe (Subscribe):**
  - `/topic/room/{roomId}/table/{tableId}/workspace`: Nhận toàn bộ sự kiện đồng bộ của bàn học trong phân mảnh phòng tương ứng (tự động thu hồi phía máy chủ khi rời ghế).
  - `/user/queue/voice`: Nhận riêng tư các gói tin bắt tay WebRTC P2P một-đối-một (`SDP_OFFER`, `SDP_ANSWER`, `ICE_CANDIDATE`).
  - `/user/queue/errors`: Nhận thông báo lỗi nghiệp vụ/phân quyền có cấu trúc riêng cho từng người dùng.

### 5.2. Danh sách REST API Chính
- **Xác thực (`Auth`):**
  - `POST /api/v1/auth/guest`: Khởi tạo phiên Guest và cấp JWT `guestToken` 7 ngày.
  - `POST /api/v1/auth/login`: Đăng nhập vào tài khoản `Registered User` (Email/Password hoặc Google `idToken`).
  - `POST /api/v1/auth/upgrade`: Nâng cấp phiên Guest hiện tại lên `Registered User`, gộp giờ học và hoán đổi định danh trực tiếp trên Redis.
  - `GET /api/v1/auth/me`: Lấy thông tin định danh và thống kê phiên hiện tại từ Bearer JWT.
- **Phòng & Bàn học (`Room & Table`):**
  - `POST /api/v1/rooms/join`: Chọn phân mảnh phòng khả dụng (`main-library`, `main-library-2`, ...; hỗ trợ body tùy chọn `{ preferredRoomId, preferredTableId }` cho **Table Invite Link**) và đăng ký hiện diện.
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
- **Đàm thoại Âm thanh & ICE/TURN (`Voice`):**
  - `GET /api/v1/voice/ice-servers`: Cấp danh sách máy chủ STUN + thông tin xác thực TURN ngắn hạn (`HMAC-SHA1` TTL ~1 giờ) cho WebRTC P2P Mesh.
- **Kiểm tra sức khỏe hệ thống (`Health`):**
  - `GET /api/v1/health`: Kiểm tra trạng thái kết nối thực tế tới MySQL và Redis.
  - `GET /actuator/health`: Endpoint kiểm tra sức khỏe chuẩn Spring Boot Actuator cho môi trường Production (`prod`).

---

## 6. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
LearningWithMe/
├── docker-compose.yml                  # Khởi chạy MySQL 8.0, Redis 7, Backend, Frontend (Local)
├── docker-compose.prod.yml             # Cấu hình Compose dự phòng cho VPS Linux + Caddy TLS
├── .env.example                        # Mẫu cấu hình biến môi trường
├── AGENTS.md                           # Quy chuẩn kiến trúc & giới hạn dòng cho AI Agent
├── GLOSSARY.md                         # Từ điển miền nghiệp vụ thống nhất (Ubiquitous Language)
├── .github/workflows/
│   ├── ci.yml                          # Cổng CI: check-file-limits, Backend Testcontainers + JaCoCo, Frontend Vitest
│   ├── cd.yml                          # CD: Build & push GHCR image (linux/amd64) + Render / SSH deploy
│   └── backup-nightly.yml              # Sao lưu đêm tự động MySQL + Redis (.tar.gz, lưu trữ 7 ngày)
├── scripts/
│   ├── check-file-limits.mjs           # Kiểm tra giới hạn số dòng theo AGENTS.md
│   ├── setup-prod-infra.sh             # Wizard tương tác cấp phát hạ tầng Cloud Free Tier
│   ├── create-backup.sh                # Tạo bản sao lưu nén MySQL + Redis (.tar.gz)
│   ├── restore-backup.sh               # Khôi phục bản sao lưu MySQL + Redis từ file .tar.gz
│   └── k6-room-load.js                 # Kịch bản kiểm thử tải k6 (10Hz STOMP move + Room Chat)
├── docs/
│   ├── SPEC.md                         # Đặc tả kỹ thuật tổng thể Phases 1 – 12 & UI Botanical Night Studio (#57)
│   └── adr/                            # Architecture Decision Records (ADR-0001 .. ADR-0014)
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
│   │   └── redis/                      # Lua scripts (atomic_seat_sit, atomic_stomp_join, release_table_lock, reserve_shard_slot, sliding_window_rate_limit, swap_identity)
│   ├── src/test/java/                  # Unit Tests & Testcontainers Integration Tests
│   └── Dockerfile
└── frontend/                           # React 18 + Vite 6 + TypeScript + TailwindCSS v4
    ├── src/
    │   ├── game/                       # Logic Phaser 3 tách biệt hoàn toàn khỏi DOM + botanicalPalette.ts (ADR-0010, ADR-0013)
    │   │   ├── atlas/                  # Paper-doll frame descriptors & SVG/Canvas portrait sync
    │   │   ├── cafe/                   # AmbientNpcManager & Study Café VFX
    │   │   ├── controllers/            # InputController, keyboardMapping
    │   │   ├── entities/               # PlayerSprite, RemotePlayersRenderer, ChatBubble, TableSosOverlay, Accessories
    │   │   ├── fx/                     # StudyCafeJuiceCoordinator (tween, dust, hover glow)
    │   │   ├── graphics/               # bootClassroomGame, graphicsQualityPolicy, workspaceGpuSleep
    │   │   ├── labels/                 # Pure world->overlay projection math
    │   │   ├── lighting/               # AmbienceMood lighting & PointLight pool
    │   │   ├── managers/               # SeatInteractionManager
    │   │   ├── pathfinding/            # GridPathfinder (EasyStar.js A*)
    │   │   ├── scenes/                 # ClassroomScene, classroomMapRenderer, cameraController
    │   │   ├── topology/               # roomTopology, tiledMapParser
    │   │   └── vfx/                    # Particle VFX & quality profiles
    │   ├── components/
    │   │   ├── auth/                   # GuestOnboardingModal, AccountUpgradeModal, RegisteredLoginPanel
    │   │   ├── game/                   # ClassroomCanvas, StudyCafeMapLabelsOverlay, projectedLabelStyle
    │   │   ├── hud/                    # TopBar, RoomChatBox, StudyLeaderboardModal, StudySessionsModal, CharacterCustomizerModal
    │   │   ├── icons/                  # StudioIcons (1.5px-stroke SVG kit — Ticket #57)
    │   │   └── table/                  # TableWorkspaceShell, SyncedYouTubePlayer, HomeworkAnnotationCanvas, VoiceChatBar...
    │   ├── stores/                     # Zustand (useAuthStore, useGameStore, useTableStore, useVoiceStore)
    │   ├── hooks/                      # useAppBootstrap, useRoomSync, useTableWorkspaceSync, useStudyTimer, useTableVoiceChat...
    │   ├── services/                   # REST API clients, STOMP clients, WebRTC Mesh Manager, Audio Analyzer
    │   ├── utils/                      # homeworkCanvasMath, homeworkImageCompression, youtubeSync
    │   └── __tests__/                  # Bộ kiểm thử Vitest & React Testing Library (Phases 1 - 11)
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
- Khi chạy thực tế (`SPRING_PROFILES_ACTIVE=prod`), Backend yêu cầu đủ biến môi trường bí mật trong `.env` (không fallback về giá trị dev), xử lý `X-Forwarded-For` qua Tomcat `RemoteIpValve` (`server.forward-headers-strategy: native` duyệt từ phải sang trái để chống giả mạo IP đầu chuỗi), chỉ mở `/actuator/health`, ẩn stack trace khỏi `ProblemDetail`, xuất log dạng JSON (`logstash`), và giới hạn `10 requests/phút` theo IP cho `/api/v1/auth/{guest,login,upgrade}`.
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

### 7.3. Triển khai Production (Vercel + Render Free Docker + Redis Cloud + Managed MySQL + CD)

Kiến trúc triển khai 0 đồng không cần thẻ tín dụng ([ADR-0007](docs/adr/0007-free-tier-oracle-vercel-topology.md)):
- **Frontend (Vercel Hobby):** Deploy qua Git integration (Root Directory: `frontend`, cấu hình [frontend/vercel.json](frontend/vercel.json)) với biến build-time `VITE_API_BASE_URL` và `VITE_WS_BASE_URL` (không chứa `localhost` trong bản production).
- **Backend (Render Free Web Service — `linux/amd64`):** Chạy container Spring Boot từ [backend/Dockerfile](backend/Dockerfile) tối ưu RAM 512MB (`-XX:+UseSerialGC -XX:MaxRAMPercentage=60.0 -Xss512k`), bind cổng động `${PORT}`, bật profile `prod`, mở `/actuator/health` *(cấu hình UptimeRobot ping 5 phút/lần tạm thời bỏ ngỏ, có thể bật bổ sung sau khi cần giữ thức 24/7)*.
- **Hot & Cold Managed Databases (Free Tier):** **Redis Cloud Free** (30MB Fixed, không giới hạn lệnh/tháng, cấu hình qua `SPRING_DATA_REDIS_USERNAME` & `SPRING_DATA_REDIS_SSL_ENABLED`) và **Aiven / TiDB Cloud Free MySQL 8.0** (`SPRING_DATASOURCE_HIKARI_MAX_POOL_SIZE=5`).
- **Managed TURN Relay (`WebRTC Voice`):** Endpoint `GET /api/v1/voice/ice-servers` cấp thông tin xác thực TURN ngắn hạn (`HMAC-SHA1` qua `APP_VOICE_TURN_URLS` & `APP_VOICE_TURN_SECRET`), tự động fallback về STUN công cộng nếu chưa cấu hình TURN.
- **CD tự động:** Merge vào `main` kích hoạt [.github/workflows/cd.yml](.github/workflows/cd.yml) để build Docker image `linux/amd64`, đẩy lên GHCR, và tùy chọn kích hoạt `RENDER_DEPLOY_HOOK_URL` (cùng xác minh `/actuator/health` trả về `UP`) hoặc SSH fallback tới VPS nếu `VM_HOST` được cấu hình kèm [docker-compose.prod.yml](docker-compose.prod.yml) + [deploy/Caddyfile](deploy/Caddyfile). Nếu dùng Render nối trực tiếp GitHub repo với **Auto-Deploy (`On Commit`)** và `Dockerfile Path = backend/Dockerfile`, có thể bỏ qua `RENDER_DEPLOY_HOOK_URL` để Render tự build & deploy mà workflow CD vẫn xanh.
- **Wizard cấp phát hạ tầng:** Chạy script tương tác [scripts/setup-prod-infra.sh](scripts/setup-prod-infra.sh) (hỗ trợ WSL/Git Bash/macOS/Linux) để đi từng bước qua Redis Cloud, Aiven/TiDB MySQL, Vercel, Render Free, tạo `.env.prod.local` quyền `0600` và nạp các GitHub Variables/Secrets cho CD & Nightly Backup:
  ```bash
  ./scripts/setup-prod-infra.sh
  ```

### 7.4. Sao lưu Đêm, Diễn tập Khôi phục (Restore Drill) & Kiểm thử Tải `k6`

**1. Sao lưu tự động & thủ công (`MySQL + Redis`):**
- Workflow [.github/workflows/backup-nightly.yml](.github/workflows/backup-nightly.yml) chạy tự động lúc `02:00` sáng (giờ Việt Nam, `19:00 UTC`) hàng đêm hoặc kích hoạt thủ công qua **`workflow_dispatch`**, gọi [scripts/create-backup.sh](scripts/create-backup.sh) để xuất `mysql.sql` (`mysqldump`) cùng toàn bộ khóa và TTL trên Redis qua `SCAN` không chặn (`redis-dump.tsv`), nén `.tar.gz` và **mã hóa AES-256-CBC (`PBKDF2`)** bằng `BACKUP_ENCRYPTION_PASSPHRASE` thành `.tar.gz.enc` trước khi tải lên GitHub Actions Artifacts (`retention-days: 7`) hoặc S3/Cloudflare R2 nếu cấu hình `BACKUP_S3_BUCKET`.
- **Quy trình khôi phục (`Restore Procedure`):**
  ```bash
  # Tạo bản sao lưu thủ công
  ./scripts/create-backup.sh backups/manual-backup.tar.gz

  # Khôi phục vào MySQL & Redis đích (hỗ trợ cả .tar.gz và .tar.gz.enc qua BACKUP_ENCRYPTION_PASSPHRASE)
  BACKUP_ENCRYPTION_PASSPHRASE="..." ./scripts/restore-backup.sh backups/manual-backup.tar.gz.enc --flush-redis
  ```

**2. Kiểm thử tải thời gian thực với `k6` (`10Hz STOMP Movement + Room Chat`):**
- Kịch bản [scripts/k6-room-load.js](scripts/k6-room-load.js) mô phỏng nhiều người học đồng thời lấy JWT Guest, tham gia `Room`, kết nối STOMP WebSocket, di chuyển liên tục ở tần suất `10Hz` (`100ms`) và gửi tin nhắn `Room Chat`, đồng thời kiểm định ngưỡng độ trễ phát sóng `stomp_broadcast_latency_ms` ($p95 < 250\text{ms}$) và tỷ lệ lỗi $< 1\%$:
  ```bash
  k6 run \
    -e BASE_URL=http://localhost:8080 \
    -e ORIGIN=http://localhost:5173 \
    -e VUS=25 \
    -e DURATION=30s \
    -e P95_BROADCAST_MS=250 \
    scripts/k6-room-load.js
  ```

---

## 8. TRẠNG THÁI TRIỂN KHAI (PHASES 1 – 12 & UI REFACTOR #57 COMPLETED)

- [x] **Phase 1 — Foundation, Docker Infra & Hybrid Auth:** Docker Compose, Flyway migrations, Guest onboarding không rác DB, nâng cấp tài khoản không gián đoạn và hoán đổi định danh nguyên tử trên Redis.
- [x] **Phase 2 — 2D Classroom Engine & Character State Machine:** Bản đồ Tiled JSON dùng chung, tìm đường $A^*$ (`EasyStar.js`), máy trạng thái `FREE_ROAM` $\leftrightarrow$ `WALKING_TO_SEAT` $\leftrightarrow$ `SEATED`, ưu tiên bàn phím tức thời và khóa di chuyển khi ngồi.
- [x] **Phase 3 — Realtime Room Sync, Atomic Seat Lock & Grace Period:** Tự động phân mảnh phòng (50 người/phòng), đồng bộ di chuyển 10Hz + nội suy 60 FPS, khóa ghế nguyên tử bằng Lua script, giữ ghế 30 giây khi rớt mạng, tự động kế nhiệm Trưởng bàn và `Room Chat` kèm `Chat Bubble` 4 giây.
- [x] **Phase 4 — Table Workspace: Host Permissions, Synced YouTube & SOS:** Phân quyền `TABLE_HOST` / `CO_HOST` / `MEMBER` và `Free Collaboration`, đồng bộ YouTube chống giật ($\Delta t = 2.0\text{s}$), bộ đếm giờ học theo `Epoch`, `Table Chat` và biển báo `SOS Banner`.
- [x] **Phase 5 — Ephemeral Homework Whiteboard & Auto-Cleanup:** Tải/dán ảnh bài tập `Ctrl + V` nén `.webp`, kiểm tra magic bytes, tối đa 5 slides/bàn, vẽ chú thích chuẩn hóa tọa độ `[0.0, 1.0]`, con trỏ `Laser Pointer` 10Hz và tự động xóa sạch khi bàn trống hoặc sau 6 giờ.
- [x] **Phase 6 — Study Sessions Persistence, Gamification & WebRTC Voice:** Lưu phiên học $\ge 1\text{ phút}$, bảng xếp hạng học tập, mở khóa & trang bị `SKIN` / `HAT` / `DESK_PET`, và đàm thoại âm thanh `WebRTC P2P Mesh` tại bàn học.
- [x] **Phase 7 — Production Readiness, CI/CD, Restart Resilience & Cloud Free Tier Ops:** Cổng CI/CD GitHub Actions (`check-file-limits.mjs`, JaCoCo $\ge 70\%$), profile `prod` (rate limit IP, JSON logs, `/actuator/health`), khôi phục `Grace Period` khi khởi động lại, STOMP backoff + jitter, Managed TURN (`GET /api/v1/voice/ice-servers`), sao lưu đêm 7 ngày (`backup-nightly.yml` + `restore-backup.sh`) và kiểm thử tải `k6` 10Hz *(UptimeRobot 5-minute keep-alive tạm để ngỏ)*.
- [x] **Phase 8 — Realtime Hardening, Study Café & Focus Motivation:** Khóa trạng thái bàn & bầu Trưởng bàn nguyên tử, cô lập kênh STOMP theo `(roomId, tableId)` và tín hiệu Voice riêng tư (`ADR-0008`), xác thực tải ảnh bài tập & rate limit, nâng cấp **Study Café** với **Ambient NPCs** (`ADR-0009`), **Focus Cycle** đồng bộ (đã gỡ bỏ ở Phase 10), check-off **Study Goal**, **Study Streak**, **Ambient Soundscape**, thu gọn **Table Workspace** và tối ưu camera/HUD di động.
- [x] **Phase 9 — UX Polish, Mobile Ergonomics, Study Café Delivery & CI/CD Hardening:** Kéo thả/hoán đổi bố cục Video & Bảng bài tập trong **Table Workspace**, chỉ báo Mic không giật (Zero-CLS) kèm điều khiển cố định ở Header bàn, tinh gọn `TopBar` một hàng, thông báo đợi **Render** Cold Start kèm tự động ping lại, nút chụp ảnh bài tập trực tiếp bằng camera điện thoại, nhân viên `Phục vụ An` tìm đường $A^*$ mang đồ uống tới chỗ người học (`Drink Delivery`), và sửa lỗi workflow CI/CD + `backup-nightly.yml` + test phân mảnh phòng.
- [x] **UI Refactor (`#57` / `ADR-0010`) — Botanical Night Studio ("Rừng Đêm & Tập trung Sâu"):** Thiết lập Semantic Token Seam dùng chung giữa React HUD (`@theme` trong `index.css`) và Phaser 3 (`botanicalPalette.ts`), bảng màu `#0F1714` Deep Pine Night / `#16221E` Slate Leaf / `#243630` Luminous Border / `#E6ECE8` Morning Mist / `#8FA399` Muted Sage / `#E5A93C` Warm Amber (mực tối `#0F1714` đạt `8.74:1`) / `#34D399` Bioluminescent Emerald, kiến trúc Double-Bezel + Static Glassmorphism, bộ `StudioIcons` SVG `1.5px` và xóa sạch toàn bộ lớp màu `slate-*`/`sky-*` thô trên UI chrome.
- [x] **Phase 10 (`#64`..`#71`) — Technical Debt Paydown, Strict Video Sync, Math Study Suite, 2D Study Café Overhaul & Multi-Layer Audio (Bám sát Botanical Night Studio `#57` & `ADR-0010`):** Thanh toán nợ kỹ thuật Single-Node (Lua Rate Limiters nguyên tử, `Per-Author Undo/Redo`, chuẩn hóa MIME ảnh bài tập), khóa đồng bộ video YouTube toàn bàn (`Iframe Click Shield`, `onStateChange` Guard, Heartbeat `3s`, thanh tua thời gian & Muted Autoplay fallback — `ADR-0011`), bộ công cụ Giải Toán (Trang nháp Toán dựng sẵn, hình học phẳng & $\LaTeX$ `Stroke`, $\LaTeX$ trong Chat, `Math Scratchpad` đồng bộ, `Function Grapher` vẽ đồ thị $f(x)$ & máy tính khoa học — `ADR-0012`), đại tu đồ họa 2D **Study Café** (nhân vật `32x48px` có bóng đổ, nội thất pixel-art có `Y-Sorting`, hiệu ứng mưa ngoài cửa sổ đồng bộ `BOTANICAL_2D_SCENE`) và nâng cấp **Ambient Soundscape** 5 kênh đa tầng (kèm Lofi Piano) + **Study SFX**.
- [x] **Phase 11 (`#75`..`#85` / `ADR-0013`) — WebGL 2D Study Café Overhaul, Paper-Doll Pipeline & Accessibility/Performance Hardening:** Mở khóa WebGL (`Phaser.AUTO` với Canvas fallback + GPU sleep khi mở Workspace + dọn dẹp vòng lặp an toàn khi đăng xuất/chuyển tài khoản), 3 chế độ **Ambience Mood** và đèn bàn `Warm Amber`, Particle VFX & Game Feel, nhãn chiếu DOM hi-DPI sắc nét (cô lập khỏi `src/game/`), tileset & Paper-doll pixel-art atlas CC0-1.0 (`32×48px`) đồng bộ chân dung React (`TopBar`, Onboarding, Tủ đồ), chuẩn hóa toàn bộ React UI sang `@theme` tokens (`bg-background`/`bg-card`/`bg-primary`), focus trap + `inert` đồng bộ cho mọi Modal và tối ưu LCP/CLS di động (`375px` & `320px`).
- [x] **Phase 12 (`#86`..`#94` / `ADR-0014`) — Secondary Math Suite (Toán THCS), Euclidean Geometry Board, Mobile Ergonomics, Tutoring Coordination & Study Pack Export:** Tái cấu trúc module theo giới hạn dòng `AGENTS.md`, bổ sung **Curriculum Mode** mặc định `Toán THCS` (cùng `THPT / Đại học`), mẫu **Trục số (`NUMBER_LINE`)**, bộ giải số học/phân số/căn thức chính xác (`mathExact*`, `mathNumberTheory`), nét vẽ hình học phẳng THCS (`DASHED_LINE`, `CIRCLE_CENTER`, `TRIANGLE`, `GEO_MARK`, `VERTEX_LABEL` + bắt điểm & khóa góc), cắt xoay ảnh trước khi tải lên + Zoom/Pan cục bộ + gia cố **Clear View** (`Undo`, 3 màu mực, xác nhận xóa 2 bước), **Table Invite Link** + khóa bàn nguyên tử **Table Lock** trên Redis, và xuất **Study Pack** (PNG / PDF nhiều trang) thuần Client-Side kèm hộp thoại nhắc lưu trước khi rời ghế.
