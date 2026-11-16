/**
 * Pure STOMP 1.2 frame and movement helpers shared by scripts/k6-room-load.js
 * and unit-tested in scripts/ops-phase7.test.mjs.
 */

const WALK_DELTAS = [
  { dx: 1, dy: 0, facingDir: 'RIGHT' },
  { dx: 0, dy: -1, facingDir: 'UP' },
  { dx: -1, dy: 0, facingDir: 'LEFT' },
  { dx: 0, dy: 1, facingDir: 'DOWN' },
];

export function buildStompFrame(command, headers = {}, body = '') {
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
  return `${[command, ...headerLines].join('\n')}\n\n${body}\0`;
}

export function parseStompFrames(rawChunk) {
  if (!rawChunk || typeof rawChunk !== 'string') return [];
  const frames = [];
  for (const part of rawChunk.split('\0')) {
    const trimmed = part.replace(/^\r?\n+/, '');
    if (!trimmed) continue;

    const splitIndex = trimmed.indexOf('\n\n');
    const headerBlock = splitIndex >= 0 ? trimmed.slice(0, splitIndex) : trimmed;
    const body = splitIndex >= 0 ? trimmed.slice(splitIndex + 2) : '';
    const lines = headerBlock.split(/\r?\n/);
    const command = lines[0]?.trim();
    if (!command) continue;

    const headers = {};
    for (let i = 1; i < lines.length; i++) {
      const sep = lines[i].indexOf(':');
      if (sep > 0) {
        headers[lines[i].slice(0, sep)] = lines[i].slice(sep + 1);
      }
    }
    frames.push({ command, headers, body });
  }
  return frames;
}

export function nextWalkableStep(currentTile, stepIndex) {
  const delta = WALK_DELTAS[Math.abs(stepIndex) % WALK_DELTAS.length];
  return {
    x: currentTile.x + delta.dx,
    y: currentTile.y + delta.dy,
    facingDir: delta.facingDir,
    isMoving: true,
  };
}
