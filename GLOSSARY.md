# Cùng Nhau Học Bài (Study Together 2D Web Game)

Không gian học tập trực tuyến 2D góc nhìn 3/4 Top-Down, nơi người học điều khiển nhân vật trong phòng học ảo, ngồi vào bàn học để cùng xem video đồng bộ, giải bài tập trên bảng chung và trò chuyện theo thời gian thực.

## Không gian & Di chuyển (Space & Navigation)

**Room (Phòng học)**:
Một không gian bản đồ 2D độc lập chứa các bàn học, ghế ngồi và những người học đang hiện diện cùng lúc.
_Avoid_: Channel, Server, World, Lobby

**Table (Bàn học)**:
Một cụm các ghế ngồi được nhóm chung trong một Room, chia sẻ cùng một không gian làm việc (video đồng bộ, bảng bài tập, kênh trò chuyện nội bộ và tín hiệu cầu cứu).
_Avoid_: Desk, Group, Pod, Booth

**Seat (Ghế ngồi)**:
Một vị trí chỗ ngồi đơn lẻ thuộc về một Table cụ thể mà tại một thời điểm chỉ một người học có thể chiếm giữ.
_Avoid_: Chair, Slot, Spot

**Free Roam (`FREE_ROAM`)**:
Trạng thái nhân vật đang đi lại tự do trong Room và chưa gắn với bất kỳ Seat hay Table nào.
_Avoid_: Idle, Walking, Roaming, Wandering

**Walking to Seat (`WALKING_TO_SEAT`)**:
Trạng thái chuyển tiếp khi nhân vật đang tự động di chuyển theo lộ trình tìm đường hướng tới một Seat trống đã chọn nhưng chưa thực sự chiếm ghế đó.
_Avoid_: Pathfinding, Approaching, MovingToChair

**Seated (`SEATED`)**:
Trạng thái nhân vật đã chiếm giữ thành công một Seat tại một Table, bị khóa di chuyển trên bản đồ và đang tham gia vào Table Workspace của bàn đó.
_Avoid_: Studying, Occupied, Locked, InTable

**Grace Period (Thời gian giữ ghế tạm thời)**:
Khoảng thời gian ngắn (30 giây) mà hệ thống bảo lưu Seat và vai trò tại Table cho một người học đang `SEATED` khi họ bị mất kết nối đột ngột.
_Avoid_: Reconnect Timeout, Session Hold

## Định danh & Phân quyền (Identity & Permissions)

**Guest (Khách học)**:
Người học tham gia ngay vào Room bằng định danh tạm thời mà chưa liên kết với tài khoản định danh lâu dài.
_Avoid_: Anonymous User, Visitor, Trial User

**Registered User (Thành viên chính thức)**:
Người học đã xác thực qua tài khoản định danh lâu dài (Email hoặc OAuth2) để lưu trữ vĩnh viễn lịch sử học tập và vật phẩm mở khóa.
_Avoid_: Member, Logged-in User, Account

**Account Upgrade (Nâng cấp tài khoản)**:
Quá trình chuyển đổi từ Guest sang Registered User đồng thời hợp nhất toàn bộ thời gian học tập đã tích lũy trong phiên Guest mà không làm gián đoạn chỗ ngồi hiện tại.
_Avoid_: Account Linking, Guest Migration, Registration

**Table Host (`TABLE_HOST` / Trưởng bàn)**:
Người học giữ quyền quản trị cao nhất tại một Table (người đầu tiên ngồi vào bàn trống hoặc người được kế nhiệm), có quyền điều khiển công cụ học tập và phê duyệt quyền cho người khác.
_Avoid_: Table Admin, Room Owner, Leader, Moderator

**Co-Host (`CO_HOST` / Đồng điều khiển)**:
Người học ngồi cùng Table được Table Host cấp quyền (hoặc thông qua chế độ hợp tác tự do) để điều khiển video và bảng bài tập ngang với Table Host trong phiên ngồi đó.
_Avoid_: Editor, Presenter, Assistant

**Table Member (`MEMBER` / Thành viên cùng bàn)**:
Người học đang `SEATED` tại một Table với quyền mặc định là theo dõi video đồng bộ, xem bảng bài tập và trò chuyện nội bộ nhưng không tự ý thay đổi nội dung chung.
_Avoid_: Viewer, Spectator, Guest

**Auto-Host Succession (Kế nhiệm Trưởng bàn)**:
Cơ chế tự động chuyển giao vai trò Table Host cho một Co-Host hoặc Table Member ngồi lâu tiếp theo khi Table Host hiện tại rời bàn hoặc hết Grace Period.
_Avoid_: Host Failover, Admin Transfer

**Free Collaboration (`isFreeCollab` / Hợp tác tự do)**:
Chế độ của một Table do Table Host bật, cho phép mọi người học ngồi trong bàn đó mặc định có quyền tương đương Co-Host.
_Avoid_: Public Mode, Open Edit

## Công cụ Học tập & Tương tác (Study Tools & Social)

**Table Workspace (Không gian bàn học)**:
Tổ hợp giao diện học tập chung chỉ mở ra cho những người đang `SEATED` tại cùng một Table, bao gồm trình phát video đồng bộ, bảng bài tập tạm thời và trò chuyện bàn.
_Avoid_: Study Modal, Table Dashboard, Classroom View

**Homework Slide (Trang bài tập)**:
Một hình ảnh bài tập tạm thời được tải lên Table Workspace (tối đa 5 trang mỗi Table) làm nền cho các nét vẽ hướng dẫn giải bài và tự động hủy khi Table không còn người ngồi.
_Avoid_: Whiteboard Page, Attachment, Document

**Stroke (Nét vẽ chú thích)**:
Một đơn vị hình họa (bút viết, dạ quang, văn bản) được vẽ đè lên một Homework Slide và tồn tại suốt vòng đời của trang bài tập đó.
_Avoid_: Drawing, Path, Mark

**Laser Pointer (Con trỏ giảng bài)**:
Tín hiệu chỉ điểm tức thời di chuyển trên bề mặt Homework Slide để thu hút sự chú ý của người cùng bàn mà không lưu lại thành Stroke.
_Avoid_: Cursor, Highlighter

**SOS Banner (Tín hiệu cầu cứu bài tập)**:
Biển báo trạng thái gắn trên một Table kèm chủ đề môn học nhằm thông báo cho những người đang ở trạng thái Free Roam trong Room biết bàn này cần người vào giảng giúp.
_Avoid_: Help Ticket, Alert, Question Flag

**Study Session (Phiên ngồi học)**:
Một khoảng thời gian liên tục được ghi nhận từ lúc người học chuyển sang trạng thái `SEATED` tại một Table cho đến khi họ rời ghế (đạt ngưỡng thời lượng tối thiểu).
_Avoid_: Study Log, Pomodoro, Attendance
