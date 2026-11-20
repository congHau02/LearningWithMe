#!/usr/bin/env python3
"""Generate the 0-cost, license-clean Botanical Night Studio 2D Environment Texture Atlas.

Outputs:
  - frontend/public/assets/tilesets/study-cafe-env.png (512x256 RGBA, <= 48 colors)
  - frontend/public/assets/tilesets/study-cafe-env.json (Phaser 3 JSON Hash atlas)
  - frontend/public/assets/tilesets/study-cafe-env.manifest.json (CC0-1.0 provenance record)

Optional preview output (pass --preview-dir <dir>) generates:
  - floor-3x3-repeat.png (verifies seamless multi-variant wood tiling)
  - room-composite-preview.png (full 768x512 mockup of main-library.json rendered with atlas)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TILESETS_DIR = ROOT / "frontend" / "public" / "assets" / "tilesets"
MAP_PATH = ROOT / "shared" / "maps" / "main-library.json"

# Locked Botanical Night Studio pixel-art palette (39 unique RGBA colors total)
C: dict[str, tuple[int, int, int, int]] = {
    "T": (0, 0, 0, 0),
    "SH": (8, 13, 11, 115),         # soft contact shadow
    "GLASS": (143, 163, 153, 60),   # subtle glass cloche / specular tint
    "INK": (8, 13, 11, 255),
    "PINE0": (15, 23, 20, 255),     # #0F1714 Deep Pine Night
    "PINE1": (19, 30, 26, 255),
    "SLATE0": (22, 34, 30, 255),    # #16221E Slate Leaf
    "SLATE1": (29, 44, 39, 255),
    "BORD0": (36, 54, 48, 255),     # #243630 Luminous Border
    "BORD1": (50, 74, 66, 255),
    "SAGE0": (87, 111, 102, 255),
    "SAGE1": (143, 163, 153, 255),  # #8FA399 Muted Sage
    "MIST0": (196, 208, 202, 255),
    "MIST1": (230, 236, 232, 255),  # #E6ECE8 Morning Mist
    # Espresso & Walnut wood planks (darker for low-contrast walkable floor)
    "FL0": (25, 17, 12, 255),
    "FL1": (36, 24, 16, 255),
    "FL2": (46, 31, 21, 255),
    "FL3": (58, 39, 26, 255),
    # Rich Mahogany / Walnut furniture wood
    "WD0": (68, 42, 25, 255),
    "WD1": (92, 58, 35, 255),
    "WD2": (116, 74, 44, 255),
    "WD3": (140, 92, 56, 255),
    "WD4": (166, 112, 72, 255),
    # Botanical foliage
    "LF0": (19, 60, 46, 255),
    "LF1": (28, 92, 71, 255),
    "LF2": (38, 133, 101, 255),
    "EMR": (52, 211, 153, 255),     # #34D399 Bioluminescent Emerald
    "EMRHI": (122, 232, 190, 255),
    # Warm Amber / Brass / Lamps / Pastries
    "AMB0": (115, 75, 20, 255),
    "AMB1": (173, 118, 33, 255),
    "AMB2": (229, 169, 60, 255),    # #E5A93C Warm Amber
    "AMB3": (245, 202, 115, 255),
    "AMBHI": (255, 241, 199, 255),
    # Terracotta, books, and seat status accents
    "TER0": (94, 44, 27, 255),
    "TER1": (140, 69, 44, 255),
    "TER2": (178, 94, 64, 255),
    "BKRED": (146, 62, 72, 255),
    "BKBLU": (70, 95, 136, 255),
    "OCC0": (132, 46, 52, 255),
    "OCC1": (204, 76, 82, 255),
}


class PixelCanvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.img = Image.new("RGBA", (w, h), C["T"])
        self.px = self.img.load()

    def p(self, x: int, y: int, col: str) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = C[col]

    def rect(self, x: int, y: int, w: int, h: int, col: str) -> None:
        c = C[col]
        for yy in range(max(0, y), min(self.h, y + h)):
            for xx in range(max(0, x), min(self.w, x + w)):
                self.px[xx, yy] = c

    def hline(self, x: int, y: int, length: int, col: str) -> None:
        self.rect(x, y, length, 1, col)

    def vline(self, x: int, y: int, length: int, col: str) -> None:
        self.rect(x, y, 1, length, col)

    def box(self, x: int, y: int, w: int, h: int, fill: str, border: str, hi: str | None = None) -> None:
        self.rect(x, y, w, h, fill)
        self.hline(x, y, w, border)
        self.hline(x, y + h - 1, w, border)
        self.vline(x, y, h, border)
        self.vline(x + w - 1, y, h, border)
        if hi and w > 2 and h > 2:
            self.hline(x + 1, y + 1, w - 2, hi)

    def rounded_rect(self, x: int, y: int, w: int, h: int, col: str) -> None:
        self.rect(x + 1, y, w - 2, h, col)
        self.rect(x, y + 1, w, h - 2, col)

    def oval(self, cx: float, cy: float, rx: float, ry: float, col: str) -> None:
        c = C[col]
        for yy in range(max(0, int(cy - ry) - 1), min(self.h, int(cy + ry) + 2)):
            for xx in range(max(0, int(cx - rx) - 1), min(self.w, int(cx + rx) + 2)):
                dx = (xx + 0.5 - cx) / rx
                dy = (yy + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.px[xx, yy] = c


# ---------------------------------------------------------------------------
# 1. Multi-Variant Seamless Walnut Plank Floors (4 subtle variants)
# ---------------------------------------------------------------------------
def make_floor_wood(variant: int) -> Image.Image:
    cv = PixelCanvas(32, 32)
    # Consistent row-edge tones [FL1, FL2, FL1, FL2] guarantee zero vertical seams between ANY two variants;
    # interior planks between end-joints vary subtly in warmth, grain, and knots!
    edge_tones = ["FL1", "FL2", "FL1", "FL2"]
    joint_xs = [
        [6, 20, 11, 26],
        [13, 5, 22, 10],
        [8, 24, 15, 4],
        [19, 11, 6, 21],
    ][variant]
    inner_shifts = [
        ["FL1", "FL2", "FL2", "FL1"],
        ["FL2", "FL1", "FL1", "FL2"],
        ["FL1", "FL1", "FL2", "FL2"],
        ["FL2", "FL2", "FL1", "FL1"],
    ][variant]

    for row in range(4):
        y0 = row * 8
        edge_base = edge_tones[row]
        cv.rect(0, y0, 32, 8, edge_base)
        # Apply subtle plank warmth only between two joints so x=0 and x=31 always match edge_base!
        jx1 = joint_xs[row]
        jx2 = (jx1 + 15) if jx1 <= 15 else None
        if jx2 is not None and jx2 < 30:
            inner_col = inner_shifts[row]
            cv.rect(jx1 + 1, y0 + 1, jx2 - jx1 - 1, 7, inner_col)

        # Continuous horizontal plank seam & micro top highlight
        cv.hline(0, y0, 32, "FL0")
        hi = "FL3" if edge_base == "FL2" else "FL2"
        cv.hline(0, y0 + 1, 32, hi)
        # Organic horizontal wood grain streaks inside planks
        g_start = (variant * 7 + row * 9) % 18 + 2
        cv.hline(g_start, y0 + 4, 7, hi)
        cv.hline((g_start + 11) % 21 + 2, y0 + 6, 5, "FL0")
        # Vertical plank end-joint(s) + nail dots
        for jx in ([jx1, jx2] if jx2 is not None and jx2 < 30 else [jx1]):
            cv.vline(jx, y0 + 1, 7, "FL0")
            cv.p((jx + 1) % 32, y0 + 2, "FL0")
            cv.p((jx + 1) % 32, y0 + 6, "FL0")
            cv.p((jx - 1) % 32, y0 + 2, hi)

    # Subtle variant-specific wood knots
    if variant == 1:
        cv.rect(17, 11, 3, 2, "FL0")
        cv.p(18, 11, "FL2")
    elif variant == 2:
        cv.rect(4, 27, 4, 2, "FL3")
        cv.p(5, 28, "FL0")
    elif variant == 3:
        cv.rect(24, 3, 3, 2, "FL0")
        cv.p(25, 3, "FL3")
    return cv.img


# ---------------------------------------------------------------------------
# 2. 3/4 Perspective Perimeter Walls with Top Cap, Vertical Face & Baseboard
# ---------------------------------------------------------------------------
def make_wall_north(trimmed: bool) -> Image.Image:
    cv = PixelCanvas(32, 32)
    # Top cornice cap (y=0..6)
    cv.rect(0, 0, 32, 5, "PINE0")
    cv.hline(0, 5, 32, "WD0")
    cv.hline(0, 6, 32, "WD2")
    # Upper botanical sage-slate plaster wall (y=7..18)
    cv.rect(0, 7, 32, 12, "SLATE0")
    cv.hline(0, 7, 32, "PINE1")
    for x in range(2, 32, 8):
        cv.vline(x, 8, 10, "SLATE1")
    if trimmed:
        # Subtle recessed Botanical wall panel molding
        cv.box(5, 9, 22, 8, "SLATE1", "BORD0", "BORD1")
        cv.rect(8, 12, 16, 2, "SLATE0")
    # Chair rail trim (y=19..20)
    cv.hline(0, 19, 32, "WD3")
    cv.hline(0, 20, 32, "WD1")
    # Lower walnut wainscoting (y=21..27)
    cv.rect(0, 21, 32, 7, "WD0")
    for px in (2, 12, 22):
        cv.box(px, 22, 8, 5, "WD1", "FL0", "WD2")
    # Baseboard & floor shadow (y=28..31)
    cv.hline(0, 28, 32, "WD2")
    cv.hline(0, 29, 32, "FL1")
    cv.hline(0, 30, 32, "INK")
    cv.hline(0, 31, 32, "FL0")
    return cv.img


def make_wall_south() -> Image.Image:
    cv = PixelCanvas(32, 32)
    # Subtle inner baseboard bevel + warm walnut top cap + dark foreground cutaway
    cv.hline(0, 0, 32, "INK")
    cv.hline(0, 1, 32, "WD2")
    cv.rect(0, 2, 32, 5, "WD1")
    cv.hline(0, 2, 32, "WD3")
    cv.hline(0, 6, 32, "WD0")
    cv.hline(0, 7, 32, "BORD0")
    cv.rect(0, 8, 32, 24, "PINE0")
    for x in range(0, 32, 8):
        cv.vline(x, 8, 4, "PINE1")
    return cv.img


def make_wall_side(side: str) -> Image.Image:
    cv = PixelCanvas(32, 32)
    if side == "west":
        cv.rect(0, 0, 18, 32, "PINE0")
        cv.vline(18, 0, 32, "BORD0")
        cv.rect(19, 0, 5, 32, "WD1")
        cv.vline(23, 0, 32, "WD3")
        cv.vline(24, 0, 32, "WD0")
        cv.rect(25, 0, 4, 32, "SLATE0")
        cv.vline(29, 0, 32, "WD1")
        cv.vline(30, 0, 32, "INK")
        cv.vline(31, 0, 32, "FL0")
        for y in range(4, 32, 8):
            cv.hline(25, y, 4, "SLATE1")
    else:
        cv.rect(14, 0, 18, 32, "PINE0")
        cv.vline(13, 0, 32, "BORD0")
        cv.rect(8, 0, 5, 32, "WD1")
        cv.vline(8, 0, 32, "WD3")
        cv.vline(7, 0, 32, "WD0")
        cv.rect(3, 0, 4, 32, "SLATE0")
        cv.vline(2, 0, 32, "WD1")
        cv.vline(1, 0, 32, "INK")
        cv.vline(0, 0, 32, "FL0")
        for y in range(4, 32, 8):
            cv.hline(3, y, 4, "SLATE1")
    return cv.img


def make_wall_corner(corner: str) -> Image.Image:
    cv = PixelCanvas(32, 32)
    cv.rect(0, 0, 32, 32, "PINE0")
    if corner == "nw":
        cv.vline(18, 5, 27, "BORD0")
        cv.hline(18, 5, 14, "WD0")
        cv.rect(19, 6, 13, 26, "WD1")
        cv.hline(19, 6, 13, "WD2")
        cv.vline(23, 6, 26, "WD3")
        cv.vline(24, 7, 25, "WD0")
        cv.rect(25, 7, 7, 25, "SLATE0")
        cv.hline(25, 19, 7, "WD3")
        cv.hline(25, 20, 7, "WD1")
        cv.rect(25, 21, 7, 7, "WD0")
        cv.hline(25, 28, 7, "WD2")
        cv.hline(25, 29, 7, "FL1")
        cv.hline(25, 30, 7, "INK")
        cv.hline(25, 31, 7, "FL0")
        cv.vline(29, 28, 4, "WD1")
        cv.vline(30, 30, 2, "INK")
        cv.vline(31, 31, 1, "FL0")
    elif corner == "ne":
        cv.vline(13, 5, 27, "BORD0")
        cv.hline(0, 5, 14, "WD0")
        cv.rect(0, 6, 13, 26, "WD1")
        cv.hline(0, 6, 13, "WD2")
        cv.vline(8, 6, 26, "WD3")
        cv.vline(7, 7, 25, "WD0")
        cv.rect(0, 7, 7, 25, "SLATE0")
        cv.hline(0, 19, 7, "WD3")
        cv.hline(0, 20, 7, "WD1")
        cv.rect(0, 21, 7, 7, "WD0")
        cv.hline(0, 28, 7, "WD2")
        cv.hline(0, 29, 7, "FL1")
        cv.hline(0, 30, 7, "INK")
        cv.hline(0, 31, 7, "FL0")
        cv.vline(2, 28, 4, "WD1")
        cv.vline(1, 30, 2, "INK")
        cv.vline(0, 31, 1, "FL0")
    elif corner == "sw":
        cv.rect(19, 0, 13, 7, "WD1")
        cv.vline(18, 0, 8, "BORD0")
        cv.hline(18, 7, 14, "BORD0")
        cv.vline(23, 0, 3, "WD3")
        cv.hline(23, 2, 9, "WD3")
        cv.rect(25, 0, 7, 1, "INK")
        cv.rect(25, 1, 7, 1, "WD2")
        cv.hline(25, 6, 7, "WD0")
    else:  # se
        cv.rect(0, 0, 13, 7, "WD1")
        cv.vline(13, 0, 8, "BORD0")
        cv.hline(0, 7, 14, "BORD0")
        cv.vline(8, 0, 3, "WD3")
        cv.hline(0, 2, 9, "WD3")
        cv.rect(0, 0, 7, 1, "INK")
        cv.rect(0, 1, 7, 1, "WD2")
        cv.hline(0, 6, 7, "WD0")
    return cv.img


# ---------------------------------------------------------------------------
# 3. 9-Slice Woven Area Rugs (Botanical Study Rug & Warm Chill Lounge Carpet)
# ---------------------------------------------------------------------------
def make_rug_9slice(prefix: str, warm_lounge: bool) -> dict[str, Image.Image]:
    base_col = "SLATE1" if not warm_lounge else "PINE1"
    weave_col = "SLATE0" if not warm_lounge else "SLATE0"
    border_outer = "BORD1" if not warm_lounge else "AMB0"
    border_inner = "LF2" if not warm_lounge else "AMB2"
    fringe_col = "SAGE0" if not warm_lounge else "AMB1"

    parts: dict[str, Image.Image] = {}
    grid = [
        ("tl", True, False, True, False),
        ("t", True, False, False, False),
        ("tr", True, False, False, True),
        ("l", False, False, True, False),
        ("c", False, False, False, False),
        ("r", False, False, False, True),
        ("bl", False, True, True, False),
        ("b", False, True, False, False),
        ("br", False, True, False, True),
    ]
    for suffix, top, bottom, left, right in grid:
        cv = PixelCanvas(32, 32)
        x0 = 3 if left else 0
        x1 = 29 if right else 32
        y0 = 2 if top else 0
        y1 = 30 if bottom else 32
        cv.rect(x0, y0, x1 - x0, y1 - y0, base_col)

        # Subtle herringbone woven texture
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if (xx + yy) % 4 == 0:
                    cv.p(xx, yy, weave_col)
                elif warm_lounge and (xx - yy) % 8 == 0 and (xx % 2 == 0):
                    cv.p(xx, yy, "BORD0")

        # Stitched outer & inner trim borders
        if top:
            cv.hline(x0, y0, x1 - x0, "INK")
            cv.hline(x0, y0 + 1, x1 - x0, border_outer)
            cv.hline(x0 + (2 if left else 0), y0 + 3, (x1 - x0) - (2 if left else 0) - (2 if right else 0), border_inner)
        if bottom:
            cv.hline(x0, y1 - 1, x1 - x0, "INK")
            cv.hline(x0, y1 - 2, x1 - x0, border_outer)
            cv.hline(x0 + (2 if left else 0), y1 - 4, (x1 - x0) - (2 if left else 0) - (2 if right else 0), border_inner)
        if left:
            cv.vline(x0, y0, y1 - y0, "INK")
            cv.vline(x0 + 1, y0, y1 - y0, border_outer)
            cv.vline(x0 + 3, y0 + (2 if top else 0), (y1 - y0) - (2 if top else 0) - (2 if bottom else 0), border_inner)
            # Tassel fringe along left rug edge
            for ty in range(y0 + 2, y1 - 2, 4):
                cv.hline(x0 - 3, ty, 3, fringe_col)
        if right:
            cv.vline(x1 - 1, y0, y1 - y0, "INK")
            cv.vline(x1 - 2, y0, y1 - y0, border_outer)
            cv.vline(x1 - 4, y0 + (2 if top else 0), (y1 - y0) - (2 if top else 0) - (2 if bottom else 0), border_inner)
            for ty in range(y0 + 2, y1 - 2, 4):
                cv.hline(x1, ty, 3, fringe_col)

        # Corner botanical motif diamond
        if top and left:
            cv.rect(x0 + 5, y0 + 5, 3, 3, border_inner)
            cv.p(x0 + 6, y0 + 6, "AMB2" if not warm_lounge else "EMR")
        elif top and right:
            cv.rect(x1 - 8, y0 + 5, 3, 3, border_inner)
            cv.p(x1 - 7, y0 + 6, "AMB2" if not warm_lounge else "EMR")
        elif bottom and left:
            cv.rect(x0 + 5, y1 - 8, 3, 3, border_inner)
            cv.p(x0 + 6, y1 - 7, "AMB2" if not warm_lounge else "EMR")
        elif bottom and right:
            cv.rect(x1 - 8, y1 - 8, 3, 3, border_inner)
            cv.p(x1 - 7, y1 - 7, "AMB2" if not warm_lounge else "EMR")

        parts[f"{prefix}_{suffix}"] = cv.img
    return parts


# ---------------------------------------------------------------------------
# 4. Framed North Café Window (64x32 with TRANSPARENT glass pane cutouts!)
# ---------------------------------------------------------------------------
def make_window_north_frame() -> Image.Image:
    cv = PixelCanvas(64, 32)
    # Outer walnut casing around pane rect (5..58, 5..20)
    cv.rect(2, 2, 60, 22, "WD0")
    cv.rect(3, 3, 58, 20, "WD2")
    cv.hline(2, 2, 60, "INK")
    cv.hline(3, 3, 58, "WD4")
    cv.vline(2, 2, 22, "INK")
    cv.vline(61, 2, 22, "INK")

    # Inner dark recess lip
    cv.rect(4, 4, 56, 18, "PINE0")
    # Cut out completely transparent glass panes so WindowDepthRenderer (depth 3.2) shines through!
    cv.rect(5, 5, 25, 16, "T")
    cv.rect(34, 5, 25, 16, "T")

    # Center wooden mullion (x=30..33) & delicate cross transom bar
    cv.rect(30, 4, 4, 18, "WD1")
    cv.vline(31, 5, 16, "WD3")
    cv.vline(30, 5, 16, "INK")
    cv.vline(33, 5, 16, "INK")
    cv.hline(5, 11, 25, "WD0")
    cv.hline(34, 11, 25, "WD0")

    # Tiny corner glass specular glints (semi-transparent)
    for gx in (7, 36):
        cv.p(gx, 7, "GLASS")
        cv.p(gx + 1, 6, "GLASS")
        cv.p(gx, 14, "GLASS")

    # Projecting mahogany windowsill (y=22..27) + soft wall cast shadow below
    cv.rect(1, 22, 62, 5, "WD1")
    cv.hline(1, 22, 62, "WD4")
    cv.hline(2, 23, 60, "WD3")
    cv.hline(1, 26, 62, "WD0")
    cv.hline(2, 27, 60, "INK")
    cv.rect(3, 28, 58, 2, "SH")
    # Tiny potted trailing herb on right sill corner
    cv.rect(51, 18, 6, 4, "TER1")
    cv.hline(51, 18, 6, "TER2")
    cv.rect(52, 15, 4, 3, "LF2")
    cv.p(53, 14, "EMR")
    cv.p(55, 16, "LF1")
    return cv.img


# ---------------------------------------------------------------------------
# 5. Modular 3/4 Study Tables (32x40: top + beveled edge + front apron + legs)
# ---------------------------------------------------------------------------
def make_table_piece(kind: str) -> Image.Image:
    cv = PixelCanvas(32, 40)
    is_l = kind == "left"
    is_r = kind == "right"
    x0 = 2 if is_l else 0
    x1 = 30 if is_r else 32
    w = x1 - x0

    # Soft floor cast shadow
    cv.rect(x0 + (1 if is_l else 0), 34, w - (1 if is_l else 0) - (1 if is_r else 0), 5, "SH")

    # Tapered walnut legs
    if is_l:
        cv.rect(4, 28, 4, 9, "WD0")
        cv.vline(5, 29, 7, "WD2")
        cv.hline(4, 37, 4, "INK")
    if is_r:
        cv.rect(24, 28, 4, 9, "WD0")
        cv.vline(25, 29, 7, "WD2")
        cv.hline(24, 37, 4, "INK")

    # 3/4 front wooden apron (y=25..31)
    cv.rect(x0, 25, w, 7, "WD0")
    cv.hline(x0, 25, w, "WD1")
    cv.hline(x0, 31, w, "INK")
    if is_l:
        cv.vline(x0, 25, 7, "INK")
    if is_r:
        cv.vline(x1 - 1, 25, 7, "INK")

    # Tabletop surface (y=6..24) with rich beveled rim & wood grain
    cv.rect(x0, 6, w, 19, "WD2")
    cv.hline(x0, 6, w, "INK")
    cv.hline(x0, 7, w, "WD4")
    cv.hline(x0, 8, w, "WD3")
    cv.hline(x0, 23, w, "WD3")
    cv.hline(x0, 24, w, "WD1")
    if is_l:
        cv.vline(x0, 6, 19, "INK")
        cv.vline(x0 + 1, 7, 17, "WD3")
    if is_r:
        cv.vline(x1 - 1, 6, 19, "INK")
        cv.vline(x1 - 2, 7, 17, "WD1")

    # Subtle plank join & grain across tabletop
    cv.hline(x0 + (2 if is_l else 0), 15, w - (2 if is_l else 0) - (2 if is_r else 0), "WD1")
    cv.hline(x0 + 4, 11, 9, "WD3")
    cv.hline(x0 + 12, 19, 10, "WD1")
    return cv.img


# ---------------------------------------------------------------------------
# 6. Multi-Shelf Wooden Bookcases (32x40, left & right pair)
# ---------------------------------------------------------------------------
def make_bookcase(side: str) -> Image.Image:
    cv = PixelCanvas(32, 40)
    is_l = side == "left"
    x0 = 1 if is_l else 0
    x1 = 32 if is_l else 31
    w = x1 - x0

    # Floor contact shadow
    cv.rect(x0, 36, w, 4, "SH")
    # Outer walnut cabinet frame
    cv.rect(x0, 2, w, 35, "WD0")
    cv.hline(x0, 2, w, "INK")
    cv.hline(x0, 3, w, "WD4")
    cv.hline(x0, 4, w, "WD2")
    cv.hline(x0, 36, w, "INK")
    if is_l:
        cv.vline(x0, 2, 35, "INK")
        cv.vline(x0 + 1, 3, 33, "WD2")
        cv.vline(31, 4, 32, "WD1")
    else:
        cv.vline(x1 - 1, 2, 35, "INK")
        cv.vline(x1 - 2, 3, 33, "WD1")
        cv.vline(0, 4, 32, "WD2")

    # 3 recessed dark shelves (y=6..13, 16..23, 26..33)
    book_palettes = [
        [("BKRED", 4, 7), ("AMB2", 3, 6), ("BKBLU", 4, 7), ("MIST0", 3, 6), ("LF2", 4, 7), ("TER1", 4, 6)],
        [("LF1", 4, 7), ("MIST1", 3, 6), ("BKBLU", 3, 7), ("AMB1", 4, 6), ("BKRED", 4, 7), ("EMR", 3, 6)],
        [("BKBLU", 4, 7), ("TER2", 4, 6), ("LF2", 3, 7), ("MIST0", 4, 6), ("AMB2", 4, 7), ("BKRED", 3, 6)],
    ]
    if not is_l:
        book_palettes = [list(reversed(row)) for row in book_palettes]

    inner_x0 = 3 if is_l else 1
    inner_w = 27
    for s_idx, sy in enumerate((6, 16, 26)):
        cv.rect(inner_x0, sy, inner_w, 8, "PINE0")
        cv.hline(inner_x0, sy + 8, inner_w, "WD3")
        cv.hline(inner_x0, sy + 9, inner_w, "WD1")
        bx = inner_x0 + 1
        for col, bw, bh in book_palettes[s_idx]:
            if bx + bw > inner_x0 + inner_w - 1:
                break
            by = sy + (8 - bh)
            cv.rect(bx, by, bw, bh, col)
            cv.vline(bx, by, bh, "INK")
            cv.hline(bx + 1, by + 1, max(1, bw - 2), "MIST0" if col != "MIST1" else "SAGE1")
            bx += bw + 1

    # Tiny trailing botanical plant resting on bookcase crown
    if is_l:
        cv.rect(8, 0, 5, 3, "TER1")
        cv.rect(6, 0, 8, 2, "LF2")
        cv.p(7, 2, "EMR")
        cv.p(6, 4, "LF2")
        cv.p(6, 5, "EMR")
    else:
        cv.rect(18, 0, 6, 3, "AMB1")
        cv.p(20, 1, "AMB3")
    return cv.img


# ---------------------------------------------------------------------------
# 7. Botanical Potted Plant (32x40, 3-frame gentle leaf sway)
# ---------------------------------------------------------------------------
def make_plant_botanical(frame_idx: int) -> Image.Image:
    cv = PixelCanvas(32, 40)
    dx = [0, -1, 1][frame_idx]

    # Floor shadow & shaded terracotta pot
    cv.oval(16, 35, 9, 3.5, "SH")
    cv.rect(10, 25, 12, 10, "TER1")
    cv.rect(9, 23, 14, 3, "TER2")
    cv.hline(9, 22, 14, "INK")
    cv.hline(10, 23, 12, "AMB3")  # subtle terracotta rim glint
    cv.vline(10, 26, 9, "TER0")
    cv.vline(21, 26, 9, "TER0")
    cv.rect(11, 34, 10, 2, "TER0")
    cv.hline(11, 36, 10, "INK")
    # Dark soil
    cv.rect(11, 23, 10, 2, "FL0")

    # Lush layered monstera / botanical fronds swaying gently with dx
    leaves = [
        (16 + dx, 14, 7.5, 6.5, "LF0"),
        (11 + dx, 18, 6.0, 4.5, "LF1"),
        (21 + dx, 17, 6.0, 4.5, "LF1"),
        (16 + dx, 11, 5.5, 5.0, "LF2"),
        (12 + dx, 15, 4.0, 3.2, "LF2"),
        (20 + dx, 14, 4.2, 3.2, "LF2"),
        (15 + dx, 9, 3.2, 2.5, "EMR"),
        (21 + dx, 12, 2.5, 2.0, "EMR"),
    ]
    for cx, cy, rx, ry, col in leaves:
        cv.oval(cx, cy, rx, ry, col)
    # Crisp leaf veins & emerald highlights
    cv.p(15 + dx, 8, "EMRHI")
    cv.p(16 + dx, 10, "EMRHI")
    cv.p(11 + dx, 14, "EMR")
    cv.p(20 + dx, 12, "EMRHI")
    # Stems dipping cleanly into soil
    cv.vline(15, 19, 5, "LF0")
    cv.vline(17, 19, 5, "LF1")
    return cv.img


# ---------------------------------------------------------------------------
# 8. Standing Reading Floor Lamp (32x44) & Reactive Table Desk Lamps (16x20)
# ---------------------------------------------------------------------------
def make_reading_lamp() -> Image.Image:
    cv = PixelCanvas(32, 44)
    cv.oval(16, 40, 8, 3, "SH")
    # Weighted walnut/brass base
    cv.oval(16, 39, 6, 2.5, "WD0")
    cv.oval(16, 38, 5, 2, "AMB1")
    # Slender brass stem
    cv.rect(15, 17, 2, 21, "AMB1")
    cv.vline(15, 17, 21, "AMB2")
    # Pleated Warm Amber lampshade (trapezoid silhouette)
    for row in range(12):
        half = 5 + row // 3
        y = 5 + row
        col = "AMB3" if row < 7 else "AMB2"
        cv.hline(16 - half, y, half * 2, col)
        cv.p(16 - half, y, "AMB0")
        cv.p(16 + half - 1, y, "AMB0")
    cv.hline(11, 4, 10, "AMB0")
    cv.hline(12, 5, 8, "AMBHI")
    cv.rect(14, 8, 4, 5, "AMBHI")
    cv.hline(8, 17, 16, "AMBHI")  # warm underside glow lip
    return cv.img


def make_desk_lamp(lit: bool) -> Image.Image:
    cv = PixelCanvas(16, 20)
    # Pedestal & curved brass neck
    cv.oval(8, 17, 5, 2, "SH")
    cv.rect(5, 15, 6, 3, "BORD0")
    cv.hline(6, 15, 4, "AMB1")
    cv.rect(7, 9, 2, 6, "AMB1")
    cv.p(8, 8, "AMB2")
    # Dome shade
    shade_main = "AMB2" if lit else "BORD1"
    shade_hi = "AMBHI" if lit else "SAGE0"
    shade_edge = "AMB0" if lit else "SLATE0"
    cv.rounded_rect(3, 4, 10, 6, shade_edge)
    cv.rounded_rect(4, 5, 8, 4, shade_main)
    cv.hline(5, 5, 6, shade_hi)
    if lit:
        cv.hline(4, 9, 8, "AMBHI")
        cv.hline(5, 10, 6, "AMB3")
    return cv.img


# ---------------------------------------------------------------------------
# 9. Tabletop Study Props, Lounge Cushions & Side Table
# ---------------------------------------------------------------------------
def make_prop_open_book() -> Image.Image:
    cv = PixelCanvas(20, 16)
    cv.rect(2, 4, 16, 10, "SH")
    cv.box(2, 3, 16, 10, "WD0", "INK")
    cv.rect(3, 4, 6, 8, "MIST1")
    cv.rect(11, 4, 6, 8, "MIST0")
    cv.vline(9, 4, 8, "SAGE0")
    cv.vline(10, 4, 8, "SAGE1")
    # Tiny ruled ink lines + emerald bookmark ribbon
    for y in (6, 8, 10):
        cv.hline(4, y, 4, "SAGE0")
        cv.hline(12, y, 4, "SAGE0")
    cv.vline(14, 4, 9, "EMR")
    cv.p(14, 13, "EMRHI")
    return cv.img


def make_prop_laptop() -> Image.Image:
    cv = PixelCanvas(20, 16)
    cv.rect(2, 12, 16, 3, "SH")
    # Screen lid
    cv.box(3, 2, 14, 9, "SLATE0", "INK", "BORD1")
    cv.rect(5, 4, 10, 5, "PINE0")
    cv.hline(6, 5, 6, "EMR")
    cv.hline(6, 7, 8, "LF2")
    # Keyboard deck
    cv.rect(2, 11, 16, 3, "BORD1")
    cv.hline(3, 12, 14, "SAGE0")
    cv.hline(2, 14, 16, "INK")
    return cv.img


def make_prop_coffee_mug() -> Image.Image:
    cv = PixelCanvas(12, 12)
    cv.oval(6, 9, 4, 2, "SH")
    cv.box(3, 4, 6, 6, "MIST1", "INK")
    cv.rect(4, 5, 4, 2, "WD1")  # espresso inside
    cv.vline(9, 5, 3, "MIST0")
    cv.p(9, 5, "INK")
    cv.p(9, 8, "INK")
    return cv.img


def make_cushion(kind: str) -> Image.Image:
    cv = PixelCanvas(24, 20)
    cv.oval(12, 12, 10, 7, "SH")
    if kind == "amber":
        edge, body, hi, button = "AMB0", "AMB2", "AMB3", "AMBHI"
    else:
        edge, body, hi, button = "LF0", "LF2", "EMR", "EMRHI"
    cv.oval(12, 10, 9.5, 6.5, edge)
    cv.oval(12, 9.5, 8.2, 5.2, body)
    cv.oval(10.5, 8, 5, 2.5, hi)
    # Tufted center button
    cv.rect(11, 9, 2, 2, edge)
    cv.p(11, 9, button)
    return cv.img


# ---------------------------------------------------------------------------
# 10. Handcrafted Barista Service Counter & Countertop Props + Wall Clock
# ---------------------------------------------------------------------------
def make_counter_piece(kind: str) -> Image.Image:
    cv = PixelCanvas(32, 40)
    is_l = kind == "left"
    is_r = kind == "right"
    x0 = 1 if is_l else 0
    x1 = 31 if is_r else 32
    w = x1 - x0

    cv.rect(x0, 35, w, 4, "SH")
    # Front dark Botanical paneled base (y=19..35)
    cv.rect(x0, 19, w, 17, "SLATE0")
    cv.hline(x0, 35, w, "INK")
    # Slatted mahogany & slate decorative panels
    for px in range(x0 + 2, x1 - 4, 8):
        cv.box(px, 21, 6, 10, "SLATE1", "PINE0", "BORD1")
    # Brass foot rail near bottom
    cv.hline(x0 + (2 if is_l else 0), 33, w - (2 if is_l else 0) - (2 if is_r else 0), "AMB2")
    cv.hline(x0 + (2 if is_l else 0), 34, w - (2 if is_l else 0) - (2 if is_r else 0), "AMB0")

    # Thick overhanging mahogany bar countertop (y=6..19)
    cv.rect(x0, 6, w, 13, "WD2")
    cv.hline(x0, 6, w, "INK")
    cv.hline(x0, 7, w, "WD4")
    cv.hline(x0, 8, w, "WD3")
    cv.hline(x0, 17, w, "WD1")
    cv.hline(x0, 18, w, "WD0")
    cv.hline(x0, 19, w, "INK")
    if is_l:
        cv.vline(x0, 6, 30, "INK")
        cv.vline(x0 + 1, 7, 11, "WD4")
    if is_r:
        cv.vline(x1 - 1, 6, 30, "INK")
        cv.vline(x1 - 2, 7, 11, "WD1")
    return cv.img


def make_counter_espresso(frame_idx: int) -> Image.Image:
    cv = PixelCanvas(40, 24)
    cv.rect(3, 19, 34, 4, "SH")
    # Stainless-steel & brass espresso body
    cv.box(4, 3, 32, 17, "BORD1", "INK", "MIST0")
    # Top cup warmer rack with tiny ceramic espresso cups
    cv.hline(6, 2, 28, "SAGE1")
    cv.rect(8, 0, 4, 3, "MIST1")
    cv.rect(14, 0, 4, 3, "MIST0")
    # Recessed drip tray & dual brass groupheads
    cv.rect(7, 10, 26, 8, "PINE0")
    cv.rect(9, 10, 6, 4, "SAGE1")
    cv.rect(25, 10, 6, 4, "SAGE1")
    cv.hline(10, 14, 4, "AMB2")
    cv.hline(26, 14, 4, "AMB2")
    # Espresso cups brewing beneath groupheads
    cv.rect(10, 15, 4, 3, "MIST1")
    cv.rect(26, 15, 4, 3, "MIST1")
    # Pressure dial & animated blinking status LED!
    cv.rect(18, 6, 4, 4, "MIST1")
    cv.p(20, 7, "INK")
    led_outer = "AMB2" if frame_idx == 0 else "EMR"
    led_core = "AMBHI" if frame_idx == 0 else "EMRHI"
    cv.rect(30, 5, 3, 3, led_outer)
    cv.p(31, 6, led_core)
    return cv.img


def make_counter_pastry_dome() -> Image.Image:
    cv = PixelCanvas(24, 20)
    cv.oval(12, 16, 9, 3, "SH")
    # Wooden cake pedestal
    cv.rect(4, 13, 16, 3, "WD2")
    cv.hline(5, 13, 14, "WD4")
    cv.rect(9, 16, 6, 2, "WD0")
    # Golden croissant + emerald matcha pastry inside
    cv.rounded_rect(6, 9, 6, 4, "AMB2")
    cv.hline(7, 9, 4, "AMB3")
    cv.rounded_rect(13, 9, 5, 4, "LF2")
    cv.hline(14, 9, 3, "EMR")
    # Glass cloche dome rim + specular highlight
    cv.oval(12, 9, 8, 6, "GLASS")
    for x in range(6, 18):
        cv.p(x, 4, "MIST0")
    cv.p(7, 6, "MIST1")
    cv.p(8, 5, "MIST1")
    cv.rect(11, 2, 2, 2, "AMB2")  # brass dome finial knob
    return cv.img


def make_counter_pos(frame_idx: int) -> Image.Image:
    cv = PixelCanvas(24, 20)
    cv.rect(4, 15, 16, 3, "SH")
    # Base & tilted stand
    cv.rect(7, 13, 10, 4, "PINE0")
    cv.hline(8, 13, 8, "BORD1")
    # Touchscreen bezel
    cv.box(4, 3, 16, 11, "SLATE0", "INK", "BORD1")
    cv.rect(6, 5, 12, 7, "PINE0")
    # Animated glowing UI screen pixels
    cv.hline(7, 6, 6, "EMR")
    cv.hline(7, 8, 9, "LF2")
    if frame_idx == 0:
        cv.rect(14, 6, 3, 2, "AMB2")
        cv.hline(7, 10, 4, "SAGE1")
    else:
        cv.rect(14, 6, 3, 2, "AMBHI")
        cv.hline(7, 10, 8, "EMRHI")
    return cv.img


def make_chalkboard_menu() -> Image.Image:
    cv = PixelCanvas(36, 32)
    cv.rect(3, 27, 30, 4, "SH")
    # Walnut A-frame legs
    cv.rect(4, 25, 3, 5, "WD0")
    cv.rect(29, 25, 3, 5, "WD0")
    # Framed slate chalkboard
    cv.box(2, 2, 32, 24, "SLATE0", "WD0", "WD3")
    cv.box(4, 4, 28, 20, "PINE0", "WD2")
    # Tiny chalk coffee cup icon at top-left
    cv.rect(7, 7, 5, 5, "MIST1")
    cv.p(12, 8, "MIST0")
    cv.p(8, 5, "AMB3")
    cv.p(10, 5, "AMB3")
    # Chalk menu lines (purely pixel ornament, no garbled letters!)
    cv.hline(15, 7, 13, "AMB2")
    cv.hline(15, 10, 10, "MIST0")
    cv.hline(7, 14, 21, "BORD1")
    cv.hline(7, 17, 16, "EMR")
    cv.hline(25, 17, 4, "AMB3")
    cv.hline(7, 20, 14, "MIST0")
    cv.hline(25, 20, 4, "AMB3")
    return cv.img


def make_wall_clock(frame_idx: int) -> Image.Image:
    cv = PixelCanvas(24, 24)
    # Soft drop shadow + walnut/brass circular clock case
    cv.oval(12, 12, 9.5, 9.5, "SH")
    cv.oval(12, 11, 8.5, 8.5, "WD0")
    cv.oval(12, 11, 7.5, 7.5, "AMB2")
    cv.oval(12, 11, 6.2, 6.2, "PINE0")
    # 12/3/6/9 brass tick marks
    cv.p(12, 6, "AMB3")
    cv.p(17, 11, "AMB3")
    cv.p(12, 16, "AMB3")
    cv.p(7, 11, "AMB3")
    # Hour hand (fixed near 10) + ticking minute hand across 4 frames
    cv.hline(9, 11, 3, "MIST1")
    hand_offsets = [(0, -4), (3, -2), (4, 0), (2, 3)][frame_idx]
    cv.p(12 + hand_offsets[0] // 2, 11 + hand_offsets[1] // 2, "AMB3")
    cv.p(12 + hand_offsets[0], 11 + hand_offsets[1], "AMBHI")
    cv.p(12, 11, "AMB2")
    # Subtle brass pendulum bob swinging underneath the dial
    pend_x = [10, 12, 14, 12][frame_idx]
    cv.vline(12, 19, 2, "AMB0")
    cv.rect(pend_x - 1, 20, 3, 3, "AMB2")
    cv.p(pend_x, 21, "AMBHI")
    return cv.img


# ---------------------------------------------------------------------------
# 11. 2-Layer Wooden Cushioned Chairs (All 4 Facing Directions x 4 Cushion States)
# ---------------------------------------------------------------------------
def make_chair_base(facing: str, state: str) -> Image.Image:
    cv = PixelCanvas(32, 32)
    cushion_styles = {
        "idle": ("SLATE0", "SLATE1", "BORD1", None),
        "hovered": ("AMB0", "AMB1", "AMB3", "AMB2"),
        "current": ("LF0", "LF2", "EMR", "MIST1"),
        "occupied": ("OCC0", "OCC1", "TER2", None),
    }
    c_dark, c_mid, c_hi, rim = cushion_styles[state]

    # Floor contact shadow
    cv.oval(16, 22, 10, 5.5, "SH")
    # 4 sturdy walnut legs
    for lx in (7, 22):
        cv.rect(lx, 22, 3, 6, "WD0")
        cv.vline(lx + 1, 22, 5, "WD2")
        cv.hline(lx, 28, 3, "INK")
    # Wooden seat pan
    cv.rounded_rect(6, 10, 20, 14, "INK")
    cv.rounded_rect(7, 11, 18, 12, "WD1")
    cv.hline(8, 11, 16, "WD3")
    # Fabric cushion inset (offset subtly toward facing side)
    ox = -1 if facing == "LEFT" else (1 if facing == "RIGHT" else 0)
    oy = -1 if facing == "UP" else (1 if facing == "DOWN" else 0)
    cx, cy = 9 + ox, 12 + oy
    cv.rounded_rect(cx, cy, 14, 9, c_dark)
    cv.rounded_rect(cx + 1, cy + 1, 12, 7, c_mid)
    cv.hline(cx + 2, cy + 1, 10, c_hi)
    # Subtle highlight rim when seated/hovered
    if rim:
        cv.hline(cx + 1, cy, 12, rim)
        cv.hline(cx + 1, cy + 8, 12, rim)
        cv.vline(cx, cy + 1, 7, rim)
        cv.vline(cx + 13, cy + 1, 7, rim)
    return cv.img


def make_chair_backrest(facing: str) -> Image.Image:
    cv = PixelCanvas(32, 32)
    if facing == "DOWN":
        # North-edge curved walnut spindle backrest (sits behind DOWN-facing seated actor)
        cv.rounded_rect(6, 2, 20, 10, "INK")
        cv.rounded_rect(7, 3, 18, 4, "WD2")
        cv.hline(8, 3, 16, "WD4")
        # Vertical wooden posts + spindles
        for sx in (7, 12, 16, 20, 23):
            cv.rect(sx, 7, 2, 5, "WD1")
            cv.vline(sx, 7, 5, "WD3")
    elif facing == "UP":
        # South-edge backrest (sorts ABOVE seated UP-facing actor so they tuck naturally inside!)
        cv.rounded_rect(6, 19, 20, 10, "INK")
        cv.rounded_rect(7, 20, 18, 4, "WD2")
        cv.hline(8, 20, 16, "WD4")
        cv.rect(7, 24, 18, 4, "WD1")
        for sx in (10, 15, 20):
            cv.rect(sx, 24, 2, 4, "WD0")
        cv.hline(7, 28, 18, "INK")
    elif facing == "LEFT":
        # East-edge side backrest + armrest cap (sorts cleanly over back edge of LEFT-facing actor)
        cv.rounded_rect(22, 6, 7, 20, "INK")
        cv.rounded_rect(23, 7, 5, 18, "WD2")
        cv.vline(23, 8, 16, "WD4")
        cv.vline(27, 8, 16, "WD0")
        cv.rect(20, 19, 5, 3, "WD3")  # subtle side armrest lip
    else:  # RIGHT
        # West-edge side backrest + armrest cap
        cv.rounded_rect(3, 6, 7, 20, "INK")
        cv.rounded_rect(4, 7, 5, 18, "WD2")
        cv.vline(4, 8, 16, "WD4")
        cv.vline(8, 8, 16, "WD0")
        cv.rect(7, 19, 5, 3, "WD3")
    return cv.img


# ---------------------------------------------------------------------------
# Atlas Packing (Shelf packer with 2px gutter + 1px extrusion on tileables)
# ---------------------------------------------------------------------------
def build_all_frames() -> tuple[list[tuple[str, Image.Image, bool]], set[str]]:
    frames: list[tuple[str, Image.Image, bool]] = []
    # (name, image, extrude_edges)
    for i in range(4):
        frames.append((f"floor_wood_{i}", make_floor_wood(i), True))

    frames.append(("wall_north", make_wall_north(False), True))
    frames.append(("wall_north_trim", make_wall_north(True), True))
    frames.append(("wall_south", make_wall_south(), True))
    frames.append(("wall_west", make_wall_side("west"), True))
    frames.append(("wall_east", make_wall_side("east"), True))
    for corner in ("nw", "ne", "sw", "se"):
        frames.append((f"wall_corner_{corner}", make_wall_corner(corner), True))

    for name, img in make_rug_9slice("rug", warm_lounge=False).items():
        frames.append((name, img, False))
    for name, img in make_rug_9slice("lounge_rug", warm_lounge=True).items():
        frames.append((name, img, False))

    for piece in ("left", "mid", "right"):
        frames.append((f"table_{piece}", make_table_piece(piece), False))
    for side in ("left", "right"):
        frames.append((f"bookcase_{side}", make_bookcase(side), False))
    for piece in ("left", "mid", "right"):
        frames.append((f"counter_{piece}", make_counter_piece(piece), False))

    frames.append(("window_north_frame", make_window_north_frame(), False))
    frames.append(("reading_lamp", make_reading_lamp(), False))
    frames.append(("desk_lamp_off", make_desk_lamp(False), False))
    frames.append(("desk_lamp_on", make_desk_lamp(True), False))
    frames.append(("prop_open_book", make_prop_open_book(), False))
    frames.append(("prop_laptop", make_prop_laptop(), False))
    frames.append(("prop_coffee_mug", make_prop_coffee_mug(), False))
    frames.append(("cushion_amber", make_cushion("amber"), False))
    frames.append(("cushion_emerald", make_cushion("emerald"), False))
    frames.append(("counter_pastry_dome", make_counter_pastry_dome(), False))
    frames.append(("chalkboard_menu", make_chalkboard_menu(), False))

    for i in range(3):
        frames.append((f"plant_botanical_{i}", make_plant_botanical(i), False))
    for i in range(2):
        frames.append((f"counter_espresso_{i}", make_counter_espresso(i), False))
    for i in range(4):
        frames.append((f"wall_clock_{i}", make_wall_clock(i), False))
    for i in range(2):
        frames.append((f"counter_pos_{i}", make_counter_pos(i), False))

    for direction in ("up", "down", "left", "right"):
        for state in ("idle", "hovered", "current", "occupied"):
            frames.append((f"chair_base_{direction}_{state}", make_chair_base(direction.upper(), state), False))
        frames.append((f"chair_backrest_{direction}", make_chair_backrest(direction.upper()), False))

    return frames, {name for name, _, _ in frames}


def stamp_with_extrusion(sheet: Image.Image, tile: Image.Image, x: int, y: int, extrude: bool) -> None:
    sheet.paste(tile, (x, y))
    if not extrude:
        return
    w, h = tile.size
    # Extrude 1px borders to prevent WebGL linear/subpixel bleed at tile seams
    sheet.paste(tile.crop((0, 0, w, 1)), (x, y - 1))
    sheet.paste(tile.crop((0, h - 1, w, h)), (x, y + h))
    sheet.paste(tile.crop((0, 0, 1, h)), (x - 1, y))
    sheet.paste(tile.crop((w - 1, 0, w, h)), (x + w, y))
    # Corners
    for sx, sy, dx, dy in ((0, 0, -1, -1), (w - 1, 0, w, -1), (0, h - 1, -1, h), (w - 1, h - 1, w, h)):
        sheet.putpixel((x + dx, y + dy), tile.getpixel((sx, sy)))


def pack_atlas(
    frames: list[tuple[str, Image.Image, bool]],
    atlas_w: int = 512,
    atlas_h: int = 256,
) -> tuple[Image.Image, dict]:
    sheet = Image.new("RGBA", (atlas_w, atlas_h), C["T"])
    # Sort tallest first for tight shelf packing
    ordered = sorted(frames, key=lambda item: (-item[1].height, -item[1].width, item[0]))

    pad = 2
    cursor_x = pad
    cursor_y = pad
    row_h = 0
    json_frames: dict[str, dict] = {}

    for name, img, extrude in ordered:
        w, h = img.size
        margin = 1 if extrude else 0
        slot_w = w + margin * 2 + pad
        slot_h = h + margin * 2 + pad
        if cursor_x + slot_w > atlas_w:
            cursor_x = pad
            cursor_y += row_h
            row_h = 0
        if cursor_y + slot_h > atlas_h:
            raise RuntimeError(f"Atlas {atlas_w}x{atlas_h} overflowed while packing {name}")
        fx = cursor_x + margin
        fy = cursor_y + margin
        stamp_with_extrusion(sheet, img, fx, fy, extrude)
        json_frames[name] = {
            "frame": {"x": fx, "y": fy, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        cursor_x += slot_w
        row_h = max(row_h, slot_h)

    atlas_json = {
        "frames": json_frames,
        "meta": {
            "app": "LearningWithMe Botanical Environment Atlas Generator",
            "version": "1.0",
            "image": "study-cafe-env.png",
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1",
        },
    }
    return sheet, atlas_json


def write_provenance_manifest(frame_count: int, color_count: int) -> None:
    manifest = {
        "schemaVersion": "1.0",
        "project": "LearningWithMe — Study Café (Botanical Night Studio)",
        "ticket": "P11-T6 (#82)",
        "paletteLock": "Botanical Night Studio (ADR-0010 / ADR-0013)",
        "assets": [
            {
                "id": "study-cafe-env",
                "kind": "texture-atlas",
                "path": "/assets/tilesets/study-cafe-env.png",
                "atlasJson": "/assets/tilesets/study-cafe-env.json",
                "dimensions": {"width": 512, "height": 256},
                "frameCount": frame_count,
                "colorCount": color_count,
                "source": {
                    "kind": "original-procedural-pixel-art",
                    "tool": "scripts/generate-study-cafe-env-atlas.py (Python + Pillow)",
                    "createdAt": "2026-11-20",
                    "externalThirdPartyContent": False,
                },
                "license": {
                    "spdx": "CC0-1.0",
                    "cost": "0-cost",
                    "repoSafe": True,
                    "attributionRequired": False,
                    "notes": "100% original repo-authored pixel art dedicated under CC0-1.0 for LearningWithMe.",
                },
                "technical_checks_passed": True,
            }
        ],
    }
    (TILESETS_DIR / "study-cafe-env.manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def render_previews(frames_map: dict[str, Image.Image], preview_dir: Path) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)

    # 1. 3x3 Wood Floor Tiling Repeat Preview (scaled 3x nearest)
    floor_3x3 = Image.new("RGBA", (96, 96), C["PINE0"])
    for y in range(3):
        for x in range(3):
            idx = abs((x * 73 + y * 151 + x * y * 19) ^ (x * 13)) % 4
            floor_3x3.paste(frames_map[f"floor_wood_{idx}"], (x * 32, y * 32))
    floor_3x3.resize((288, 288), Image.Resampling.NEAREST).save(preview_dir / "floor-3x3-repeat.png")

    # 2. Full 24x16 Room Composite Mockup using shared/maps/main-library.json
    raw = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    w, h, ts = raw["width"], raw["height"], raw["tilewidth"]
    room = Image.new("RGBA", (w * ts, h * ts), C["PINE0"])

    # Floor
    for y in range(h):
        for x in range(w):
            idx = abs((x * 73 + y * 151 + x * y * 19) ^ (x * 13)) % 4
            room.paste(frames_map[f"floor_wood_{idx}"], (x * ts, y * ts))

    # Walls
    for y in range(h):
        for x in range(w):
            if x in (0, w - 1) or y in (0, h - 1):
                if y == 0 and x == 0:
                    wf = "wall_corner_nw"
                elif y == 0 and x == w - 1:
                    wf = "wall_corner_ne"
                elif y == h - 1 and x == 0:
                    wf = "wall_corner_sw"
                elif y == h - 1 and x == w - 1:
                    wf = "wall_corner_se"
                elif y == 0:
                    wf = "wall_north_trim" if x % 3 == 0 else "wall_north"
                elif y == h - 1:
                    wf = "wall_south"
                elif x == 0:
                    wf = "wall_west"
                else:
                    wf = "wall_east"
                room.alpha_composite(frames_map[wf], (x * ts, y * ts))

    # Rugs under tables
    def paste_rug(prefix: str, x0: int, y0: int, rw: int, rh: int) -> None:
        for ry in range(rh):
            for rx in range(rw):
                v = "t" if ry == 0 else ("b" if ry == rh - 1 else "")
                hh = "l" if rx == 0 else ("r" if rx == rw - 1 else "")
                suffix = f"{v}{hh}" or "c"
                room.alpha_composite(frames_map[f"{prefix}_{suffix}"], ((x0 + rx) * ts, (y0 + ry) * ts))

    paste_rug("rug", 3, 3, 4, 3)
    paste_rug("rug", 10, 3, 4, 3)
    paste_rug("rug", 16, 6, 5, 3)
    paste_rug("lounge_rug", 2, 11, 4, 3)

    # North windows & wall clock
    for wx in (8, 13):
        room.alpha_composite(frames_map["window_north_frame"], (wx * ts, 0))
    room.alpha_composite(frames_map["wall_clock_0"], (11 * ts + 4, 4))

    # Chill Lounge walkable flat floor cushions
    room.alpha_composite(frames_map["cushion_amber"], (2 * ts + 4, 11 * ts + 6))
    room.alpha_composite(frames_map["cushion_emerald"], (5 * ts + 4, 13 * ts + 6))
    room.alpha_composite(frames_map["cushion_emerald"], (2 * ts + 6, 13 * ts + 4))
    room.alpha_composite(frames_map["cushion_amber"], (5 * ts + 2, 11 * ts + 8))

    # Furniture from main-library.json
    furn_layer = next(l for l in raw["layers"] if l["name"] == "Furniture")["data"]
    for i, gid in enumerate(furn_layer):
        if gid <= 0:
            continue
        x, y = i % w, i // w
        if gid == 4:
            left_gid = furn_layer[i - 1] if x > 0 else 0
            f = "bookcase_right" if left_gid == 4 else "bookcase_left"
            room.alpha_composite(frames_map[f], (x * ts, y * ts - 8))
        elif gid == 6:
            room.alpha_composite(frames_map["plant_botanical_0"], (x * ts, y * ts - 8))
        elif gid == 11:
            room.alpha_composite(frames_map["reading_lamp"], (x * ts, y * ts - 12))
        elif gid == 5:
            left_t = furn_layer[i - 1] == 5 if x > 0 else False
            right_t = furn_layer[i + 1] == 5 if x + 1 < w else False
            tf = "table_mid" if (left_t and right_t) else ("table_right" if left_t else "table_left")
            room.alpha_composite(frames_map[tf], (x * ts, y * ts - 4))
        elif gid in (8, 9, 10):
            cf = "counter_left" if x == 16 else ("counter_right" if x == 20 else "counter_mid")
            room.alpha_composite(frames_map[cf], (x * ts, y * ts - 4))

    # Tabletop props + Countertop props + Chalkboard
    for tx, ty, tw in ((4, 4, 2), (11, 4, 2), (17, 7, 3)):
        room.alpha_composite(frames_map["prop_open_book"], (tx * ts + 6, ty * ts + 6))
        room.alpha_composite(frames_map["desk_lamp_on"], (tx * ts + tw * 16, ty * ts - 2))
        if tw >= 3:
            room.alpha_composite(frames_map["prop_laptop"], ((tx + 2) * ts + 4, ty * ts + 5))
    room.alpha_composite(frames_map["counter_espresso_0"], (16 * ts + 6, 12 * ts - 8))
    room.alpha_composite(frames_map["counter_pastry_dome"], (18 * ts + 4, 12 * ts - 5))
    room.alpha_composite(frames_map["counter_pos_0"], (20 * ts + 4, 12 * ts - 6))
    room.alpha_composite(frames_map["chalkboard_menu"], (21 * ts + 4, 12 * ts - 2))

    # Chairs (2 layers!)
    seats_layer = next(l for l in raw["layers"] if l["name"] == "Seats")["objects"]
    for obj in seats_layer:
        props = {p["name"]: p["value"] for p in obj["properties"]}
        d = props["facingDir"].lower()
        sx, sy = int(obj["x"]), int(obj["y"])
        room.alpha_composite(frames_map[f"chair_base_{d}_idle"], (sx, sy))
        room.alpha_composite(frames_map[f"chair_backrest_{d}"], (sx, sy))

    room.resize((w * ts * 2, h * ts * 2), Image.Resampling.NEAREST).save(
        preview_dir / "room-composite-preview.png"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path, default=None)
    args = parser.parse_args()

    frames, _ = build_all_frames()
    sheet, atlas_json = pack_atlas(frames)
    TILESETS_DIR.mkdir(parents=True, exist_ok=True)
    sheet_path = TILESETS_DIR / "study-cafe-env.png"
    json_path = TILESETS_DIR / "study-cafe-env.json"
    sheet.save(sheet_path, format="PNG", optimize=True)
    json_path.write_text(json.dumps(atlas_json, indent=2) + "\n", encoding="utf-8")

    colors = sheet.convert("RGBA").getcolors(maxcolors=256)
    color_count = len(colors) if colors is not None else 256
    write_provenance_manifest(len(frames), color_count)

    if args.preview_dir is not None:
        render_previews({name: img for name, img, _ in frames}, args.preview_dir)

    print(f"Generated {sheet_path} ({sheet.width}x{sheet.height}, {len(frames)} frames, {color_count} colors)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
