# Cô lập kênh STOMP của Table theo Room Shard, thu hồi quyền nhận tin khi rời ghế và định tuyến riêng tín hiệu WebRTC

Trong các giai đoạn đầu, kênh sự kiện bàn học được định danh phẳng theo `/topic/table/{tableId}/workspace`, quyền đăng ký chỉ kiểm tra một lần tại thời điểm `SUBSCRIBE`, và toàn bộ tín hiệu bắt tay WebRTC (`SDP_OFFER`, `SDP_ANSWER`, `ICE_CANDIDATE` chứa địa chỉ IP của máy trạm) đều phát chung vào kênh bàn học. Khi hệ thống tự động mở nhiều Room Shard (`main-library`, `main-library-2`, ...) cùng dùng chung định danh `table_01..table_03` (ADR-0003, ADR-0006), thiết kế này khiến gói tin bàn học bị phát chéo giữa các Room Shard, người đã rời ghế nhưng giữ kết nối STOMP vẫn nhận được nội dung bàn cũ, và mọi thành viên trong bàn đều thấy các ứng viên ICE của những cặp kết nối khác.

Chúng tôi quyết định:
1. Phân vùng kênh STOMP của Table Workspace theo cả `roomId` và `tableId` (`/topic/room/{roomId}/table/{tableId}/workspace`) và kiểm tra/hủy đăng ký phía máy chủ ngay khi người học không còn ở trạng thái `SEATED` tại bàn đó.
2. Tách các gói tin thiết lập kết nối P2P một-đối-một (`SDP_OFFER`, `SDP_ANSWER`, `ICE_CANDIDATE`) sang hàng đợi riêng tư của đúng người nhận (`/user/queue/voice`), chỉ giữ lại trạng thái bật/tắt micro (`MUTE_STATUS`) phát chung trên kênh của Table Workspace.
