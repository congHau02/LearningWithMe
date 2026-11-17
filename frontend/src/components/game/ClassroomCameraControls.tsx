import {
  CAMERA_ZOOM_STEP,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
} from '../../game/scenes/classroomCameraController';
import { useGameStore } from '../../stores/useGameStore';
import { MinusIcon, PlusIcon, TargetIcon } from '../icons';

export function ClassroomCameraControls() {
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const cameraFollowEnabled = useGameStore((s) => s.cameraFollowEnabled);
  const adjustCameraZoom = useGameStore((s) => s.adjustCameraZoom);
  const toggleCameraFollow = useGameStore((s) => s.toggleCameraFollow);

  return (
    <div
      data-testid="camera-controls"
      aria-label="Điều khiển góc nhìn bản đồ"
      className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-lg border border-border/80 bg-card/95 p-1 text-xs shadow-lg backdrop-blur-none"
    >
      <button
        type="button"
        data-testid="camera-zoom-out-btn"
        aria-label="Thu nhỏ bản đồ"
        disabled={cameraZoom <= MIN_CAMERA_ZOOM}
        onClick={() => adjustCameraZoom(-CAMERA_ZOOM_STEP)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border/80 bg-secondary text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:min-h-8 sm:min-w-8"
      >
        <MinusIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        data-testid="camera-zoom-readout"
        className="min-w-9 text-center font-mono text-[11px] font-semibold text-foreground"
      >
        {Number.isInteger(cameraZoom) ? cameraZoom.toFixed(1) : cameraZoom}x
      </span>
      <button
        type="button"
        data-testid="camera-zoom-in-btn"
        aria-label="Phóng to bản đồ"
        disabled={cameraZoom >= MAX_CAMERA_ZOOM}
        onClick={() => adjustCameraZoom(CAMERA_ZOOM_STEP)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border/80 bg-secondary text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:min-h-8 sm:min-w-8"
      >
        <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="camera-follow-toggle-btn"
        aria-pressed={cameraFollowEnabled}
        aria-label="Theo dõi nhân vật"
        title={cameraFollowEnabled ? 'Đang theo dõi nhân vật' : 'Bật theo dõi nhân vật'}
        onClick={() => toggleCameraFollow()}
        className={`ml-0.5 flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0 sm:px-2 ${
          cameraFollowEnabled
            ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
            : 'border-border/80 bg-secondary text-muted-foreground hover:text-foreground'
        }`}
      >
        <TargetIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Theo dõi</span>
      </button>
    </div>
  );
}
