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
    <div className="grid w-full grid-cols-1 gap-3 text-left text-xs sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
        <span className="text-muted-foreground">Tọa độ lưới:</span>
        <p
          data-testid="grid-position-readout"
          className="mt-0.5 font-mono font-semibold text-foreground"
        >
          ({position.x}, {position.y}) • {facingDir}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
        <span className="text-muted-foreground">Lộ trình A*:</span>
        <p
          data-testid="path-queue-readout"
          className="mt-0.5 font-mono font-semibold text-foreground"
        >
          {pathLength > 0 ? `Còn ${pathLength} bước` : 'Thủ công / Đứng yên'}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
        <span className="text-muted-foreground">Chỗ ngồi hiện tại:</span>
        <p
          data-testid="active-seat-readout"
          className="mt-0.5 font-mono font-semibold text-foreground"
        >
          {currentSeatId ? `${currentTableId} / ${currentSeatId}` : 'Chưa ngồi ghế'}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
        <span className="text-muted-foreground">Tín hiệu SOS bàn:</span>
        <p className="mt-0.5 font-medium text-foreground">
          {sosBanner || 'Không có tín hiệu cầu cứu'}
        </p>
      </div>
    </div>
  );
}
