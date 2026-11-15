# Triển khai Production bằng Vercel Frontend kết hợp Oracle Always Free ARM VM, Caddy và DuckDNS

Để đưa **Cùng Nhau Học Bài** lên HTTPS công khai với chi phí hạ tầng bằng 0 cho tối đa ~50 người học đồng thời mà vẫn giữ nguyên kiến trúc Stateful đơn nút (In-Memory STOMP Broker, Redis Hot State và Grace Period 30 giây), chúng tôi quyết định tách Frontend tĩnh lên **Vercel Hobby** (deploy qua Git integration với `VITE_API_BASE_URL` và `VITE_WS_BASE_URL`) và chạy toàn bộ Backend (`Spring Boot`, `MySQL 8.0`, `Redis 7` bật AOF, `Caddy` TLS reverse proxy tự động cho subdomain `DuckDNS`) trên một máy ảo **Oracle Cloud Always Free ARM (`VM.Standard.A1.Flex`)** qua Docker Compose. Tên miền được cấu hình hoàn toàn qua biến môi trường và danh sách nguồn hợp lệ (`APP_CORS_ALLOWED_ORIGINS` cho cả CORS lẫn STOMP `/ws`), nên việc chuyển sang custom domain về sau chỉ cần cập nhật cấu hình mà không sửa mã nguồn.

Các phương án miễn phí khác bị loại bỏ vì xung đột trực tiếp với kiến trúc thời gian thực của hệ thống:
- **Render Free Tier:** Giới hạn 512MB RAM, tự ngủ sau 15 phút nhàn rỗi, cold start ~1 phút và ổ đĩa tạm thời bị xóa khi khởi động lại — phá vỡ Grace Period 30 giây, làm mất ảnh bài tập tạm và thiếu bộ nhớ chạy kèm MySQL/Redis.
- **Upstash Free Redis:** Giới hạn 500.000 lệnh/tháng, trong khi chỉ 10 người học di chuyển ở tần suất 10Hz đã tiêu tốn ~360.000 lệnh/giờ, vượt hạn mức miễn phí chỉ sau vài giờ sử dụng.
- **Fly.io:** Không còn gói miễn phí vĩnh viễn cho máy ảo chạy liên tục kèm cơ sở dữ liệu.
- **GCP `e2-micro` Free Tier:** Chỉ có 1GB RAM và giới hạn ở các vùng tại Mỹ, không đủ bộ nhớ cho JVM + MySQL + Redis và gây độ trễ cao cho người học tại Việt Nam/Châu Á.
