/**
 * Botanical Night Studio (Rừng Đêm & Tập trung Sâu)
 * Semantic Token Seam between React HUD and Phaser 3 (ADR-0010).
 */

export const BOTANICAL_PALETTE_HEX = {
  deepPineNight: '#0F1714',
  slateLeaf: '#16221E',
  luminousBorder: '#243630',
  morningMist: '#E6ECE8',
  mutedSage: '#8FA399',
  warmAmber: '#E5A93C',
  amberInk: '#0F1714',
  bioluminescentEmerald: '#34D399',
} as const;

export const BOTANICAL_PALETTE_INT = {
  deepPineNight: 0x0f1714,
  slateLeaf: 0x16221e,
  luminousBorder: 0x243630,
  morningMist: 0xe6ece8,
  mutedSage: 0x8fa399,
  warmAmber: 0xe5a93c,
  amberInk: 0x0f1714,
  bioluminescentEmerald: 0x34d399,
} as const;

export const BOTANICAL_2D_SCENE = {
  canvasBackground: BOTANICAL_PALETTE_HEX.deepPineNight,
  canvasBackgroundInt: BOTANICAL_PALETTE_INT.deepPineNight,
  chatBubble: {
    bgInt: BOTANICAL_PALETTE_INT.slateLeaf,
    borderInt: BOTANICAL_PALETTE_INT.luminousBorder,
    textColor: BOTANICAL_PALETTE_HEX.morningMist,
    accentInt: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
  },
  tableSos: {
    pulseFill: BOTANICAL_PALETTE_INT.warmAmber,
    border: BOTANICAL_PALETTE_INT.warmAmber,
  },
  seats: {
    empty: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    occupied: 0xef4444,
    current: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    hover: BOTANICAL_PALETTE_INT.warmAmber,
  },
  lighting: {
    lampWarm: BOTANICAL_PALETTE_INT.warmAmber,
    nightAmbient: BOTANICAL_PALETTE_INT.deepPineNight,
    counterGlow: BOTANICAL_PALETTE_INT.warmAmber,
    ambientAlpha: 0.18,
  },
  pathfinder: {
    markerInt: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    lineInt: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
  },
} as const;

export function hexToInt(hex: string): number {
  const clean = hex.replace('#', '').trim();
  return parseInt(clean, 16);
}

export function intToHex(intVal: number): string {
  return `#${intVal.toString(16).padStart(6, '0').toUpperCase()}`;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function channelLuminance(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function calculateRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function calculateContrastRatio(hex1: string, hex2: string): number {
  const lum1 = calculateRelativeLuminance(hex1);
  const lum2 = calculateRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}
