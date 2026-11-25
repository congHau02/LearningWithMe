# Cùng Nhau Học Bài (Study Together 2D Web Game)

Không gian học tập trực tuyến 2D góc nhìn 3/4 Top-Down, nơi người học điều khiển nhân vật trong phòng học ảo, ngồi vào bàn học để cùng xem video đồng bộ, giải bài tập trên bảng chung và trò chuyện theo thời gian thực.

## Không gian & Di chuyển (Space & Navigation)

**Room (Phòng học)**:
Một không gian bản đồ 2D độc lập chứa các bàn học, ghế ngồi và những người học đang hiện diện cùng lúc.
_Avoid_: Channel, Server, World, Lobby

**Room Shard (Phân mảnh phòng học)**:
Một bản sao vận hành độc lập của Room mặc định được tự động mở thêm khi chạm ngưỡng sức chứa tối đa (50 người học) để giữ không gian bản đồ thông thoáng.
_Avoid_: Sub-room, Instance, Lobby Shard

**Room Snapshot (Ảnh chụp trạng thái phòng)**:
Bản tổng hợp tức thời toàn bộ người học đang hiện diện, các Seat đã có chủ, thông tin Table Host và các SOS Banner đang bật tại thời điểm bước vào Room.
_Avoid_: Initial State, Room Dump, Bootstrap Payload

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

**Study Café (Quán nước học bài)**:
Không gian thiết kế chủ đạo của Room mặc định, kết hợp khu vực các Table học tập với quầy pha chế, kệ sách và góc thư giãn ấm cúng.
_Avoid_: Coffee Shop Room, Cafe Map, Lounge Server

**Ambient NPC (Nhân vật nền / Nhân viên quán)**:
Nhân vật tự động (nhân viên pha chế, phục vụ, thu ngân) di chuyển và tương tác nhẹ nhàng trong Room để tạo sức sống cho không gian mà không chiếm Seat hay cản đường đi của người học.
_Avoid_: Bot, AI Player, Remote Player, Dummy User

## Định danh & Phân quyền (Identity & Permissions)

**Guest (Khách học)**:
Người học tham gia ngay vào Room bằng định danh tạm thời mà chưa liên kết với tài khoản định danh lâu dài.
_Avoid_: Anonymous User, Visitor, Trial User

**Registered User (Thành viên chính thức)**:
Người học đã xác thực qua tài khoản định danh lâu dài để lưu trữ vĩnh viễn lịch sử học tập và vật phẩm mở khóa.
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

**Table Lock (`isTableLocked` / Khóa bàn học)**:
Chế độ riêng tư của một Table do Table Host bật nhằm ngăn người học đang ở trạng thái Free Roam tự ý ngồi vào bàn khi không đi qua Table Invite Link hợp lệ của bàn đó.
_Avoid_: Private Room, Password Table, VIP Table, Seat Reservation

## Công cụ Học tập & Tương tác (Study Tools & Social)

**Table Invite Link (Liên kết mời vào bàn)**:
Liên kết chia sẻ trực tiếp đưa người được mời vào đúng Room Shard và tự động dẫn tới một Seat trống của Table mục tiêu, kể cả khi bàn đang bật Table Lock.
_Avoid_: Room Invite, Share URL, Deep Link, Join Code

**Table Workspace (Không gian bàn học)**:
Tổ hợp giao diện học tập chung chỉ mở ra cho những người đang `SEATED` tại cùng một Table, bao gồm trình phát video đồng bộ, bảng bài tập tạm thời và trò chuyện bàn.
_Avoid_: Study Modal, Table Dashboard, Classroom View

**Clear View (Chế độ rõ ràng)**:
Cách hiển thị cá nhân của Table Workspace chỉ gồm Homework Slide và trò chuyện bàn, lược bỏ video và các công cụ phụ; mặc định bật trên điện thoại.
_Avoid_: Focus Mode, Chế độ tập trung, Zen Mode, Board View

**Curriculum Mode (Chế độ cấp học Toán)**:
Chế độ hiển thị cá nhân điều chỉnh bộ ký hiệu toán học, mẫu giấy nháp và công cụ tính toán trong Table Workspace theo đúng chương trình học (ưu tiên Toán THCS cấp 2 hoặc mở rộng sang Toán THPT/Đại học).
_Avoid_: Grade Filter, Difficulty Mode, Student Tier, Math Level

**Homework Slide (Trang bài tập)**:
Một trang làm việc tạm thời trong Table Workspace (tối đa 5 trang mỗi Table) được khởi tạo từ ảnh đề bài tải lên hoặc mẫu giấy nháp toán dựng sẵn (lưới ô vuông, hệ trục tọa độ, trục số, bảng trơn), tự động hủy khi Table không còn người ngồi.
_Avoid_: Whiteboard Page, Attachment, Document

**Stroke (Nét vẽ chú thích)**:
Một đơn vị hình họa (bút viết tay, dạ quang, hình học phẳng, ký hiệu góc và đoạn bằng nhau, nhãn đỉnh/chữ hoặc công thức toán) được vẽ đè lên một Homework Slide và tồn tại suốt vòng đời của trang bài tập đó.
_Avoid_: Drawing, Path, Mark

**Math Scratchpad (Sổ nháp bước giải)**:
Khung ghi chú biến đổi đại số và công thức toán đồng bộ theo thời gian thực giữa những người đang `SEATED` tại cùng một Table, hiển thị song song với Homework Slide.
_Avoid_: Formula Note, Math Doc, Equation Sidebar

**Function Grapher (Bộ vẽ đồ thị hàm số)**:
Công cụ dựng đồ thị toán học trong Table Workspace cho phép khảo sát hàm số và xuất trực tiếp mặt phẳng đồ thị thành một Homework Slide để cả bàn cùng vẽ chú thích.
_Avoid_: Plotter, Chart Builder, Calculator Graph

**Laser Pointer (Con trỏ giảng bài)**:
Tín hiệu chỉ điểm tức thời di chuyển trên bề mặt Homework Slide để thu hút sự chú ý của người cùng bàn mà không lưu lại thành Stroke.
_Avoid_: Cursor, Highlighter

**SOS Banner (Tín hiệu cầu cứu bài tập)**:
Biển báo trạng thái gắn trên một Table kèm chủ đề môn học nhằm thông báo cho những người đang ở trạng thái Free Roam trong Room biết bàn này cần người vào giảng giúp.
_Avoid_: Help Ticket, Alert, Question Flag

**Quick Check (Phản hồi nhanh tại bàn)**:
Tín hiệu trạng thái học tập ngắn gọn một chạm của người đang `SEATED` (đã hiểu bài, cần giảng chậm lại, hoặc giơ tay xin nói) hiển thị tức thời cho cả Table mà không làm trôi luồng thảo luận.
_Avoid_: Poll, Quiz, Raise Hand Queue, Chat Reaction

**Study Pack (Vở bài giảng xuất file)**:
Bản tổng hợp tài liệu buổi học được kết xuất trực tiếp về thiết bị của người học (gộp các Homework Slide kèm toàn bộ Stroke và các bước giải trong Math Scratchpad) trước khi dữ liệu tạm của Table tự hủy khi bàn trống.
_Avoid_: Cloud Notebook, Saved Session, Lesson Archive, Board Backup

**Study Session (Phiên ngồi học)**:
Một khoảng thời gian liên tục được ghi nhận từ lúc người học chuyển sang trạng thái `SEATED` tại một Table cho đến khi họ rời ghế (đạt ngưỡng thời lượng tối thiểu).
_Avoid_: Study Log, Pomodoro, Attendance

**Room Chat (Trò chuyện toàn phòng)**:
Kênh nhắn tin công khai và thả biểu cảm dành cho mọi người học đang hiện diện trong cùng một Room Shard, tách biệt với trò chuyện nội bộ của từng Table.
_Avoid_: Global Chat, World Chat, Public Chat, Lobby Chat

**Chat Bubble (Bong bóng hội thoại)**:
Khung thông điệp tạm thời nổi lên phía trên nhân vật trên bản đồ 2D trong thời gian ngắn (4 giây) mỗi khi người học gửi tin nhắn hoặc biểu cảm qua Room Chat.
_Avoid_: Toast Chat, Speech Popover, Overhead Label

**Study Goal (Mục tiêu học tập)**:
Mục tiêu cá nhân ngắn gọn mà người học đặt ra cho phiên học trong ngày và có thể đánh dấu hoàn thành ngay khi đang học.
_Avoid_: Task, Todo Item, Status Message

**Study Streak (Chuỗi ngày học)**:
Số ngày liên tiếp mà một người học hoàn thành ít nhất một Study Session hợp lệ.
_Avoid_: Attendance Streak, Login Streak, Combo

**Ambient Soundscape (Âm thanh nền học tập)**:
Lớp âm thanh môi trường đa tầng và giai điệu không lời phát lặp nhẹ nhàng (tiếng mưa, quán nước, lò sưởi, tiếng ồn trắng, giai điệu Lofi) do từng người học tự bật và pha trộn cho không gian nghe cá nhân.
_Avoid_: Background Music, BGM, Audio Track

**Study SFX (Âm thanh phản hồi học tập)**:
Các tín hiệu âm thanh ngắn, êm dịu phát tại máy cá nhân khi diễn ra sự kiện học tập hoặc tương tác trong Study Café (hoàn thành Study Goal, ngồi ghế, nhận Drink Delivery), độc lập với Ambient Soundscape.
_Avoid_: UI Sound, Game SFX, Notification Beep

**Ambience Mood (Bầu không khí quán)**:
Chế độ ánh sáng và sắc độ hiển thị cá nhân của Study Café trong dải dịu mắt Botanical Night Studio (Hoàng hôn ấm, Đêm tập trung, Đêm mưa), tự gợi ý theo giờ thiết bị hoặc do từng người học tự chọn mà không ảnh hưởng người khác.
_Avoid_: Day/Night Cycle, Lighting Preset, Weather Toggle, Theme Mode

**Graphics Quality (Mức chất lượng đồ họa)**:
Cấp độ hiển thị cá nhân của bản đồ Study Café (`Thấp`, `Trung bình`, `Cao`) quyết định mật độ ánh sáng động, hạt môi trường và hiệu ứng chuyển động bổ trợ nhằm giữ trải nghiệm mượt trên mọi thiết bị.
_Avoid_: Performance Mode, Visual Tier, FPS Setting

**Drink Delivery (Giao đồ uống tại quán)**:
Hành trình một Ambient NPC di chuyển qua quầy pha chế tới vị trí của người học trong Study Café để trao biểu tượng đồ uống đồng hành sau khi người học chọn món.
_Avoid_: Beverage Spawn, Instant Drink, Order Dispatch
