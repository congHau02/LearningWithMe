export const MOBILE_VIEWPORT_MAX_WIDTH = 640;
export const CAMERA_ZOOM_PRESETS = [1, 2, 3] as const;
export const MIN_CAMERA_ZOOM = CAMERA_ZOOM_PRESETS[0];
export const MAX_CAMERA_ZOOM = CAMERA_ZOOM_PRESETS[CAMERA_ZOOM_PRESETS.length - 1];
export const CAMERA_ZOOM_STEP = 1;
export const DEFAULT_MOBILE_CAMERA_ZOOM = 2;
export const DEFAULT_DESKTOP_CAMERA_ZOOM = 1;
export const CAMERA_FOLLOW_LERP = 0.12;
export const CAMERA_FOLLOW_DEADZONE = { width: 48, height: 32 } as const;

export interface CameraViewState {
  zoom: number;
  followEnabled: boolean;
}

export interface CameraViewportAdapter {
  roundPixels?: boolean;
  setBounds: (x: number, y: number, width: number, height: number) => unknown;
  setZoom: (value: number) => unknown;
  startFollow: (
    target: object,
    roundPixels?: boolean,
    lerpX?: number,
    lerpY?: number,
  ) => unknown;
  stopFollow: () => unknown;
  setDeadzone?: (width?: number, height?: number) => unknown;
  centerOn: (x: number, y: number) => unknown;
}

export function isMobileViewportWidth(width: number): boolean {
  return width > 0 && width <= MOBILE_VIEWPORT_MAX_WIDTH;
}

export function clampCameraZoom(zoom: number): number {
  const safe = Number.isFinite(zoom) ? zoom : DEFAULT_DESKTOP_CAMERA_ZOOM;
  const rounded = Math.round(safe);
  return Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, rounded));
}

export function computeDefaultCameraPreset(viewportWidth: number): CameraViewState {
  if (isMobileViewportWidth(viewportWidth)) {
    return { zoom: DEFAULT_MOBILE_CAMERA_ZOOM, followEnabled: true };
  }
  return { zoom: DEFAULT_DESKTOP_CAMERA_ZOOM, followEnabled: false };
}

export function applyCameraViewportState(options: {
  camera: CameraViewportAdapter;
  target?: object;
  worldWidth: number;
  worldHeight: number;
  view: CameraViewState;
  allowCameraJuice?: boolean;
}): void {
  const { camera, target, worldWidth, worldHeight, view, allowCameraJuice = true } = options;
  const clampedZoom = clampCameraZoom(view.zoom);
  camera.roundPixels = true;
  camera.setBounds(0, 0, worldWidth, worldHeight);
  camera.setZoom(clampedZoom);
  if (view.followEnabled && target) {
    if (allowCameraJuice) {
      camera.startFollow(target, true, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_LERP);
      camera.setDeadzone?.(CAMERA_FOLLOW_DEADZONE.width, CAMERA_FOLLOW_DEADZONE.height);
    } else {
      camera.startFollow(target, true, 1, 1);
      camera.setDeadzone?.();
    }
    return;
  }
  camera.stopFollow();
  camera.setDeadzone?.();
  if (clampedZoom <= MIN_CAMERA_ZOOM) {
    camera.centerOn(Math.round(worldWidth / 2), Math.round(worldHeight / 2));
  }
}
