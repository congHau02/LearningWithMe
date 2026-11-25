---
status: accepted
---

# Mở rộng `Stroke` Hình học Phẳng THCS Tĩnh, Khóa Bàn Tạm thời trên Redis và Kết xuất `Study Pack` Thuần Client-Side

Để tối ưu hóa **Table Workspace** cho kịch bản dạy kèm và học nhóm Toán THCS (Lớp 6–9) trên cả máy tính lẫn điện thoại mà không vi phạm kiến trúc lưu trữ tạm thời ([ADR-0002](./0002-native-canvas-normalized-homework-board.md), [ADR-0012](./0012-ephemeral-math-workspace-and-multilayer-procedural-audio.md)) hay trần tài nguyên hạ tầng Free Tier 0-đồng ([ADR-0007](./0007-free-tier-oracle-vercel-topology.md)), chúng tôi cần chốt mô hình dữ liệu cho bộ dựng hình phẳng, cơ chế riêng tư khi mời học sinh vào bàn và cách lưu lại bài chữa sau buổi học.

Chúng tôi quyết định:
1. **Biểu diễn Hình học Phẳng THCS dưới dạng `Stroke` chuẩn hóa tĩnh `[0.0, 1.0]` (Mở rộng ADR-0012)**: Các công cụ dựng hình cấp 2 (đường tròn tâm–bán kính có chấm tâm, tam giác, nét đứt kẻ đường phụ/gióng trục, ký hiệu góc vuông / cung góc bằng nhau / vạch cạnh bằng nhau, nhãn đỉnh tự tăng $A, B, C\dots$) hỗ trợ bắt điểm và khóa góc ngay trong lúc kéo vẽ ở Client, sau đó lưu thành **Stroke** bất biến gắn `authorUserId`. Chúng tôi chủ động không xây dựng đồ thị đối tượng ràng buộc động kiểu GeoGebra để giữ độ trễ bằng 0 trên di động, tương thích trọn vẹn với tẩy từng nét, hoàn tác theo người vẽ và giới hạn kích thước module.
2. **Thực thi `Table Lock` và `Table Invite Link` bằng trạng thái tạm thời gắn vòng đời `Table` trên Redis (Mở rộng ADR-0006 & ADR-0008)**: Khi **Table Host** bật **Table Lock**, trạng thái khóa và mã mời ngắn hạn chỉ tồn tại trong dữ liệu nóng của bàn trên Redis, được kiểm tra nguyên tử lúc chiếm **Seat** và cho phép ưu tiên đặt chỗ đúng **Room Shard** khi người được mời mở **Table Invite Link** (nếu phân mảnh còn chỗ). Khóa bàn được bảo toàn qua **Grace Period** 30 giây và **Auto-Host Succession**, nhưng tự động hủy sạch ngay khi bàn về `0` người ngồi mà không phát sinh bảng phân quyền lâu dài trong MySQL.
3. **Kết xuất `Study Pack` (PDF / Ảnh PNG) hoàn toàn ở phía trình duyệt (Bảo toàn ADR-0002 & ADR-0007)**: Trước khi rời ghế, người học xuất vở bài giảng trực tiếp trên thiết bị cá nhân bằng cách hợp nhất ảnh nền **Homework Slide**, toàn bộ lớp **Stroke** (kể cả công thức $\LaTeX$) và các bước biến đổi trong **Math Scratchpad** thành tệp PDF hoặc PNG tải về máy. Dữ liệu trên máy chủ vẫn xóa tức thì khi bàn trống, giữ chi phí lưu trữ đám mây bằng `0`.

## Considered Options
- **Đồ thị hình học ràng buộc động kiểu GeoGebra**: Loại bỏ vì làm phình payload đồng bộ STOMP, phức tạp hóa xung đột đa người dùng (`Free Collaboration`), khó thao tác bằng ngón tay trên màn hình `375px` và vượt trần dòng trên mỗi module.
- **Lưu vở bài giảng và danh sách quyền truy cập bàn xuống MySQL / Object Storage**: Loại bỏ vì phá vỡ cam kết dữ liệu bài tập tự hủy của ADR-0002 và nhanh chóng chạm giới hạn dung lượng lưu trữ miễn phí của ADR-0007.

## Consequences
- Trình kết xuất **Homework Slide** ở Client cần dùng chung một hàm vẽ hợp nhất (ảnh nền + **Stroke** hình học + lớp công thức $\LaTeX$) cho cả hiển thị trực tiếp lẫn xuất **Study Pack** để đảm bảo độ khớp thị giác 100%.
- Phép phóng to / kéo vùng nhìn (`Zoom & Pan`) trên **Homework Slide** được giữ ở trạng thái khung nhìn cá nhân tại Client, chuyển đổi ngược qua hệ tọa độ chuẩn hóa `[0.0, 1.0]` trước khi phát gói tin để không làm lệch nét vẽ giữa màn hình máy tính của giáo viên và điện thoại của học sinh.
