# AGENTS.md — Cùng Nhau Học Bài (Study Together 2D Web Game)

Tài liệu quy chuẩn bắt buộc cho AI Agent khi thiết kế, lập trình, kiểm thử và review mã nguồn trong dự án. Spec gốc nằm tại `README.md`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `congHau02/LearningWithMe` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Skill Routing (Bắt buộc đọc trước khi thực thi từng nhánh)

- **Thiết kế module & kiến trúc**: Đọc `.agents/skills/codebase-design/SKILL.md` (Deep modules, seams) và `.agents/skills/domain-modeling/SKILL.md`.
- **Nguyên tắc tối giản & chống over-engineering**: Áp dụng `.agents/skills/ponytail/SKILL.md` — viết lượng code nhỏ nhất giải quyết trọn vẹn bài toán, ghi chú giới hạn bằng `// shortcut: <limit>, <when to upgrade>`.
- **Backend (Java 21 + Spring Boot 3.x)**:
  - Khởi tạo dự án: `.agents/skills/create-spring-boot-java-project/SKILL.md`.
  - Lập trình & kiến trúc REST/WebSocket/Data: `.agents/skills/java-springboot/SKILL.md` và `.agents/skills/springboot-patterns/SKILL.md`.
  - Bảo mật (Hybrid Guest JWT + OAuth2, Rate limit, CORS/CSRF): `.agents/skills/springboot-security/SKILL.md`.
  - Kiểm thử & xác minh (JUnit 5, Testcontainers, JaCoCo): `.agents/skills/springboot-tdd/SKILL.md` và `.agents/skills/springboot-verification/SKILL.md`.
- **Frontend (React 18 + Vite + TailwindCSS + Phaser 3)**:
  - Hiệu năng & cấu trúc Component: `.agents/skills/vercel-react-best-practices/SKILL.md` và `.agents/skills/vercel-composition-patterns/SKILL.md`.
  - Hệ thống Design Token & Tailwind: `.agents/skills/tailwind-design-system/SKILL.md`.
  - Thẩm mỹ UI/UX & HUD chống "AI-slop": `.agents/skills/design-taste-frontend/SKILL.md`, `.agents/skills/ui-ux-pro-max/SKILL.md`, và `.agents/skills/web-design-guidelines/SKILL.md`.
- **Quy trình TDD, Debug & Review**: `.agents/skills/tdd/SKILL.md`, `.agents/skills/diagnosing-bugs/SKILL.md`, `.agents/skills/code-review/SKILL.md`, và `.agents/skills/ponytail-review/SKILL.md`.

---

## 1. Giới hạn kích thước File & Tổ chức Module (File Size & Modularity Rules)

Thiết kế theo triết lý **Deep Modules** (`codebase-design`): giao diện (Interface) hẹp, rõ ràng; che giấu độ phức tạp bên trong nhưng giữ từng file nhỏ gọn, đơn nhiệm (Single Responsibility).

- **Giới hạn số dòng tối đa trên mỗi file (Hard Limits)**:
  - **React Component (`.tsx`)**: Tối đa **200 dòng** (mục tiêu lý tưởng: **80–150 dòng**). Tách custom hook (`use*.ts`), sub-components hoặc helper khi vượt ngưỡng.
  - **Phaser 3 Scene / Entity (`src/game/**/*.ts`)**: Tối đa **250 dòng**. `ClassroomScene.ts` chỉ làm nhiệm vụ điều phối (orchestration); tách riêng `GridPathfinder.ts`, `PlayerSprite.ts`, `SeatInteractionManager.ts`, `InputController.ts`.
  - **Zustand Store (`src/stores/*.ts`)**: Tối đa **150 dòng** mỗi store (`useGameStore`, `useTableStore`, `useAuthStore`).
  - **Spring Boot Class (`.java`)**:
    - `Controller` / `WebSocketHandler`: Tối đa **150 dòng** (chỉ định tuyến, validate input và gọi Service).
    - `Service`: Tối đa **250 dòng** (tách theo từng miền nghiệp vụ trong `modules/{auth,room,table,storage,stats}`).
    - `DTO` / `Record` / `Entity`: Dùng Java `record` cho DTO bất biến; mỗi class tối đa **120 dòng**.
- **Quy tắc chia tách**: Khi một file tiệm cận ngưỡng giới hạn, tách ngay theo ranh giới trách nhiệm (Seam) trước khi thêm tính năng mới.

---

## 2. Quy tắc Kiến trúc Cốt lõi (Core Architecture Invariants)

### 2.1. Ranh giới Hybrid 2D Canvas (Phaser 3) ↔ Reactive HUD (ReactJS)

- **Cô lập hoàn toàn DOM và Canvas**:
  - **Phaser 3 (`src/game/`)** độc quyền quản lý vòng lặp `60 FPS`, Tilemap 3/4 Top-Down Orthogonal (`32x32px` hoặc `48x48px`), va chạm vật lý, tìm đường $A^*$ (`EasyStar.js`), hoạt ảnh nhân vật và bong bóng trạng thái trên bản đồ.
  - **ReactJS (`src/components/`)** độc quyền hiển thị lớp giao diện nổi (HUD, Auth Modal, Table Workspace, YouTube Player, Ephemeral Homework Canvas, Chat Panel).
- **Cầu nối trạng thái duy nhất (Zustand Bridge)**:
  - React và Phaser giao tiếp một chiều/hai chiều **duy nhất qua Zustand vanilla/hook store** (`useGameStore.getState()` bên trong Phaser và `useGameStore(selector)` bên trong React).
  - Trong React, luôn dùng **atomic selector** (VD: `useTableStore(s => s.videoState)`) để tránh re-render toàn bộ HUD khi tọa độ nhân vật cập nhật liên tục.

### 2.2. Máy Trạng thái Nhân vật & Quy tắc Ưu tiên Điều khiển

- **3 trạng thái bất biến**: `FREE_ROAM` $\leftrightarrow$ `WALKING_TO_SEAT` $\leftrightarrow$ `SEATED`.
- **Ưu tiên bàn phím tức thời (Input Priority)**: Khi nhân vật đang di chuyển tự động theo lộ trình $A^*$ (`PathFollowing` từ thao tác chạm/click), bất kỳ phím di chuyển nào (`WASD` / Arrow Keys) được nhấn phải lập tức gọi `clearPath()` và chuyển quyền điều khiển về bàn phím trong cùng frame đó.
- **Khóa di chuyển khi `SEATED`**: Khi đã ngồi vào ghế (`SEATED`), vô hiệu hóa hoàn toàn input di chuyển bản đồ (`WASD` và click bản đồ) để người dùng gõ chat, vẽ bài tập và điều khiển video; chỉ thoát về `FREE_ROAM` khi bấm nút **"Đứng dậy rời bàn"** hoặc xác nhận phím `ESC`.

### 2.3. Stateful Realtime Backend (Spring Boot + STOMP WebSocket + Redis + MySQL)

- **Phân tách Lưu trữ Nóng / Lạnh (Hot vs. Cold State)**:
  - **Redis 7.x (Hot Realtime State)**: Lưu tọa độ người chơi (`room:{roomId}:players`), khóa ghế (`room:{roomId}:seats`), trạng thái bàn học (`table:{tableId}:state`) và metadata ảnh tạm (`ephemeral:img:{imageId}`).
  - **MySQL 8.0 (Cold Persistent State)**: Chỉ ghi xuống MySQL khi khởi tạo/nâng cấp tài khoản (`users`), mở khóa vật phẩm (`character_items`), và **chỉ ghi `study_sessions` một lần khi người dùng kết thúc phiên ngồi học (đứng dậy rời bàn)**.
- **Khóa ghế nguyên tử & Grace Period 30 giây**:
  - Chiếm ghế bắt buộc dùng lệnh nguyên tử Redis `HSETNX room:{roomId}:seats {seatId} {userId}` (hoặc Lua script tương đương) để chống race condition khi 2 người bấm cùng ghế.
  - Khi người dùng đang ngồi (`SEATED` / `TABLE_HOST`) bị mất kết nối WebSocket (rớt mạng hoặc F5), giữ nguyên ghế và quyền Trưởng bàn trong Redis với TTL **`30 giây`**. Chỉ khi quá 30 giây không kết nối lại mới giải phóng ghế và kích hoạt bầu Trưởng bàn kế nhiệm (**Auto-Host Succession**).
- **Phân tách Kênh WebSocket (Room Scope vs. Table Scope)**:
  - `/topic/room/{roomId}/events`: Chỉ truyền sự kiện cấp phòng (vị trí, ngồi/đứng dậy, trưởng bàn mới, bật/tắt cờ SOS).
  - `/topic/table/{tableId}/workspace`: Chỉ client đang có `state === SEATED` tại đúng `tableId` đó mới được subscribe để nhận sự kiện Video Sync, nét vẽ Whiteboard, xin/duyệt quyền `CO_HOST` và Table Chat.
- **Giới hạn tần suất gói tin (Network Throttling 10Hz)**:
  - Gói tin di chuyển (`/app/room/{roomId}/move`) và con trỏ Laser (`/app/table/{tableId}/board.draw`) phải được throttle ở mức tối đa **10 gói tin/giây (`100ms`)** từ Client và kiểm tra rate-limit trên Server. Client sử dụng nội suy tuyến tính (`Lerp`) để giữ chuyển động mượt ở `60 FPS`.

### 2.4. Đồng bộ Không gian Bàn học (Table Workspace Rules)

- **Kiểm tra phân quyền tại Server (Server-Authoritative Permissions)**:
  - Mọi gói tin thay đổi trạng thái bàn (`video.sync`, upload/xóa slide bài tập, xóa bảng vẽ, bật SOS) phải được Backend xác thực người gửi là `TABLE_HOST`, `CO_HOST`, hoặc bàn đang bật `isFreeCollab == true`.
- **Đồng bộ YouTube chống giật (Drift Tolerance $\Delta t = 2.0\text{s}$)**:
  - Tính thời gian đích theo mốc thời gian thực: $T_{\text{current}} = T_{\text{saved}} + (\text{Epoch}_{\text{now}} - \text{Epoch}_{\text{updated}}) / 1000$.
  - Chỉ gọi `player.seekTo(T_current)` khi độ lệch $\ge 2.0\text{ giây}$. Bộ đếm giờ học phải tính bằng `System Timestamp` (`Date.now()`) để không bị trình duyệt làm chậm khi chuyển tab (Background Tab Throttling).
- **Bảng bài tập tạm thời & Chuẩn hóa Tọa độ (Ephemeral Homework Board)**:
  - Mọi tọa độ nét vẽ và con trỏ Laser trên ảnh bài tập phải chuẩn hóa về tỷ lệ tương đối **`[0.0, 1.0]`** theo chiều rộng và chiều cao ảnh gốc để hiển thị khớp 100% giữa Desktop và Mobile.
  - Ảnh bài tập tải lên (tối đa `5MB`, tối đa `5 slides/bàn`) được nén sang `.webp`, gắn TTL tối đa `6 giờ`, và **xóa ngay lập tức cả file vật lý lẫn key Redis khi người cuối cùng rời bàn (`0` người ngồi)**.

### 2.5. Xác thực Kết hợp (Hybrid Auth: Guest-First & Zero-Interruption Upgrade)

- Mặc định vào thẳng phòng bằng **Guest Mode** (`guestId` UUID + `guestToken` JWT 7 ngày).
- Khi nâng cấp lên tài khoản chính thức (`POST /api/v1/auth/upgrade`), Backend gộp toàn bộ số phút đã học của `guestId` vào `users.total_study_minutes` trên MySQL và cập nhật định danh phiên trực tiếp trên Redis mà **không đá người dùng khỏi ghế đang ngồi**.

---

## 3. Quy chuẩn Mã nguồn, Bảo mật & Kiểm thử (Coding, Security & Verification)

- **Xử lý lỗi chuẩn hóa**: Backend trả về lỗi REST API theo chuẩn **RFC 7807 `ProblemDetail`** (theo skill `java-springboot`). Với lỗi WebSocket, gửi thông báo lỗi có cấu trúc về `/user/queue/errors`.
- **Bảo mật & Dữ liệu đầu vào**:
  - Validate toàn bộ DTO bằng Jakarta Validation (`@Valid`) ở Backend và `React Hook Form` + `Zod` ở Frontend.
  - Kiểm tra định dạng MIME thực tế (magic bytes) và kích thước file ảnh bài tập trước khi xử lý; không tin tưởng phần mở rộng file từ client.
  - Không lưu biến nhạy cảm (DB password, JWT secret, OAuth2 client secret) trong code; luôn đọc từ biến môi trường qua `@ConfigurationProperties`.
- **Kiểm thử bắt buộc cho Logic Rủi ro cao**:
  - Mọi thay đổi liên quan đến: (1) Khóa ghế nguyên tử Redis, (2) Chuyển giao quyền `TABLE_HOST` / Grace Period 30s, (3) Gộp giờ học Guest $\rightarrow$ Registered User, và (4) Tự động xóa ảnh bài tập tạm thời đều phải có Unit Test hoặc Integration Test đi kèm.
