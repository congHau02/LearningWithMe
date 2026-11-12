# Dùng chung cấu hình Map JSON tĩnh làm nguồn sự thật duy nhất cho sơ đồ Bàn và Ghế

Để người học có thể bước thẳng vào Room mặc định (`main-library`) mà không cần qua màn hình chọn phòng phức tạp và giúp Backend xác thực nhanh các yêu cầu chiếm ghế (`HSETNX`) mà không phải truy vấn MySQL, chúng tôi quyết định định nghĩa toàn bộ cấu trúc không gian của Room — bao gồm tọa độ lưới, danh sách `tableId`, `seatId` và sức chứa từng Table — trong một file cấu hình Map JSON tĩnh dùng chung cho cả Frontend (Phaser 3 Tilemap) và Backend (Spring Boot Room/Seat Validator).
