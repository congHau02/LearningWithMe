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
  windows: {
    paneFill: BOTANICAL_PALETTE_INT.slateLeaf,
    frame: BOTANICAL_PALETTE_INT.luminousBorder,
    mullion: BOTANICAL_PALETTE_INT.luminousBorder,
    twilightBeam: BOTANICAL_PALETTE_INT.slateLeaf,
    beamAlpha: 0.1,
  },
  chatBubble: {
    bgInt: BOTANICAL_PALETTE_INT.slateLeaf,
    borderInt: BOTANICAL_PALETTE_INT.luminousBorder,
    textColor: BOTANICAL_PALETTE_HEX.morningMist,
    accentInt: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
  },
  tableSos: {
    bgInt: BOTANICAL_PALETTE_INT.slateLeaf,
    borderInt: BOTANICAL_PALETTE_INT.luminousBorder,
    pulseFill: BOTANICAL_PALETTE_INT.warmAmber,
    pulseStroke: BOTANICAL_PALETTE_INT.warmAmber,
    border: BOTANICAL_PALETTE_INT.warmAmber,
    textColor: BOTANICAL_PALETTE_HEX.morningMist,
    textBg: '#16221Eee',
  },
  seats: {
    empty: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    emptyBorder: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    occupied: 0xef4444,
    occupiedBorder: 0xef4444,
    current: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    currentBorder: BOTANICAL_PALETTE_INT.morningMist,
    hover: BOTANICAL_PALETTE_INT.warmAmber,
    hoverBorder: BOTANICAL_PALETTE_INT.warmAmber,
  },
  lighting: {
    lampWarm: BOTANICAL_PALETTE_INT.warmAmber,
    nightAmbient: BOTANICAL_PALETTE_INT.deepPineNight,
    counterGlow: BOTANICAL_PALETTE_INT.warmAmber,
    lampAlpha: 0.11,
    ambientAlpha: 0.18,
  },
  afkLounge: {
    accent: BOTANICAL_PALETTE_INT.warmAmber,
    glowAlpha: 0.08,
    cushionWarm: BOTANICAL_PALETTE_INT.warmAmber,
    cushionEmerald: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    textColor: BOTANICAL_PALETTE_HEX.morningMist,
    backgroundColor: '#16221Ecc',
  },
  counter: {
    glowFill: BOTANICAL_PALETTE_INT.warmAmber,
    glowStroke: BOTANICAL_PALETTE_INT.warmAmber,
    menuBoardBg: BOTANICAL_PALETTE_INT.slateLeaf,
    menuBoardBorder: BOTANICAL_PALETTE_INT.luminousBorder,
    menuLines: [
      BOTANICAL_PALETTE_INT.morningMist,
      BOTANICAL_PALETTE_INT.warmAmber,
      BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    ] as const,
    textColor: BOTANICAL_PALETTE_HEX.morningMist,
    backgroundColor: '#16221Edd',
  },
  pathfinder: {
    markerInt: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
    lineInt: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
  },
  tableLabels: {
    textColor: BOTANICAL_PALETTE_HEX.morningMist,
    backgroundColor: '#16221Ecc',
  },
  playerLabels: {
    selfTextColor: BOTANICAL_PALETTE_HEX.morningMist,
    selfTextBg: '#16221Ecc',
    remoteTextColor: BOTANICAL_PALETTE_HEX.morningMist,
    remoteTextBg: '#16221Ecc',
  },
  furniture: {
    woodDark: 0x4a2e1b,
    woodMedium: 0x6b442a,
    woodWarm: 0x7c4d2b,
    woodHighlight: 0x8c5a38,
    cushionIdle: BOTANICAL_PALETTE_INT.slateLeaf,
  },
  shadow: {
    floorInt: 0x050807,
  },
  ambience: {
    warmSunset: {
      ambientWash: 0x382418,
      skyTop: 0x261d24,
      skyHorizon: 0x94572a,
      skylineFar: 0x1c1e1e,
      skylineNear: 0x121917,
      bloom: 0xf4c46a,
    },
    deepFocusNight: {
      ambientWash: BOTANICAL_PALETTE_INT.deepPineNight,
      skyTop: 0x0a1310,
      skyHorizon: 0x172b24,
      skylineFar: 0x111f1a,
      skylineNear: 0x0b1512,
      bloom: BOTANICAL_PALETTE_INT.warmAmber,
    },
    rainyNight: {
      ambientWash: 0x0d2120,
      skyTop: 0x0c1a1c,
      skyHorizon: 0x1f3d38,
      skylineFar: 0x102221,
      skylineNear: 0x0a1616,
      beam: 0x1e3c36,
      bloom: 0xd9a84e,
    },
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
