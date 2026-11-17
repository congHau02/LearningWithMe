export function SessionReplacedBanner() {
  return (
    <div
      role="status"
      className="border-b border-[#243630] bg-[#16221E]/95 px-4 py-2 text-xs text-[#E6ECE8]"
    >
      <span className="text-[#8FA399]">
        Phiên học của bạn đã được mở ở tab mới hơn.{' '}
        <span className="text-[#E6ECE8]">Tab hiện tại đã ngắt kết nối đồng bộ phòng.</span>
      </span>
    </div>
  );
}
