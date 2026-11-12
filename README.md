# TÀI LIỆU ĐẶC TẢ SẢN PHẨM & KỸ THUẬT (PRD & TECHNICAL SPECIFICATION)

- **Tên dự án:** Cùng Nhau Học Bài (Study Together 2D Web Game)
- **Slogan:** *"Cùng nhau học bài - Không còn cô đơn trên hành trình chinh phục tri thức"*
- **Phiên bản tài liệu:** 1.0.0
- **Kiến trúc cốt lõi:** Hybrid 2D Canvas (Phaser 3) + Reactive HUD (ReactJS) + Stateful Realtime Backend (Spring Boot, WebSocket, Redis, MySQL)

---

## 1. TỔNG QUAN SẢN PHẨM & LỰA CHỌN ĐỒ HỌA

### 1.1. Tầm nhìn Sản phẩm
Xây dựng một không gian học tập trực tuyến 2D trên trình duyệt (Web-based Social Study Game), nơi người dùng điều khiển nhân vật đi lại trong phòng học/thư viện ảo, ngồi vào bàn học để cùng xem video bài giảng/nhạc Lofi đồng bộ, đăng ảnh bài tập lên bảng chung để vẽ hướng dẫn giải bài và trò chuyện theo thời gian thực.

### 1.2. Định hướng Góc nhìn Đồ họa: 3/4 Top-Down 2D Orthogonal
Dự án sử dụng góc nhìn **3/4 Top-Down 2D** (tương tự *Gather.town*, *Zep.us*, *Stardew Valley*) thay vì Isometric $2.5\text{D}$ vì 4 ưu điểm kỹ thuật và trải nghiệm:
1. **Hiển thị trực quan mặt bàn & biểu cảm:** Góc nhìn 3/4 cho phép nhìn rõ mặt trước của nhân vật, phụ kiện trên bàn học (laptop, đèn bàn, ly cà phê) và các bong bóng trạng thái (đồng hồ đếm giờ, tín hiệu SOS cần giảng bài).
2. **Tối ưu thao tác Chạm & Tìm đường ($A^*$ Pathfinding):** Bản đồ chia theo lưới ô vuông chuẩn ($32 \times 32\text{px}$ hoặc $48 \times 48\text{px}$), giúp việc chạm màn hình trên điện thoại chính xác tuyệt đối và thuật toán tìm đường $A^*$ hoạt động nhẹ nhàng.
3. **Dễ dàng mở rộng tài nguyên (Assets):** Tương thích $100\%$ với công cụ thiết kế bản đồ **Tiled Map Editor** (xuất file JSON), dễ dàng thêm trang phục nhân vật (Sprite Sheets 4 hướng) và bàn ghế mới.
4. **Hiệu năng cao trên trình duyệt di động:** Chiếm ít tài nguyên GPU hơn, duy trì mức $60\text{ FPS}$ ổn định ngay cả khi mở kèm trình phát YouTube và bảng vẽ Canvas.

---

## 2. KIẾN TRÚC HỆ THỐNG & TECH STACK

### 2.1. Sơ đồ Kiến trúc Tổng thể

```text
+-----------------------------------------------------------------------------------+
|                        CLIENT (Desktop & Mobile Browser)                          |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | LỚP GIAO DIỆN NỔI - REACTJS HUD LAYER (Vite + TailwindCSS)                  |  |
|  | - Auth/Onboarding Modal (Guest & OAuth2)                                    |  |
|  | - Table Workspace UI: YouTube Sync Player, Ephemeral Whiteboard, Table Chat |  |
|  | - Permission Controller: Quản lý Trưởng bàn (Host) & Duyệt quyền điều khiển |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         |                                         |
|                         [ Zustand Shared Store / Event Bus ]                      |
|                                         |                                         |
|  +--------------------------------------v--------------------------------------+  |
|  | LỚP GAME 2D - PHASER 3 ENGINE LAYER                                         |  |
|  | - Tilemap Renderer (Sàn, Tường, Bàn học, Ghế ngồi, Khu vực AFK)             |  |
|  | - Input Manager (WASD Keyboard + Point-and-Click/Touch)                     |  |
|  | - EasyStar.js (A* Pathfinding) & Character State Machine                    |  |
|  +--------------------------------------+--------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                                          |
                     WebSocket (STOMP)    |    REST API (HTTPS)
                                          v
+-----------------------------------------------------------------------------------+
|                        BACKEND SERVER (Dockerized Environment)                    |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | JAVA SPRING BOOT APPLICATION                                                |  |
|  | - WebSocket Handlers: Movement, Seat Lock, Host Permission, Table Sync      |  |
|  | - REST Controllers: Hybrid Auth, Ephemeral Image Upload, Study Statistics   |  |
|  | - Cleanup Scheduler: Tự động xóa ảnh bài tập tạm thời khi bàn trống         |  |
|  +-------------------+-------------------------------------+-------------------+  |
|                      |                                     |                      |
|                      v                                     v                      |
|  +---------------------------------------+   +---------------------------------+  |
|  | REDIS (In-Memory State & Pub/Sub)     |   | MYSQL 8.0 (Persistent Storage)  |  |
|  | - Tọa độ nhân vật & Trạng thái ghế    |   | - Hồ sơ người dùng (Registered) |  |
|  | - Quyền Trưởng bàn (Host) & Co-Host   |   | - Lịch sử phiên học (Study Log) |  |
|  | - Trạng thái Video & Bảng vẽ hiện tại |   | - Vật phẩm & Trang phục mở khóa |  |
|  +---------------------------------------+   +---------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.2. Chi tiết Công nghệ Sử dụng (Tech Stack)

| Phân hệ | Công nghệ / Thư viện | Vai trò trong dự án |
| :--- | :--- | :--- |
| **Frontend Core** | ReactJS 18+ (Vite), TailwindCSS | Xây dựng toàn bộ giao diện HUD, Modal, Bảng điều khiển bàn học. |
| **State & Data Fetching** | Zustand, TanStack Query, React Hook Form | Zustand làm cầu nối dữ liệu giữa React và Phaser; TanStack Query & Hook Form quản lý API và biểu mẫu. |
| **2D Game Engine** | Phaser 3 + EasyStar.js | Render bản đồ 2D, hoạt ảnh nhân vật, xử lý va chạm và tìm đường $A^*$ khi chạm màn hình. |
| **Bảng vẽ & Video** | YouTube IFrame API + Fabric.js (hoặc Konva.js) | Đồng bộ trình phát video và cung cấp lớp Canvas vẽ chú thích đè lên ảnh bài tập. |
| **Backend Core** | Java 21 + Spring Boot 3.x | Xử lý nghiệp vụ, phân quyền, REST API và điều phối gói tin thời gian thực. |
| **Realtime Protocol** | Spring WebSocket (STOMP over SockJS/WS) | Giao tiếp hai chiều theo mô hình Pub/Sub cho Phòng (Room) và từng Bàn (Table). |
| **In-Memory & Cache** | Redis 7.x | Lưu trữ trạng thái tức thời của phòng/bàn, khóa ghế nguyên tử (Atomic Lock) và TTL dữ liệu tạm. |
| **Database & Infra** | MySQL 8.0 + Docker Compose | Lưu trữ bền vững cho người dùng đăng ký; đóng gói môi trường phát triển và triển khai. |

---

## 3. ĐẶC TẢ CHI TIẾT CÁC PHÂN HỆ CHỨC NĂNG

### 3.1. Cơ chế Xác thực Kết hợp (Hybrid Auth: Guest-First & Account Upgrade)
Mặc định người dùng **không cần đăng nhập** để tối ưu tỷ lệ chuyển đổi (Zero-friction onboarding):

1. **Chế độ Khách (Guest Mode - Mặc định):**
   - Khi truy cập lần đầu, hệ thống tự động sinh một mã định danh `guestId` (UUID v4) kèm `guestToken` (JWT thời hạn 7 ngày) lưu vào `localStorage`.
   - Người dùng chỉ cần chọn ngoại hình nhân vật mặc định, nhập `Nickname` (tối đa 20 ký tự) và `Mục tiêu học tập hôm nay` (tối đa 60 ký tự) để bước vào phòng ngay lập tức.
   - Thời gian ngồi học trong phiên của Guest vẫn được ghi nhận tạm thời trên Redis và `localStorage`.
2. **Chế độ Đăng nhập & Nâng cấp Tài khoản (Registered Mode):**
   - Trên góc màn hình luôn có nút *"Đăng nhập / Lưu thành tích"* (hỗ trợ Google OAuth2 hoặc Email/Password).
   - **Đồng bộ dữ liệu (Account Merging):** Khi một Guest bấm đăng nhập, Backend đọc `guestToken` hiện tại, cộng dồn toàn bộ số phút đã học trong phiên Guest đó vào tài khoản chính thức trong MySQL mà **không làm gián đoạn chỗ ngồi hiện tại** của người dùng trong phòng.

---

### 3.2. Hệ thống Điều khiển Nhân vật & Máy Trạng thái (Movement & State Machine)

#### A. Các Trạng thái của Nhân vật (Character States)
1. **`FREE_ROAM` (Đi lại tự do):**
   - Nhân vật chưa ngồi vào bàn nào.
   - Cho phép điều khiển bằng **Bàn phím (WASD / Phím mũi tên)** hoặc **Chạm/Click vào một điểm bất kỳ trên bản đồ**.
2. **`WALKING_TO_SEAT` (Đang tự động tiến vào ghế):**
   - Kích hoạt khi nhân vật đang ở `FREE_ROAM` và người dùng **Click/Chạm trực tiếp vào một chiếc ghế trống**.
   - Hệ thống dùng thuật toán $A^*$ tìm đường đi ngắn nhất vòng qua các bàn học để tiến tới tọa độ ghế đó.
   - Khi nhân vật chạm tới ô ghế $\rightarrow$ Gửi gói tin `SIT_DOWN` lên Server $\rightarrow$ Chuyển sang trạng thái `SEATED`.
3. **`SEATED` (Đã ngồi vào bàn học):**
   - **Khóa hoàn toàn thao tác di chuyển** (bấm phím WASD hay click ra ngoài bản đồ đều không làm nhân vật chạy đi, giúp người dùng thoải mái thao tác với Video và Bảng bài tập).
   - Nhân vật đổi sang hoạt ảnh (Sprite) ngồi quay mặt vào bàn học.
   - Hiển thị giao diện **Không gian Bàn học (Table Workspace)**.
   - Chỉ khi người dùng chủ động bấm nút **"Đứng dậy rời bàn"** (hoặc phím `ESC` có xác nhận), nhân vật mới chuyển về `FREE_ROAM`.

#### B. Quy tắc Ưu tiên Điều khiển (Input Priority Rule)
- Khi nhân vật đang di chuyển tự động theo đường tìm được của lệnh Click chuột/Chạm màn hình (`PathFollowing`), nếu người dùng nhấn bất kỳ phím di chuyển nào (`W, A, S, D` hoặc phím mũi tên), hệ thống lập tức **hủy lộ trình tự động (`clearPath()`)** và nhường quyền điều khiển tức thời cho bàn phím.

---

### 3.3. Cơ chế Bàn học & Phân quyền Trưởng bàn (Table Host & Permission System)

Mỗi bàn học trong phòng có sức chứa cố định (ví dụ: bàn 2 người, bàn 4 người, bàn 6 người).

#### A. Quy tắc Chiếm ghế & Xác định Trưởng bàn (`TABLE_HOST`)
1. **Người ngồi đầu tiên:** Khi một bàn đang trống hoàn toàn ($0$ người ngồi), người đầu tiên chuyển sang trạng thái `SEATED` tại bàn đó sẽ tự động được gán quyền **Trưởng bàn (`TABLE_HOST`)** kèm biểu tượng vương miện/ngôi sao nhỏ cạnh tên.
2. **Quyền hạn mặc định:**
   - **`TABLE_HOST` (Trưởng bàn):** Có toàn quyền đổi video YouTube, Play/Pause/Tua video, đăng/xóa trang ảnh bài tập, xóa toàn bộ nét vẽ trên bảng, và duyệt quyền cho thành viên khác.
   - **`MEMBER` (Thành viên cùng bàn):** Được xem video đồng bộ, chat trong bàn, thả biểu cảm. Mặc định bị giới hạn quyền đổi video hoặc xóa bài tập (trừ khi được Trưởng bàn cấp quyền hoặc Trưởng bàn bật chế độ *"Tự do hợp tác"*).
   - **`CO_HOST` (Người được cấp quyền):** Có quyền điều khiển Video và Bảng bài tập tương đương Trưởng bàn trong suốt thời gian ngồi tại bàn.

#### B. Luồng Xin quyền & Chuyển giao Quyền (Permission Handshake)
1. **Xin quyền điều khiển (`REQUEST_CONTROL`):**
   - Khi một `MEMBER` muốn bật video mới hoặc đăng/chữa bài tập, họ bấm nút **"Xin quyền điều khiển / Giảng bài"** trên giao diện bàn.
   - Trưởng bàn sẽ nhận được một thông báo nhỏ (Toast/Popover): *"Bạn [Tên] muốn xin quyền điều khiển bảng & video"* với 2 nút: **[Chấp nhận]** hoặc **[Từ chối]**.
   - Nếu Trưởng bàn bấm **[Chấp nhận]**, thành viên đó được nâng lên `CO_HOST` ngay lập tức.
2. **Chế độ "Mở quyền cho cả bàn" (Toggle Free Collaboration):**
   - Trưởng bàn có một nút gạt nhanh: *"Cho phép mọi người trong bàn cùng chỉnh sửa"*. Khi bật nút này, mọi người ngồi vào bàn đều mặc định có quyền `CO_HOST`.
3. **Tự động kế thừa khi Trưởng bàn đứng dậy (Auto-Host Succession):**
   - Nếu Trưởng bàn bấm *"Đứng dậy rời bàn"* hoặc mất kết nối quá $30\text{ giây}$, hệ thống tự động chuyển quyền `TABLE_HOST` cho người đang có quyền `CO_HOST` (hoặc người ngồi lâu thứ hai tại bàn đó).
   - Nếu người cuối cùng rời bàn (số người ngồi về $0$), bàn trở về trạng thái trống hoàn toàn và giải phóng toàn bộ dữ liệu tạm.

---

### 3.4. Các Công cụ Học tập Đồng bộ tại Bàn (Table Workspace Features)

#### A. Cùng Xem Video (Synced YouTube Player)
- **Cơ chế hoạt động:** Sử dụng `YouTube IFrame API`. Server chỉ lưu trữ và đồng bộ trạng thái siêu dữ liệu (`videoId`, `isPlaying`, `currentTimestamp`, `updatedAtEpoch`), không truyền tải luồng media qua server.
- **Đồng bộ chống giật (Drift Tolerance):**
  - Khi `HOST` hoặc `CO_HOST` bấm Play, Pause, hoặc Tua, gói tin WebSocket được bắn tới toàn bộ người ngồi cùng bàn.
  - Khi một người mới ngồi vào bàn đang phát video, thời gian thực tế cần tua tới được tính theo công thức:
    $$T_{\text{current}} = T_{\text{saved}} + \frac{\text{Epoch}_{\text{now}} - \text{Epoch}_{\text{updated}}}{1000}$$
  - Nếu độ lệch thời gian giữa máy khách và chuẩn chung nhỏ hơn ngưỡng $\Delta t = 2.0\text{ giây}$, trình phát giữ nguyên để tránh hiện tượng giật hình; nếu $\Delta t \ge 2.0\text{ giây}$, tự động gọi `player.seekTo(T_current)`.
- **Hỗ trợ nghe nền (Background Playback):** Khi người dùng chuyển sang tab khác để làm bài hoặc tắt màn hình điện thoại, bộ đếm thời gian học và trình phát vẫn duy trì đồng bộ dựa trên mốc thời gian thực (`System Timestamp`) thay vì phụ thuộc vào `setInterval` của trình duyệt.

#### B. Bảng chiếu Bài tập Tạm thời & Giảng bài (Ephemeral Homework Board)
- **Đăng ảnh bài tập nhanh:**
  - Hỗ trợ chọn file ảnh (`.jpg`, `.png`, `.webp` tối đa $5\text{MB}$) hoặc bấm `Ctrl + V` để dán trực tiếp ảnh chụp màn hình bài tập lên bảng.
  - Một bàn hỗ trợ tối đa $5$ trang bài tập (Slides) cùng lúc để dễ chuyển qua lại.
- **Vẽ và Chú thích Thời gian thực (Realtime Annotations):**
  - Trên bề mặt ảnh bài tập là một lớp Canvas tương tác hỗ trợ: **Bút vẽ tự do (Pen)**, **Bút dạ quang (Highlighter)**, **Hộp văn bản (Text/Công thức ngắn)**, **Con trỏ Laser (Laser Pointer)** chỉ vị trí đang giảng, và **Tẩy (Eraser)**.
  - Mỗi nét vẽ hoàn thành sẽ được chuẩn hóa tọa độ theo tỷ lệ phần trăm ($0.0 \rightarrow 1.0$) so với kích thước ảnh gốc để hiển thị chuẩn xác trên cả màn hình máy tính lẫn điện thoại.
- **Chính sách Lưu trữ Tạm thời (Ephemeral Storage Policy):**
  - Ảnh bài tập chỉ phục vụ cho phiên thảo luận hiện tại, lưu trong thư mục tạm (Local Docker Volume `/tmp/homework-uploads` hoặc MinIO bucket có Lifecycle Rule).
  - **Cơ chế tự hủy:** Ngay khi người cuối cùng đứng dậy rời khỏi bàn (hoặc sau tối đa $6\text{ giờ}$ kể từ lúc tải lên), Backend lập tức xóa file ảnh vật lý và xóa dữ liệu bảng vẽ khỏi Redis để giải phóng $100\%$ dung lượng lưu trữ.

#### C. Giao tiếp & Tương tác Học tập (Social & Gamification)
- **Chat 2 tầng:**
  - *Chat Bàn (Table Chat):* Kênh thảo luận riêng tư của những người ngồi chung bàn, hỗ trợ gửi tin nhắn văn bản và biểu tượng cảm xúc.
  - *Chat Phòng (Room Chat):* Tin nhắn hiển thị cho cả phòng kèm **bong bóng hội thoại (Chat Bubble)** nổi lên ngay trên đầu nhân vật trong $4\text{ giây}$.
- **Tín hiệu Cầu cứu Bài tập (SOS Indicator):**
  - Trưởng bàn có thể bật trạng thái **"Đang bí bài 🆘"** kèm tên môn học (VD: *"Cần giúp Toán cao cấp"*).
  - Ngoài bản đồ 2D, phía trên bàn học đó sẽ phát sáng biểu tượng SOS để những người đang ở trạng thái `FREE_ROAM` nhìn thấy và ghé vào bàn hỗ trợ.
- **Lộ trình Nâng cấp Âm thanh (Phase 2 Ready):**
  - Kiến trúc WebSocket tại mỗi bàn được thiết kế sẵn kênh tín hiệu (`Signaling Channel`) để dễ dàng tích hợp **WebRTC Voice Chat (Mesh/LiveKit)** ở giai đoạn nâng cấp tiếp theo mà không phải sửa lại cấu trúc bàn.

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU (MYSQL & REDIS)

### 4.1. Cấu trúc Bảng MySQL (Dữ liệu bền vững)

```sql
-- 1. Bảng Người dùng (Hỗ trợ nâng cấp từ Guest lên Registered)
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,              -- UUID
    email VARCHAR(255) UNIQUE NULL,          -- NULL nếu vẫn là tài khoản tạm chưa liên kết
    nickname VARCHAR(50) NOT NULL,
    avatar_sprite_id VARCHAR(50) DEFAULT 'student_default_01',
    auth_provider ENUM('GUEST', 'LOCAL', 'GOOGLE') DEFAULT 'GUEST',
    total_study_minutes BIGINT DEFAULT 0,    -- Tổng số phút ngồi bàn tích lũy
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Bảng Lịch sử Phiên học (Ghi nhận khi người dùng đứng dậy rời bàn)
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

-- 3. Bảng Danh mục Trang phục / Vật phẩm mở khóa bằng giờ học
CREATE TABLE character_items (
    id VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    item_type ENUM('SKIN', 'HAT', 'DESK_PET') NOT NULL,
    required_study_minutes INT DEFAULT 0     -- Số phút học cần đạt để mở khóa
);
```

### 4.2. Cấu trúc Dữ liệu trên Redis (In-Memory Realtime State)

| Redis Key Pattern | Kiểu dữ liệu | Nội dung lưu trữ & Cơ chế TTL |
| :--- | :--- | :--- |
| `room:{roomId}:players` | `HASH` | Map `userId` $\rightarrow$ JSON `{ nickname, avatarId, x, y, dir, state, tableId, seatId, studyGoal, sitStartTime }`. |
| `room:{roomId}:seats` | `HASH` | Map `seatId` (VD: `T1_S1`) $\rightarrow$ `userId`. Dùng lệnh nguyên tử `HSETNX` để chống 2 người ngồi trùng 1 ghế. |
| `table:{tableId}:state` | `STRING (JSON)` | Lưu trạng thái chung của bàn: `hostUserId`, danh sách `coHostIds`, `isFreeCollab`, trạng thái `videoSync`, trạng thái `sosTopic`, và danh sách `homeworkSlides`. Tự động xóa (`DEL`) khi bàn trống. |
| `ephemeral:img:{imageId}` | `STRING` | Lưu đường dẫn file ảnh tạm kèm `EXPIRE 21600` ($6\text{ giờ}$) để đảm bảo luôn tự dọn rác. |

#### Mẫu JSON `table:{tableId}:state` trên Redis:
```json
{
  "tableId": "table_01",
  "hostUserId": "u-9823-abcd",
  "coHostUserIds": ["u-1122-efgh"],
  "isFreeCollab": false,
  "sosBanner": "Cần giảng giúp bài Tích phân từng phần",
  "videoState": {
    "videoId": "jfKfPfyJRdk",
    "isPlaying": true,
    "currentTime": 420.5,
    "lastUpdatedEpoch": 1762900000123
  },
  "activeSlideId": "slide_01",
  "homeworkSlides": [
    {
      "slideId": "slide_01",
      "imageUrl": "/api/v1/ephemeral-files/hw_table01_8891.webp",
      "uploadedBy": "u-9823-abcd",
      "strokes": [
        {
          "strokeId": "st_1",
          "tool": "PEN",
          "color": "#FF3B30",
          "width": 3,
          "points": [[0.12, 0.34], [0.15, 0.38], [0.20, 0.42]]
        }
      ]
    }
  ]
}
```

---

## 5. ĐẶC TẢ GIAO THỨC WEBSOCKET & REST API

### 5.1. Danh sách Kênh WebSocket (STOMP Endpoints)

#### Luồng Cả Phòng (Room Scope - Ai trong phòng cũng nhận được):
- **Client gửi lên:**
  - `/app/room/{roomId}/move`: Gửi sự kiện di chuyển (khi bấm phím WASD hoặc tọa độ đích khi chạm màn hình).
  - `/app/room/{roomId}/seat.sit`: Yêu cầu ngồi vào một chiếc ghế (`{ tableId, seatId }`).
  - `/app/room/{roomId}/seat.leave`: Đứng dậy rời khỏi bàn học.
  - `/app/room/{roomId}/chat`: Gửi tin nhắn chat chung hoặc thả biểu cảm bay trên đầu.
- **Client lắng nghe (Subscribe):**
  - `/topic/room/{roomId}/events`: Nhận cập nhật di chuyển của người chơi khác, trạng thái ai vừa ngồi/đứng dậy, ai trở thành Trưởng bàn mới, và trạng thái bật/tắt biển báo SOS của các bàn.

#### Luồng Riêng Từng Bàn (Table Scope - Chỉ Subscribe khi `state === SEATED` tại bàn đó):
- **Client gửi lên:**
  - `/app/table/{tableId}/permission.request`: Thành viên xin quyền điều khiển từ Trưởng bàn.
  - `/app/table/{tableId}/permission.respond`: Trưởng bàn chấp nhận/từ chối cấp quyền (`GRANT` / `DENY`) hoặc chuyển nhượng quyền Trưởng bàn (`TRANSFER_HOST`).
  - `/app/table/{tableId}/video.sync`: Cập nhật trạng thái YouTube (`PLAY`, `PAUSE`, `SEEK`, `CHANGE_URL`). *(Backend kiểm tra người gửi phải là `HOST` hoặc `CO_HOST`)*.
  - `/app/table/{tableId}/board.draw`: Gửi nét vẽ mới, con trỏ Laser hoặc xóa nét vẽ trên ảnh bài tập.
  - `/app/table/{tableId}/chat`: Tin nhắn trò chuyện nội bộ trong bàn.
- **Client lắng nghe (Subscribe):**
  - `/topic/table/{tableId}/workspace`: Nhận toàn bộ sự kiện đồng bộ Video, Bảng bài tập, Phân quyền và Chat bàn.

### 5.2. Các REST API Chính
1. `POST /api/v1/auth/guest`: Khởi tạo phiên Guest nhanh hoặc khôi phục phiên từ `guestToken`.
2. `POST /api/v1/auth/upgrade`: Liên kết tài khoản Guest hiện tại với tài khoản Google/Email và gộp số giờ học.
3. `GET /api/v1/rooms/{roomId}/state`: Lấy toàn bộ snapshot hiện tại của phòng (danh sách người chơi, ghế đã có chủ, trạng thái SOS của các bàn) ngay khi vừa vào phòng.
4. `POST /api/v1/tables/{tableId}/homework-image`: Upload ảnh bài tập tạm thời (kiểm tra quyền `HOST`/`CO_HOST`, nén sang định dạng `.webp` và phát sự kiện WebSocket `NEW_SLIDE` cho cả bàn).

---

## 6. CẤU TRÚC THƯ MỤC DỰ ÁN & QUY CHUẨN KỸ THUẬT

```text
cung-nhau-hoc-bai/
├── docker-compose.yml                  # Khởi chạy MySQL, Redis, Backend, Frontend
├── backend/                            # Spring Boot 3.x (Java 21)
│   ├── src/main/java/com/studytogether/
│   │   ├── config/                     # WebSocketConfig, RedisConfig, SecurityConfig
│   │   ├── modules/
│   │   │   ├── auth/                   # Hybrid Guest + OAuth2 Service & Controller
│   │   │   ├── room/                   # Quản lý di chuyển, khóa ghế (Redis HSETNX)
│   │   │   ├── table/                  # Quản lý Host Permission, Video Sync, Whiteboard
│   │   │   ├── storage/                # Lưu & tự động xóa ảnh bài tập tạm thời
│   │   │   └── stats/                  # Tính toán & lưu lịch sử giờ học (Study Sessions)
│   └── Dockerfile
└── frontend/                           # ReactJS (Vite + TailwindCSS)
    ├── src/
    │   ├── game/                       # Toàn bộ logic Phaser 3 (Tách biệt khỏi UI)
    │   │   ├── scenes/ClassroomScene.ts
    │   │   ├── entities/PlayerSprite.ts
    │   │   └── pathfinding/GridPathfinder.ts
    │   ├── components/
    │   │   ├── hud/                    # TopBar, RoomChat, CharacterCustomizer
    │   │   └── workspace/              # TableModal, SyncedYouTube, HomeworkCanvas, HostControls
    │   ├── stores/                     # Zustand (useGameStore, useTableStore, useAuthStore)
    │   ├── hooks/                      # useWebSocket, useBackgroundTimer
    │   └── services/                   # Axios client & TanStack Query hooks
    └── Dockerfile
```

### Quy chuẩn Tối ưu & Vận hành (Engineering Standards)
- **Tách biệt trách nhiệm (Modular Architecture):** Mỗi file mã nguồn giữ cấu trúc nhỏ gọn, rõ ràng một nhiệm vụ duy nhất (tách riêng Scene của Phaser, Store của Zustand và Component của React).
- **Xử lý Mất kết nối tạm thời (Grace Period):** Khi người dùng đang là `TABLE_HOST` mà bị rớt mạng hoặc tải lại trang (F5), Redis giữ chỗ ngồi và quyền Trưởng bàn trong đúng **$30\text{ giây}$**. Nếu kết nối lại trong thời gian này, người dùng tiếp tục ngồi đúng ghế cũ mà không mất quyền hay mất ảnh bài tập.
- **Giới hạn Gói tin (Network Throttling):** Sự kiện di chuyển bằng bàn phím và sự kiện di chuyển con trỏ Laser trên bảng bài tập được giới hạn tần suất gửi (Throttle) ở mức $10\text{ gói tin/giây}$ ($100\text{ms}$), kết hợp nội suy tuyến tính (`Lerp`) ở phía Client để mượt mà ở $60\text{ FPS}$ nhưng tiết kiệm băng thông tối đa.

---

## 7. LỘ TRÌNH TRIỂN KHAI (IMPLEMENTATION ROADMAP)

### Giai đoạn 1: Core Gameplay & Hạ tầng (Tuần 1 - 2)
- Thiết lập `docker-compose.yml` (MySQL, Redis) và khung dự án Spring Boot + React Vite.
- Xây dựng bản đồ lớp học 2D góc nhìn 3/4 Top-Down với Phaser 3; hoàn thiện điều khiển kép (**WASD** + **Chạm màn hình tìm đường $A^*$**) và Máy trạng thái nhân vật (`FREE_ROAM` $\leftrightarrow$ `WALKING_TO_SEAT` $\leftrightarrow$ `SEATED`).
- Hoàn thiện hệ thống **Hybrid Auth** (vào nhanh bằng Guest, nâng cấp tài khoản sau) và đồng bộ vị trí nhân vật qua WebSocket + Redis.

### Giai đoạn 2: Không gian Bàn học & Phân quyền Trưởng bàn (Tuần 3 - 4)
- Triển khai cơ chế **Trưởng bàn (`TABLE_HOST`)**, luồng **Xin quyền / Duyệt quyền (`CO_HOST`)** và tự động chuyển quyền khi Trưởng bàn rời ghế.
- Tích hợp **Synced YouTube Player** và **Bảng chiếu bài tập tạm thời (Ephemeral Homework Board)** hỗ trợ dán ảnh `Ctrl + V`, vẽ chú thích trực tiếp và tự động xóa file khi bàn trống.
- Hoàn thiện Chat 2 tầng (Chat bàn & Bong bóng chat trên đầu nhân vật) + Tín hiệu SOS cầu cứu bài tập.

### Giai đoạn 3: Gamification & Nâng cấp Voice Chat (Tuần 5+)
- Bổ sung bảng xếp hạng giờ học (Study Leaderboard), mở khóa trang phục nhân vật/thú cưng để bàn dựa trên số phút tích lũy.
- Tích hợp **WebRTC Voice Chat** cho phép các thành viên trong bàn bật mic thảo luận trực tiếp.