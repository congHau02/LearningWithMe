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
    <div
      data-testid="classroom-telemetry-bar"
      className="grid w-full grid-cols-2 gap-2 pb-14 text-left text-xs sm:grid-cols-4 sm:gap-2.5 sm:pb-0 sm:pr-36"
    >
      <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
        <span className="text-[11px] text-muted-foreground">Tọa độ lưới:</span>
        <p
          data-testid="grid-position-readout"
          className="mt-0.5 truncate font-mono font-semibold text-foreground"
        >
          ({position.x}, {position.y}) • {facingDir}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
        <span className="text-[11px] text-muted-foreground">Lộ trình A*:</span>
        <p
          data-testid="path-queue-readout"
          className="mt-0.5 truncate font-mono font-semibold text-foreground"
        >
          {pathLength > 0 ? (
            <span className="text-emerald-400">Còn {pathLength} bước</span>
          ) : (
            'Thủ công / Đứng yên'
          )}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
        <span className="text-[11px] text-muted-foreground">Chỗ ngồi hiện tại:</span>
        <p
          data-testid="active-seat-readout"
          className="mt-0.5 truncate font-mono font-semibold text-foreground"
        >
          {currentSeatId ? (
            <span className="font-semibold text-emerald-400">{currentTableId} / {currentSeatId}</span>
          ) : (
            'Chưa ngồi ghế'
          )}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
        <span className="text-[11px] text-muted-foreground">Tín hiệu SOS bàn:</span>
        <p className="mt-0.5 truncate font-medium text-foreground">
          {sosBanner ? (
            <span className="font-semibold text-primary">{sosBanner}</span>
          ) : (
            'Không có tín hiệu cầu cứu'
          )}
        </p>
      </div>
    </div>
  );
}
