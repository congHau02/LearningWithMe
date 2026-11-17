import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';

export function ClassroomTelemetryBar() {
  const position = useGameStore((s) => s.position);
  const facingDir = useGameStore((s) => s.facingDir);
  const pathLength = useGameStore((s) => s.pathQueue.length);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const currentSeatId = useGameStore((s) => s.currentSeatId);
  const sosBanner = useTableStore((s) => s.sosBanner);

  return (
    <div className="grid w-full grid-cols-2 gap-2 text-left text-xs sm:grid-cols-4 sm:gap-2.5">
      <div className="rounded-lg border border-[#243630] bg-[#16221E] p-2 shadow-sm">
        <span className="text-[11px] text-[#8FA399]">Tọa độ lưới:</span>
        <p
          data-testid="grid-position-readout"
          className="mt-0.5 truncate font-mono font-semibold text-[#E6ECE8]"
        >
          ({position.x}, {position.y}) • {facingDir}
        </p>
      </div>
      <div className="rounded-lg border border-[#243630] bg-[#16221E] p-2 shadow-sm">
        <span className="text-[11px] text-[#8FA399]">Lộ trình A*:</span>
        <p
          data-testid="path-queue-readout"
          className="mt-0.5 truncate font-mono font-semibold text-[#E6ECE8]"
        >
          {pathLength > 0 ? (
            <span className="text-emerald-400">Còn {pathLength} bước</span>
          ) : (
            'Thủ công / Đứng yên'
          )}
        </p>
      </div>
      <div className="rounded-lg border border-[#243630] bg-[#16221E] p-2 shadow-sm">
        <span className="text-[11px] text-[#8FA399]">Chỗ ngồi hiện tại:</span>
        <p
          data-testid="active-seat-readout"
          className="mt-0.5 truncate font-mono font-semibold text-[#E6ECE8]"
        >
          {currentSeatId ? (
            <span className="text-emerald-400 font-semibold">{currentTableId} / {currentSeatId}</span>
          ) : (
            'Chưa ngồi ghế'
          )}
        </p>
      </div>
      <div className="rounded-lg border border-[#243630] bg-[#16221E] p-2 shadow-sm">
        <span className="text-[11px] text-[#8FA399]">Tín hiệu SOS bàn:</span>
        <p className="mt-0.5 truncate font-medium text-[#E6ECE8]">
          {sosBanner ? (
            <span className="text-primary font-semibold">{sosBanner}</span>
          ) : (
            'Không có tín hiệu cầu cứu'
          )}
        </p>
      </div>
    </div>
  );
}
