export const MOBILE_VIEWPORT_MAX_WIDTH = 640;
export const MIN_CAMERA_ZOOM = 1;
export const MAX_CAMERA_ZOOM = 2.5;
export const CAMERA_ZOOM_STEP = 0.25;
export const DEFAULT_MOBILE_CAMERA_ZOOM = 2;
export const DEFAULT_DESKTOP_CAMERA_ZOOM = 1;

export interface CameraViewState {
  zoom: number;
  followEnabled: boolean;
}

export interface CameraViewportAdapter {
  setBounds: (x: number, y: number, width: number, height: number) => unknown;
  setZoom: (value: number) => unknown;
  startFollow: (
    target: object,
    roundPixels?: boolean,
    lerpX?: number,
    lerpY?: number,
  ) => unknown;
  stopFollow: () => unknown;
  centerOn: (x: number, y: number) => unknown;
}

export function isMobileViewportWidth(width: number): boolean {
  return width > 0 && width <= MOBILE_VIEWPORT_MAX_WIDTH;
}

export function clampCameraZoom(zoom: number): number {
  const safe = Number.isFinite(zoom) ? zoom : DEFAULT_DESKTOP_CAMERA_ZOOM;
  const clamped = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, safe));
  return Math.round(clamped * 100) / 100;
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
}): void {
  const { camera, target, worldWidth, worldHeight, view } = options;
  const clampedZoom = clampCameraZoom(view.zoom);
  camera.setBounds(0, 0, worldWidth, worldHeight);
  camera.setZoom(clampedZoom);
  if (view.followEnabled && target) {
    camera.startFollow(target, true, 0.14, 0.14);
    return;
  }
  camera.stopFollow();
  if (clampedZoom <= MIN_CAMERA_ZOOM) {
    camera.centerOn(worldWidth / 2, worldHeight / 2);
  }
}
