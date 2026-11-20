---
status: accepted
---

# Nâng cấp Đồ họa Study Café 2D WebGL trên Phaser 3.90, Hệ thống Ánh sáng Botanical & Pipeline Asset Paper-Doll 0-Đồng

Để nâng cấp toàn diện chất lượng thị giác và cảm giác tương tác của **Study Café** mà không phá vỡ hợp đồng bản đồ dùng chung với Backend ([ADR-0003](./0003-static-shared-map-topology.md)), mô phỏng **Ambient NPC** ở tầng Client ([ADR-0009](./0009-client-side-ambient-npcs-in-study-cafe.md)) hay hiệu năng $60\text{ FPS}$ trên di động `375px` khi chạy song song YouTube IFrame, bảng vẽ **Homework Slide** và đàm thoại WebRTC, chúng tôi cân nhắc giữa việc viết lại tầng game sang 3D (Three.js / React Three Fiber), nâng cấp lên Phaser 4.2, hoặc nâng cấp toàn diện nền tảng 2D hiện có trên Phaser `3.90.0`.

Chúng tôi quyết định:
1. **Giữ 2D 3/4 Top-Down trên Phaser `3.90.0` và mở khóa WebGL (`Phaser.AUTO`) có Canvas Fallback**: Tận dụng đầy đủ `preFX`/`postFX` (Bloom, Glow, Vignette, ColorMatrix), `PointLight`, `RenderTexture` lighting và `ParticleEmitter` của Phaser 3.90 mà không tốn chi phí migrate major version sang Phaser 4 hay đánh mất Canvas fallback chính thức cho thiết bị yếu và môi trường kiểm thử `jsdom`. Mọi hiệu ứng WebGL bắt buộc đi qua guard kiểm tra renderer, tuân theo **Graphics Quality** (`Thấp / Trung bình / Cao`, tôn trọng `prefers-reduced-motion`), và tự động giảm tải/tạm ngủ vòng lặp render khi **Table Workspace** mở phủ toàn màn hình.
2. **Bảo toàn tuyệt đối hợp đồng Topology `24×16` (`32×32px`, `TABLE_GID = 5`) của ADR-0003**: Giữ nguyên tọa độ logic, bàn học, ghế ngồi và đường đi trong `shared/maps/main-library.json` để không phải sửa đổi Backend hay giao thức STOMP; tách riêng các lớp hiển thị giàu chi tiết (sàn gỗ biến thể, tường 3/4 có chân tường, nội thất sprite 2 lớp Y-sort thân/lưng ghế) ở tầng Frontend.
3. **Bổ sung và điều chỉnh một phần ADR-0010 (Mở khóa đại tu Asset & Ánh sáng theo dải Botanical)**: Giữ nguyên Semantic Token Seam **Botanical Night Studio** (`#0F1714`, `#16221E`, `#243630`, `#E6ECE8`, `#E5A93C`, `#34D399`) nhưng thay thế điều khoản *"giữ nguyên tài nguyên pixel-art cũ"* của ADR-0010 bằng đại tu toàn diện: loại bỏ nội thất/phụ kiện vẽ bằng `Graphics` nguyên thủy và tileset/spritesheet giữ chỗ, chuyển sang **texture atlas pixel-art 0-đồng sạch bản quyền** (CC0/tự tạo chuẩn hóa bảng màu Botanical cho repo công khai) cùng kiến trúc **Paper-doll Layered Sprites** (`32×48px`, animation Idle/Walk/Seated-studying cho `SKIN`, `HAT`, `DESK_PET` và `Ambient NPC`) đồng bộ sang chân dung nhân vật ở Onboarding/Tủ đồ React.
4. **Dùng **Ambience Mood** trong dải tối Botanical thay cho chu kỳ Ngày/Đêm sáng chói 24h**: Cung cấp 3 bầu không khí dịu mắt (*Hoàng hôn ấm*, *Đêm tập trung*, *Đêm mưa*) hài hòa với khung HUD tối của ADR-0010, kết hợp đèn bàn `Warm Amber` tự bật sáng theo trạng thái `SEATED` của bàn học, bậc zoom pixel-perfect nguyên (`1× / 2× / 3×`, `roundPixels: true`), nhãn tiếng Việt hi-DPI/DOM overlay sắc nét và hiệu ứng Game Feel (tween ngồi ghế, bụi bước chân, vòng gợn sóng click, hover glow, hạt ăn mừng **Study Goal**).

## Considered Options
- **Chuyển sang 3D Stylized Diorama (Three.js / React Three Fiber)**: Loại bỏ vì yêu cầu viết lại toàn bộ tầng game & test, nặng tải `.glb`/shadow map trên mobile `375px` khi chạy cùng YouTube + WebRTC, và thay đổi hoàn toàn định nghĩa 2D cốt lõi của sản phẩm.
- **Nâng cấp lên Phaser `4.2.1`**: Loại bỏ ở đợt này để tránh churn nâng cấp major version (wildcard imports, viết lại test mocks, Canvas renderer bị đánh dấu deprecated) khi Phaser `3.90.0` đã cung cấp đủ mọi tính năng WebGL/FX/lighting/particles cần thiết.
- **Mua asset pack thương mại (ví dụ LimeZu) hoặc chu kỳ Ngày/Đêm sáng 24h**: Loại bỏ phương án commit pack thương mại để giữ sạch bản quyền cho repo GitHub công khai, và thay chu kỳ trưa sáng chói bằng 3 chế độ **Ambience Mood** để tránh lệch tông với HUD tối **Botanical Night Studio**.

## Consequences
- Quá trình triển khai tách làm 2 đợt rõ ràng: Đợt 1 (WebGL + **Graphics Quality** + GPU sleep + **Ambience Mood** lighting + Particles + Game Feel + Viewport rộng + nhãn hi-DPI) và Đợt 2 (Đại tu tileset/nội thất sprite 2 lớp + Paper-doll animation + Texture Atlas + đồng bộ chân dung React).
- Cần cập nhật các bài test cũ đang kiểm tra bước zoom `0.25`, kích thước PNG tileset/spritesheet cũ (`352×32`, `128×192`) và lời gọi vẽ `Graphics` nội thất/phụ kiện sang hành vi mới.
- Mọi module game mới (`lighting`, `vfx`, `fx`, `atlas`, `labels`) vẫn tuân thủ giới hạn cứng $\le 250$ dòng/file và React component $\le 200$ dòng/file theo `AGENTS.md`.
