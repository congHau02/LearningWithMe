#!/usr/bin/env python3
"""Generate the 0-cost, license-clean Botanical Night Studio 2D Paper-Doll Character Atlas.

Outputs:
  - frontend/public/assets/sprites/study-cafe-characters.png (1024x1024 RGBA, <= 48 colors)
  - frontend/public/assets/sprites/study-cafe-characters.json (Phaser 3 JSON Hash atlas)
  - frontend/public/assets/sprites/study-cafe-characters.manifest.json (CC0-1.0 provenance record)

Optional preview output (pass --preview-dir <dir>):
  - paper-doll-composites.png (4x scaled showcase of starter avatars, unlockable SKIN/HAT/DESK_PET
    composites, Ambient NPCs, and multi-frame animation strips)
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES_DIR = ROOT / "frontend" / "public" / "assets" / "sprites"

FRAME_W = 32
FRAME_H = 48
PET_SIZE = 24
ATLAS_W = 1024
ATLAS_H = 1024

DIRS = ("down", "up", "left", "right")
POSTURE_SPEC: tuple[tuple[str, int], ...] = (
    ("idle", 4),
    ("walk", 6),
    ("sit", 2),
    ("study", 4),
)
NPC_POSTURE_SPEC: tuple[tuple[str, int], ...] = (
    ("idle", 4),
    ("walk", 6),
)

# Locked Botanical Night Studio Character Palette (44 unique RGBA colors <= 48)
C: dict[str, tuple[int, int, int, int]] = {
    "T": (0, 0, 0, 0),
    "SH0": (8, 13, 11, 120),        # outer soft elliptical shadow
    "SH1": (8, 13, 11, 175),        # inner core contact shadow
    "INK": (11, 18, 15, 255),       # deep botanical ink outline
    "SLATE0": (24, 36, 32, 255),    # deep charcoal-pine
    "SLATE1": (44, 62, 56, 255),    # mid slate-leaf
    "BORD1": (74, 98, 90, 255),     # cool sage highlight
    "MIST0": (198, 212, 205, 255),  # soft cream-mist
    "MIST1": (236, 242, 238, 255),  # morning mist highlight
    # Natural warm skin tones (2 subtle variants harmonized to warm café light)
    "SK0": (194, 141, 108, 255),    # skin shadow
    "SK1": (236, 194, 160, 255),    # light warm skin
    "SK2": (248, 218, 192, 255),    # skin highlight
    "SKW0": (176, 120, 86, 255),    # warmer tan shadow
    "SKW1": (222, 170, 132, 255),   # warmer tan mid
    "BLUSH": (224, 136, 126, 255),  # subtle cheek warmth
    # Hair tones
    "HRN0": (20, 28, 38, 255),      # midnight navy hair
    "HRN1": (39, 53, 72, 255),      # navy hair highlight
    "HRB0": (62, 40, 28, 255),      # espresso chestnut hair
    "HRB1": (102, 68, 46, 255),     # chestnut hair highlight
    "HRB2": (136, 94, 64, 255),     # warm auburn rim
    # Starter sky-slate library sweater (default_student)
    "SKY0": (34, 88, 128, 255),
    "SKY1": (56, 138, 188, 255),
    "SKY2": (118, 196, 232, 255),
    # Botanical emerald & teal (student_glasses, student_sprout, headphones, cashier, sprout)
    "EMR0": (18, 76, 62, 255),
    "EMR1": (28, 128, 102, 255),
    "EMR2": (52, 211, 153, 255),    # #34D399 Bioluminescent Emerald
    "EMRHI": (136, 240, 200, 255),
    # Warm Amber & Gold (student_hoodie, barista apron, grad cap tassel, sleepy cat, blazer vest)
    "AMB0": (134, 78, 22, 255),
    "AMB1": (196, 126, 36, 255),
    "AMB2": (229, 169, 60, 255),    # #E5A93C Warm Amber
    "AMBHI": (252, 232, 168, 255),
    # Cobalt Library Hoodie (skin_hoodie_blue & denim)
    "BLU0": (26, 52, 118, 255),
    "BLU1": (44, 92, 188, 255),
    "BLU2": (96, 148, 236, 255),
    # Scholar Blazer Plum/Amethyst (skin_scholar_blazer)
    "PLM0": (64, 30, 104, 255),
    "PLM1": (106, 52, 164, 255),
    "PLM2": (152, 98, 212, 255),
    # Terracotta / Café Berry (npc_apron_server, sprout clay pot)
    "TER0": (110, 38, 44, 255),
    "TER1": (168, 64, 68, 255),
    "TER2": (212, 110, 96, 255),
    # Chestnut Wood / Owl feathers / Shoes
    "WD0": (68, 44, 30, 255),
    "WD1": (112, 74, 48, 255),
    "WD2": (158, 112, 76, 255),
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

    def rounded_box(self, x: int, y: int, w: int, h: int, fill: str, border: str) -> None:
        self.rect(x + 1, y + 1, w - 2, h - 2, fill)
        self.hline(x + 1, y, w - 2, border)
        self.hline(x + 1, y + h - 1, w - 2, border)
        self.vline(x, y + 1, h - 2, border)
        self.vline(x + w - 1, y + 1, h - 2, border)

    def oval(self, cx: float, cy: float, rx: float, ry: float, col: str) -> None:
        c = C[col]
        for yy in range(max(0, int(cy - ry) - 1), min(self.h, int(cy + ry) + 2)):
            for xx in range(max(0, int(cx - rx) - 1), min(self.w, int(cx + rx) + 2)):
                dx = (xx + 0.5 - cx) / rx
                dy = (yy + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.px[xx, yy] = c


@dataclass(frozen=True)
class PoseParams:
    direction: str
    posture: str
    frame: int
    head_y: int
    torso_y: int
    lean_x: int
    blink: bool
    leg_l_dx: int
    leg_l_dy: int
    leg_r_dx: int
    leg_r_dy: int
    arm_l_dy: int
    arm_r_dy: int
    seated: bool
    study_hand_dx: int


def resolve_pose(direction: str, posture: str, frame: int) -> PoseParams:
    """Shared deterministic rig pose so base, outfit, hat, and NPC apron stay 100% pixel-locked."""
    if posture == "idle":
        head_bob = (-1, 0, 0, 0)[frame]
        torso_bob = (0, 0, 0, 0)[frame]
        return PoseParams(
            direction=direction,
            posture=posture,
            frame=frame,
            head_y=8 + head_bob,
            torso_y=23 + torso_bob,
            lean_x=0,
            blink=(frame == 2),
            leg_l_dx=0,
            leg_l_dy=0,
            leg_r_dx=0,
            leg_r_dy=0,
            arm_l_dy=0 if frame != 1 else -1,
            arm_r_dy=0 if frame != 1 else -1,
            seated=False,
            study_hand_dx=0,
        )

    if posture == "walk":
        # 6-frame fluid RPG stride cycle
        bob = (0, 1, -1, 0, 1, -1)[frame]
        leg_l_dy = (-1, 0, 1, 1, 0, -1)[frame]
        leg_r_dy = (1, 0, -1, -1, 0, 1)[frame]
        leg_l_dx = (-2, -1, 0, 2, 1, 0)[frame]
        leg_r_dx = (2, 1, 0, -2, -1, 0)[frame]
        arm_l_dy = (1, 0, -1, -1, 0, 1)[frame]
        arm_r_dy = (-1, 0, 1, 1, 0, -1)[frame]
        return PoseParams(
            direction=direction,
            posture=posture,
            frame=frame,
            head_y=8 + bob,
            torso_y=23 + bob,
            lean_x=0,
            blink=False,
            leg_l_dx=leg_l_dx,
            leg_l_dy=leg_l_dy,
            leg_r_dx=leg_r_dx,
            leg_r_dy=leg_r_dy,
            arm_l_dy=arm_l_dy,
            arm_r_dy=arm_r_dy,
            seated=False,
            study_hand_dx=0,
        )

    if posture == "sit":
        # 2-frame crouch / settle transition paired with SeatTransitionJuice
        drop = 1 if frame == 0 else 2
        return PoseParams(
            direction=direction,
            posture=posture,
            frame=frame,
            head_y=8 + drop,
            torso_y=23 + drop,
            lean_x=0,
            blink=False,
            leg_l_dx=0,
            leg_l_dy=-drop,
            leg_r_dx=0,
            leg_r_dy=-drop,
            arm_l_dy=1,
            arm_r_dy=1,
            seated=(frame == 1),
            study_hand_dx=0,
        )

    # posture == "study" (4-frame seated writing/typing/reading loop)
    head_nod = (0, 0, 0, 1)[frame]
    hand_dx = (0, 1, 0, -1)[frame]
    arm_l = (0, 0, -1, 0)[frame]
    arm_r = (-1, 0, -1, -1)[frame]
    lean = -1 if direction == "left" else (1 if direction == "right" else 0)
    return PoseParams(
        direction=direction,
        posture=posture,
        frame=frame,
        head_y=10 + head_nod,
        torso_y=25,
        lean_x=lean,
        blink=(frame == 2),
        leg_l_dx=0,
        leg_l_dy=0,
        leg_r_dx=0,
        leg_r_dy=0,
        arm_l_dy=arm_l,
        arm_r_dy=arm_r,
        seated=True,
        study_hand_dx=hand_dx,
    )


@dataclass(frozen=True)
class StarterStyle:
    key: str
    skin_dark: str
    skin_mid: str
    skin_hi: str
    hair_dark: str
    hair_hi: str
    shirt_dark: str
    shirt_mid: str
    shirt_hi: str
    pants_dark: str
    pants_mid: str
    accent: str  # 'collar' | 'glasses' | 'neckphones' | 'sprout'


STARTER_STYLES: tuple[StarterStyle, ...] = (
    StarterStyle(
        key="base_default_student",
        skin_dark="SK0",
        skin_mid="SK1",
        skin_hi="SK2",
        hair_dark="HRN0",
        hair_hi="HRN1",
        shirt_dark="SKY0",
        shirt_mid="SKY1",
        shirt_hi="SKY2",
        pants_dark="SLATE0",
        pants_mid="SLATE1",
        accent="collar",
    ),
    StarterStyle(
        key="base_student_glasses",
        skin_dark="SK0",
        skin_mid="SK1",
        skin_hi="SK2",
        hair_dark="HRB0",
        hair_hi="HRB1",
        shirt_dark="EMR0",
        shirt_mid="EMR1",
        shirt_hi="EMR2",
        pants_dark="SLATE0",
        pants_mid="WD0",
        accent="glasses",
    ),
    StarterStyle(
        key="base_student_hoodie",
        skin_dark="SKW0",
        skin_mid="SKW1",
        skin_hi="SK1",
        hair_dark="HRN0",
        hair_hi="HRN1",
        shirt_dark="AMB0",
        shirt_mid="AMB1",
        shirt_hi="AMB2",
        pants_dark="BLU0",
        pants_mid="BLU1",
        accent="neckphones",
    ),
    StarterStyle(
        key="base_student_sprout",
        skin_dark="SK0",
        skin_mid="SK1",
        skin_hi="SK2",
        hair_dark="HRB0",
        hair_hi="HRB2",
        shirt_dark="EMR0",
        shirt_mid="EMR1",
        shirt_hi="EMRHI",
        pants_dark="SLATE0",
        pants_mid="SLATE1",
        accent="sprout",
    ),
)


def draw_legs(cv: PixelCanvas, pose: PoseParams, pants_dark: str, pants_mid: str) -> None:
    y = pose.torso_y + 11
    d = pose.direction
    if pose.seated:
        # Tucked seated knees & shoes
        if d in ("down", "up"):
            cv.rounded_box(10, y, 5, 5, pants_mid, "INK")
            cv.rounded_box(17, y, 5, 5, pants_mid, "INK")
            cv.hline(11, y + 1, 3, pants_dark)
            cv.hline(18, y + 1, 3, pants_dark)
            cv.rect(11, y + 4, 3, 2, "WD0")
            cv.rect(18, y + 4, 3, 2, "WD0")
        elif d == "left":
            cv.rounded_box(9, y, 9, 5, pants_mid, "INK")
            cv.hline(10, y + 3, 7, pants_dark)
            cv.rect(8, y + 3, 3, 3, "WD0")
        else:
            cv.rounded_box(14, y, 9, 5, pants_mid, "INK")
            cv.hline(15, y + 3, 7, pants_dark)
            cv.rect(21, y + 3, 3, 3, "WD0")
        return

    if d in ("down", "up"):
        ly = y + pose.leg_l_dy
        ry = y + pose.leg_r_dy
        # Left leg + shoe
        cv.rect(11, ly, 4, 5, pants_mid)
        cv.vline(10, ly, 6, "INK")
        cv.vline(15, ly, 5, "INK")
        cv.vline(11, ly, 4, pants_dark)
        cv.rect(11, ly + 4, 4, 2, "WD0")
        cv.hline(11, ly + 6, 4, "INK")
        # Right leg + shoe
        cv.rect(17, ry, 4, 5, pants_mid)
        cv.vline(16, ry, 5, "INK")
        cv.vline(21, ry, 6, "INK")
        cv.vline(20, ry, 4, pants_dark)
        cv.rect(17, ry + 4, 4, 2, "WD0")
        cv.hline(17, ry + 6, 4, "INK")
    else:
        # Side stride: front & back leg swing horizontally
        sign = -1 if d == "left" else 1
        bx = 14 + pose.leg_r_dx * sign
        fx = 14 + pose.leg_l_dx * sign
        # Back leg
        cv.rect(bx, y + 1, 4, 5, pants_dark)
        cv.vline(bx - 1, y + 1, 5, "INK")
        cv.vline(bx + 4, y + 1, 5, "INK")
        cv.rect(bx, y + 5, 4, 2, "WD0")
        cv.hline(bx, y + 7, 4, "INK")
        # Front leg
        cv.rect(fx, y, 4, 5, pants_mid)
        cv.vline(fx - 1, y, 6, "INK")
        cv.vline(fx + 4, y, 6, "INK")
        cv.rect(fx, y + 4, 4, 2, "WD1")
        cv.hline(fx, y + 6, 4, "INK")


def draw_torso_base(
    cv: PixelCanvas,
    pose: PoseParams,
    shirt_dark: str,
    shirt_mid: str,
    shirt_hi: str,
    skin_mid: str,
    accent: str,
) -> None:
    ty = pose.torso_y
    d = pose.direction
    if d in ("down", "up"):
        # Core torso
        cv.rounded_box(10, ty, 12, 12, shirt_mid, "INK")
        cv.hline(11, ty + 1, 10, shirt_hi)
        cv.hline(11, ty + 10, 10, shirt_dark)
        cv.vline(11, ty + 2, 8, shirt_dark)
        cv.vline(20, ty + 2, 8, shirt_dark)

        # Left & right arms
        if pose.seated and d == "down":
            # Arms brought forward to study desk with writing pen
            cv.rounded_box(8, ty + 2 + pose.arm_l_dy, 4, 7, shirt_mid, "INK")
            cv.rect(9, ty + 7 + pose.arm_l_dy, 2, 2, skin_mid)
            rx = 20 + pose.study_hand_dx
            cv.rounded_box(rx, ty + 2 + pose.arm_r_dy, 4, 7, shirt_mid, "INK")
            cv.rect(rx + 1, ty + 7 + pose.arm_r_dy, 2, 2, skin_mid)
            # Tiny amber pen in writing hand
            cv.p(rx + 1, ty + 9 + pose.arm_r_dy, "AMB2")
            cv.p(rx + 2, ty + 10 + pose.arm_r_dy, "AMBHI")
        elif pose.seated and d == "up":
            cv.rounded_box(8, ty + 1 + pose.arm_l_dy, 4, 7, shirt_dark, "INK")
            cv.rounded_box(20, ty + 1 + pose.arm_r_dy, 4, 7, shirt_dark, "INK")
        else:
            cv.rounded_box(7, ty + 1 + pose.arm_l_dy, 4, 9, shirt_mid, "INK")
            cv.rect(8, ty + 8 + pose.arm_l_dy, 2, 2, skin_mid)
            cv.rounded_box(21, ty + 1 + pose.arm_r_dy, 4, 9, shirt_mid, "INK")
            cv.rect(22, ty + 8 + pose.arm_r_dy, 2, 2, skin_mid)

        # Starter torso details (front only)
        if d == "down":
            if accent == "collar":
                cv.hline(13, ty + 1, 6, "MIST1")
                cv.rect(15, ty + 2, 2, 2, "MIST0")
            elif accent == "glasses":
                # Cardigan V-neck + cream shirt
                cv.rect(14, ty + 1, 4, 3, "MIST1")
                cv.rect(15, ty + 4, 2, 6, "EMR0")
            elif accent == "neckphones":
                # Cozy amber hoodie pocket + sleek lofi neck-worn headphones
                cv.hline(13, ty + 7, 6, shirt_dark)
                cv.rect(13, ty + 8, 6, 2, shirt_dark)
                cv.hline(12, ty + 1, 8, "SLATE0")
                cv.rect(11, ty + 1, 2, 3, "EMR2")
                cv.rect(19, ty + 1, 2, 3, "EMR2")
            elif accent == "sprout":
                cv.hline(13, ty + 1, 6, "MIST1")
                cv.p(15, ty + 4, "EMRHI")
                cv.p(16, ty + 4, "EMRHI")
        elif d == "up" and accent == "neckphones":
            # Resting hood flap on back
            cv.rounded_box(12, ty + 1, 8, 4, shirt_dark, "INK")
    else:
        # Side profile torso (LEFT or RIGHT)
        cx = 11 + pose.lean_x
        cv.rounded_box(cx, ty, 10, 12, shirt_mid, "INK")
        cv.hline(cx + 1, ty + 1, 8, shirt_hi)
        cv.hline(cx + 1, ty + 10, 8, shirt_dark)
        if d == "left":
            cv.vline(cx + 8, ty + 2, 8, shirt_dark)
        else:
            cv.vline(cx + 1, ty + 2, 8, shirt_dark)

        # Near arm
        if pose.seated:
            ax = (cx - 2 + pose.study_hand_dx) if d == "left" else (cx + 8 + pose.study_hand_dx)
            cv.rounded_box(ax, ty + 3 + pose.arm_r_dy, 4, 6, shirt_mid, "INK")
            cv.rect(ax + 1, ty + 7 + pose.arm_r_dy, 2, 2, skin_mid)
            cv.p(ax + (0 if d == "left" else 3), ty + 8 + pose.arm_r_dy, "AMB2")
        else:
            swing = (pose.arm_l_dy) * (-1 if d == "left" else 1)
            ax = cx + 3 + swing
            cv.rounded_box(ax, ty + 2, 4, 8, shirt_hi, "INK")
            cv.rect(ax + 1, ty + 8, 2, 2, skin_mid)

        if accent == "neckphones":
            nx = cx + 2 if d == "left" else cx + 6
            cv.rect(nx, ty + 1, 2, 3, "EMR2")


def draw_head(cv: PixelCanvas, pose: PoseParams, style: StarterStyle) -> None:
    hy = pose.head_y
    hx = 9 + pose.lean_x
    d = pose.direction

    # Softened chibi head silhouette (rounded chin & crown corners)
    cv.rounded_box(hx, hy, 14, 15, style.skin_mid, "INK")
    cv.p(hx, hy + 13, "T")
    cv.p(hx + 13, hy + 13, "T")
    cv.p(hx + 1, hy + 13, "INK")
    cv.p(hx + 12, hy + 13, "INK")
    cv.hline(hx + 2, hy + 1, 10, style.skin_hi)
    cv.hline(hx + 2, hy + 13, 10, style.skin_dark)

    if d == "down":
        # Rounded layered hair crown & bangs
        cv.rounded_box(hx - 1, hy - 2, 16, 7, style.hair_dark, "INK")
        cv.p(hx - 1, hy - 1, "T")
        cv.p(hx + 14, hy - 1, "T")
        cv.p(hx, hy - 2, "T")
        cv.p(hx + 13, hy - 2, "T")
        cv.p(hx, hy - 1, "INK")
        cv.p(hx + 13, hy - 1, "INK")
        cv.hline(hx + 2, hy - 1, 10, style.hair_hi)
        cv.hline(hx + 1, hy + 3, 3, style.hair_dark)
        cv.hline(hx + 10, hy + 3, 3, style.hair_dark)
        cv.rect(hx, hy + 4, 2, 5, style.hair_dark)
        cv.rect(hx + 12, hy + 4, 2, 5, style.hair_dark)
        # Bang tufts
        cv.rect(hx + 3, hy + 4, 2, 2, style.hair_dark)
        cv.rect(hx + 7, hy + 4, 2, 1, style.hair_dark)
        cv.rect(hx + 10, hy + 4, 2, 2, style.hair_dark)

        # Eyes (blink on idle f2 / study f2)
        if pose.blink:
            cv.hline(hx + 3, hy + 8, 3, "INK")
            cv.hline(hx + 8, hy + 8, 3, "INK")
        else:
            cv.rect(hx + 3, hy + 7, 2, 3, "INK")
            cv.p(hx + 3, hy + 7, "MIST1")
            cv.rect(hx + 9, hy + 7, 2, 3, "INK")
            cv.p(hx + 9, hy + 7, "MIST1")

        # Cheeks & soft smile
        cv.p(hx + 2, hy + 10, "BLUSH")
        cv.p(hx + 11, hy + 10, "BLUSH")
        cv.hline(hx + 6, hy + 11, 2, style.skin_dark)

        if style.accent == "glasses":
            cv.hline(hx + 2, hy + 6, 4, "MIST0")
            cv.hline(hx + 2, hy + 10, 4, "MIST0")
            cv.vline(hx + 2, hy + 6, 5, "MIST0")
            cv.vline(hx + 5, hy + 6, 5, "MIST0")
            cv.hline(hx + 8, hy + 6, 4, "MIST0")
            cv.hline(hx + 8, hy + 10, 4, "MIST0")
            cv.vline(hx + 8, hy + 6, 5, "MIST0")
            cv.vline(hx + 11, hy + 6, 5, "MIST0")
            cv.hline(hx + 6, hy + 8, 2, "MIST0")

    elif d == "up":
        # Rounded full back hair with warm rim highlight
        cv.rounded_box(hx - 1, hy - 2, 16, 15, style.hair_dark, "INK")
        cv.p(hx - 1, hy - 1, "T")
        cv.p(hx + 14, hy - 1, "T")
        cv.p(hx, hy - 2, "T")
        cv.p(hx + 13, hy - 2, "T")
        cv.p(hx, hy - 1, "INK")
        cv.p(hx + 13, hy - 1, "INK")
        cv.hline(hx + 2, hy, 10, style.hair_hi)
        cv.hline(hx + 3, hy + 3, 8, style.hair_hi)
        cv.hline(hx + 1, hy + 11, 12, "INK")
        cv.hline(hx + 2, hy + 12, 10, style.skin_dark)

    elif d == "left":
        # Rounded side profile facing LEFT
        cv.rounded_box(hx - 1, hy - 2, 15, 7, style.hair_dark, "INK")
        cv.p(hx - 1, hy - 1, "T")
        cv.p(hx + 13, hy - 1, "T")
        cv.p(hx, hy - 2, "T")
        cv.p(hx + 12, hy - 2, "T")
        cv.p(hx, hy - 1, "INK")
        cv.p(hx + 12, hy - 1, "INK")
        cv.rect(hx + 8, hy + 3, 6, 9, style.hair_dark)
        cv.vline(hx + 14, hy + 3, 9, "INK")
        cv.hline(hx + 2, hy - 1, 9, style.hair_hi)
        cv.vline(hx + 11, hy + 4, 6, style.hair_hi)
        # Single visible eye on left cheek
        if pose.blink:
            cv.hline(hx + 2, hy + 8, 3, "INK")
        else:
            cv.rect(hx + 2, hy + 7, 2, 3, "INK")
            cv.p(hx + 2, hy + 7, "MIST1")
        cv.p(hx + 4, hy + 10, "BLUSH")
        if style.accent == "glasses":
            cv.hline(hx + 1, hy + 6, 4, "MIST0")
            cv.hline(hx + 1, hy + 10, 4, "MIST0")
            cv.vline(hx + 1, hy + 6, 5, "MIST0")
            cv.vline(hx + 4, hy + 6, 5, "MIST0")
            cv.hline(hx + 5, hy + 8, 4, "MIST0")

    else:
        # Rounded side profile facing RIGHT
        cv.rounded_box(hx, hy - 2, 15, 7, style.hair_dark, "INK")
        cv.p(hx, hy - 1, "T")
        cv.p(hx + 14, hy - 1, "T")
        cv.p(hx + 1, hy - 2, "T")
        cv.p(hx + 13, hy - 2, "T")
        cv.p(hx + 1, hy - 1, "INK")
        cv.p(hx + 13, hy - 1, "INK")
        cv.rect(hx, hy + 3, 6, 9, style.hair_dark)
        cv.vline(hx - 1, hy + 3, 9, "INK")
        cv.hline(hx + 3, hy - 1, 9, style.hair_hi)
        cv.vline(hx + 2, hy + 4, 6, style.hair_hi)
        if pose.blink:
            cv.hline(hx + 9, hy + 8, 3, "INK")
        else:
            cv.rect(hx + 10, hy + 7, 2, 3, "INK")
            cv.p(hx + 11, hy + 7, "MIST1")
        cv.p(hx + 9, hy + 10, "BLUSH")
        if style.accent == "glasses":
            cv.hline(hx + 9, hy + 6, 4, "MIST0")
            cv.hline(hx + 9, hy + 10, 4, "MIST0")
            cv.vline(hx + 9, hy + 6, 5, "MIST0")
            cv.vline(hx + 12, hy + 6, 5, "MIST0")
            cv.hline(hx + 5, hy + 8, 4, "MIST0")

    # Signature animated sprout leaf for student_sprout
    if style.accent == "sprout":
        sway = -1 if pose.frame % 2 == 1 else 0
        sx = hx + 7 + sway
        sy = hy - 5
        cv.vline(sx, sy + 2, 3, "EMR1")
        cv.rect(sx + 1, sy, 3, 2, "EMR2")
        cv.p(sx + 2, sy, "EMRHI")
        cv.rect(sx - 2, sy + 1, 2, 2, "EMR2")


def render_base_frame(style: StarterStyle, pose: PoseParams) -> Image.Image:
    cv = PixelCanvas(FRAME_W, FRAME_H)
    draw_legs(cv, pose, style.pants_dark, style.pants_mid)
    draw_torso_base(cv, pose, style.shirt_dark, style.shirt_mid, style.shirt_hi, style.skin_mid, style.accent)
    draw_head(cv, pose, style)
    return cv.img


def render_outfit_frame(outfit_id: str, pose: PoseParams) -> Image.Image:
    """Aligned SKIN outfit overlay covering torso, collar, sleeves & hood cleanly over base body."""
    cv = PixelCanvas(FRAME_W, FRAME_H)
    ty = pose.torso_y
    d = pose.direction

    if outfit_id == "outfit_skin_hoodie_blue":
        dark, mid, hi = "BLU0", "BLU1", "BLU2"
        if d in ("down", "up"):
            cv.rounded_box(10, ty, 12, 12, mid, "INK")
            cv.hline(11, ty + 1, 10, hi)
            cv.hline(11, ty + 10, 10, dark)
            # Arms
            if pose.seated and d == "down":
                cv.rounded_box(8, ty + 2 + pose.arm_l_dy, 4, 6, mid, "INK")
                cv.rounded_box(20 + pose.study_hand_dx, ty + 2 + pose.arm_r_dy, 4, 6, mid, "INK")
            elif pose.seated and d == "up":
                cv.rounded_box(8, ty + 1 + pose.arm_l_dy, 4, 6, dark, "INK")
                cv.rounded_box(20, ty + 1 + pose.arm_r_dy, 4, 6, dark, "INK")
            else:
                cv.rounded_box(7, ty + 1 + pose.arm_l_dy, 4, 7, mid, "INK")
                cv.rounded_box(21, ty + 1 + pose.arm_r_dy, 4, 7, mid, "INK")

            if d == "down":
                # Hood rim + drawstrings + kangaroo pocket
                cv.hline(11, ty + 1, 10, dark)
                cv.vline(14, ty + 2, 4, "MIST1")
                cv.vline(17, ty + 2, 4, "MIST1")
                cv.rect(12, ty + 7, 8, 3, dark)
                cv.hline(13, ty + 7, 6, hi)
            else:
                # Hood draped over back shoulders
                cv.rounded_box(11, ty - 1, 10, 5, dark, "INK")
                cv.hline(13, ty, 6, hi)
        else:
            cx = 11 + pose.lean_x
            cv.rounded_box(cx, ty, 10, 12, mid, "INK")
            cv.hline(cx + 1, ty + 1, 8, hi)
            cv.hline(cx + 1, ty + 10, 8, dark)
            # Back hood bulge tucked neatly into neckline
            hx = cx + 7 if d == "left" else cx - 1
            cv.rounded_box(hx, ty, 4, 5, dark, "INK")
            # Near sleeve
            if pose.seated:
                ax = (cx - 2 + pose.study_hand_dx) if d == "left" else (cx + 8 + pose.study_hand_dx)
                cv.rounded_box(ax, ty + 3 + pose.arm_r_dy, 4, 5, mid, "INK")
            else:
                swing = pose.arm_l_dy * (-1 if d == "left" else 1)
                cv.rounded_box(cx + 3 + swing, ty + 2, 4, 6, hi, "INK")

    elif outfit_id == "outfit_skin_scholar_blazer":
        dark, mid, hi = "PLM0", "PLM1", "PLM2"
        if d in ("down", "up"):
            cv.rounded_box(10, ty, 12, 12, mid, "INK")
            cv.hline(11, ty + 1, 10, hi)
            cv.hline(11, ty + 10, 10, dark)
            if pose.seated and d == "down":
                cv.rounded_box(8, ty + 2 + pose.arm_l_dy, 4, 6, mid, "INK")
                cv.hline(9, ty + 6 + pose.arm_l_dy, 2, "AMB2")
                rx = 20 + pose.study_hand_dx
                cv.rounded_box(rx, ty + 2 + pose.arm_r_dy, 4, 6, mid, "INK")
                cv.hline(rx + 1, ty + 6 + pose.arm_r_dy, 2, "AMB2")
            elif pose.seated and d == "up":
                cv.rounded_box(8, ty + 1 + pose.arm_l_dy, 4, 6, dark, "INK")
                cv.rounded_box(20, ty + 1 + pose.arm_r_dy, 4, 6, dark, "INK")
            else:
                cv.rounded_box(7, ty + 1 + pose.arm_l_dy, 4, 7, mid, "INK")
                cv.hline(8, ty + 6 + pose.arm_l_dy, 2, "AMB2")
                cv.rounded_box(21, ty + 1 + pose.arm_r_dy, 4, 7, mid, "INK")
                cv.hline(22, ty + 6 + pose.arm_r_dy, 2, "AMB2")

            if d == "down":
                # Cream shirt + Warm Amber scholar V-vest + brass crest pin
                cv.rect(14, ty + 1, 4, 2, "MIST1")
                cv.rect(14, ty + 3, 4, 4, "AMBHI")
                cv.rect(15, ty + 7, 2, 2, "AMB2")
                cv.vline(13, ty + 2, 7, dark)
                cv.vline(18, ty + 2, 7, dark)
                cv.rect(18, ty + 4, 2, 2, "AMB2")
            else:
                # Tailored back vent & shoulder seam
                cv.hline(11, ty + 2, 10, dark)
                cv.vline(16, ty + 7, 4, dark)
        else:
            cx = 11 + pose.lean_x
            cv.rounded_box(cx, ty, 10, 12, mid, "INK")
            cv.hline(cx + 1, ty + 1, 8, hi)
            cv.hline(cx + 1, ty + 10, 8, dark)
            # Front lapel & brass pin
            lx = cx + 1 if d == "left" else cx + 7
            cv.vline(lx, ty + 2, 6, "AMBHI")
            cv.p(lx + (1 if d == "left" else -1), ty + 4, "AMB2")
            if pose.seated:
                ax = (cx - 2 + pose.study_hand_dx) if d == "left" else (cx + 8 + pose.study_hand_dx)
                cv.rounded_box(ax, ty + 3 + pose.arm_r_dy, 4, 5, mid, "INK")
                cv.hline(ax + 1, ty + 6 + pose.arm_r_dy, 2, "AMB2")
            else:
                swing = pose.arm_l_dy * (-1 if d == "left" else 1)
                cv.rounded_box(cx + 3 + swing, ty + 2, 4, 6, hi, "INK")
                cv.hline(cx + 4 + swing, ty + 6, 2, "AMB2")

    return cv.img


def render_npc_apron_frame(apron_id: str, pose: PoseParams) -> Image.Image:
    """Aligned Ambient NPC café apron layer (Barista, Cashier, Server)."""
    cv = PixelCanvas(FRAME_W, FRAME_H)
    ty = pose.torso_y
    d = pose.direction

    palettes = {
        "npc_apron_barista": ("AMB0", "AMB1", "AMB2", "AMBHI"),
        "npc_apron_cashier": ("EMR0", "EMR1", "EMR2", "MIST1"),
        "npc_apron_server": ("TER0", "TER1", "TER2", "MIST1"),
    }
    dark, mid, hi, trim = palettes[apron_id]

    if d == "down":
        # Neck straps
        cv.vline(13, ty + 1, 3, dark)
        cv.vline(18, ty + 1, 3, dark)
        # Main bib apron + waist tie + pocket
        cv.rounded_box(11, ty + 3, 10, 9, mid, "INK")
        cv.hline(12, ty + 4, 8, trim)
        cv.hline(11, ty + 6, 10, dark)
        cv.rect(13, ty + 8, 6, 3, dark)
        cv.hline(14, ty + 8, 4, hi)
    elif d == "up":
        # Back crossed straps & neat bow tie at waist
        cv.hline(11, ty + 6, 10, dark)
        cv.rect(14, ty + 5, 4, 3, mid)
        cv.p(13, ty + 6, hi)
        cv.p(18, ty + 6, hi)
        cv.vline(14, ty + 8, 3, trim)
        cv.vline(17, ty + 8, 3, trim)
    elif d == "left":
        cx = 11 + pose.lean_x
        cv.rounded_box(cx, ty + 3, 7, 9, mid, "INK")
        cv.hline(cx + 1, ty + 4, 5, trim)
        cv.hline(cx + 1, ty + 6, 8, dark)
        cv.rect(cx + 8, ty + 5, 2, 3, hi)
    else:
        cx = 11 + pose.lean_x
        cv.rounded_box(cx + 3, ty + 3, 7, 9, mid, "INK")
        cv.hline(cx + 4, ty + 4, 5, trim)
        cv.hline(cx + 1, ty + 6, 8, dark)
        cv.rect(cx, ty + 5, 2, 3, hi)

    return cv.img


def render_hat_frame(hat_id: str, pose: PoseParams) -> Image.Image:
    """Aligned HAT pixel-art overlay locked to head_y and lean_x across all poses."""
    cv = PixelCanvas(FRAME_W, FRAME_H)
    hy = pose.head_y
    hx = 9 + pose.lean_x
    d = pose.direction

    if hat_id == "hat_headphones":
        if d in ("down", "up"):
            # Padded headband arch over crown
            cv.hline(hx + 2, hy - 3, 10, "INK")
            cv.hline(hx + 2, hy - 2, 10, "MIST1")
            cv.hline(hx + 1, hy - 1, 2, "MIST0")
            cv.hline(hx + 11, hy - 1, 2, "MIST0")
            cv.vline(hx - 1, hy, 7, "MIST0")
            cv.vline(hx + 14, hy, 7, "MIST0")
            # Glowing bioluminescent-emerald earcups
            cv.rounded_box(hx - 3, hy + 4, 4, 7, "EMR1", "INK")
            cv.vline(hx - 2, hy + 5, 5, "EMR2")
            cv.p(hx - 2, hy + 6, "EMRHI")
            cv.rounded_box(hx + 13, hy + 4, 4, 7, "EMR1", "INK")
            cv.vline(hx + 15, hy + 5, 5, "EMR2")
            cv.p(hx + 15, hy + 6, "EMRHI")
        else:
            # Side profile: sleek arch band + centered studio earcup
            ex = hx + 6 if d == "left" else hx + 4
            cv.hline(ex - 1, hy - 3, 6, "INK")
            cv.hline(ex - 1, hy - 2, 6, "MIST1")
            cv.rect(ex + 1, hy - 1, 2, 5, "MIST0")
            cv.rounded_box(ex - 1, hy + 4, 6, 7, "EMR1", "INK")
            cv.rect(ex + 1, hy + 5, 2, 5, "EMR2")
            cv.p(ex + 1, hy + 6, "EMRHI")

    elif hat_id == "hat_graduation_cap":
        # Swinging tassel motion synced to walk/study frames
        sway = (0, 1, 0, -1, 0, 1)[pose.frame % 6] if pose.posture in ("walk", "study") else 0
        # Cap skull base
        cv.rounded_box(hx + 1, hy - 3, 12, 4, "SLATE0", "INK")
        # Diamond mortarboard top
        cv.hline(hx + 4, hy - 7, 6, "INK")
        cv.hline(hx + 1, hy - 6, 12, "INK")
        cv.hline(hx - 1, hy - 5, 16, "INK")
        cv.hline(hx - 2, hy - 4, 18, "INK")
        cv.hline(hx + 4, hy - 6, 6, "SLATE1")
        cv.hline(hx + 1, hy - 5, 12, "SLATE1")
        cv.hline(hx - 1, hy - 4, 16, "SLATE0")
        # Warm Amber center button + trim
        cv.rect(hx + 6, hy - 5, 2, 1, "AMB2")
        # Direction-aware swinging gold tassel
        if d == "left":
            tx = hx - 1 + sway
            cv.hline(hx, hy - 4, 6, "AMB2")
        elif d == "up":
            tx = hx + 1 + sway
            cv.hline(hx + 1, hy - 4, 6, "AMB2")
        else:
            tx = hx + 14 + sway
            cv.hline(hx + 7, hy - 4, 7, "AMB2")
        cv.vline(tx, hy - 4, 5, "AMB2")
        cv.rect(tx - 1, hy + 1, 3, 2, "AMB1")
        cv.p(tx, hy + 1, "AMBHI")

    return cv.img


def render_desk_pet_frame(pet_id: str, frame: int) -> Image.Image:
    """Render 24x24 animated DESK_PET companion sprite (4-frame loop)."""
    cv = PixelCanvas(PET_SIZE, PET_SIZE)
    bob = -1 if frame in (1, 2) else 0

    if pet_id == "pet_sprout_pot":
        # Warm terracotta study pot
        cv.rounded_box(6, 12, 12, 9, "TER1", "INK")
        cv.hline(7, 13, 10, "TER2")
        cv.hline(7, 19, 10, "TER0")
        cv.rounded_box(5, 10, 14, 4, "TER2", "INK")
        cv.hline(7, 11, 10, "WD0")  # rich soil
        # Swaying bioluminescent sprout leaves
        sway = (0, 1, 0, -1)[frame]
        cv.vline(12, 6, 6, "EMR1")
        cv.rounded_box(7 + sway, 4 + bob, 6, 4, "EMR2", "INK")
        cv.hline(8 + sway, 5 + bob, 3, "EMRHI")
        cv.rounded_box(12 + sway, 3 - bob, 6, 4, "EMR2", "INK")
        cv.hline(13 + sway, 4 - bob, 3, "EMRHI")
        if frame == 2:
            cv.p(15 + sway, 2, "AMBHI")  # gentle morning dewdrop sparkle

    elif pet_id == "pet_sleepy_cat":
        # Curled ginger-amber tabby cat
        cv.rounded_box(5, 11 + bob, 14, 10, "AMB2", "INK")
        cv.hline(7, 12 + bob, 10, "AMBHI")
        cv.hline(7, 19 + bob, 10, "AMB1")
        # Ears
        cv.rounded_box(6, 8 + bob, 4, 4, "AMB2", "INK")
        cv.p(7, 10 + bob, "BLUSH")
        cv.rounded_box(14, 8 + bob, 4, 4, "AMB2", "INK")
        cv.p(16, 10 + bob, "BLUSH")
        # Tabby forehead stripes
        cv.vline(11, 11 + bob, 2, "AMB0")
        cv.vline(13, 11 + bob, 2, "AMB0")
        # Sleepy blinking eyes & tiny nose
        if frame in (0, 2, 3):
            cv.hline(8, 15 + bob, 2, "INK")
            cv.hline(14, 15 + bob, 2, "INK")
        else:
            cv.rect(8, 14 + bob, 2, 2, "INK")
            cv.rect(14, 14 + bob, 2, 2, "INK")
            cv.p(8, 14 + bob, "MIST1")
            cv.p(14, 14 + bob, "MIST1")
        cv.p(12, 16 + bob, "TER1")
        # Wagging curled tail
        tail_y = 16 + (0, -1, 0, 1)[frame]
        cv.rounded_box(18, tail_y, 4, 3, "AMB1", "INK")
        cv.p(20, tail_y + 1, "AMBHI")

    elif pet_id == "pet_wise_owl":
        # Chestnut nocturnal study owl
        cv.rounded_box(6, 7 + bob, 12, 14, "WD1", "INK")
        cv.hline(8, 8 + bob, 8, "WD2")
        # Ear tufts
        cv.rect(6, 5 + bob, 3, 3, "WD0")
        cv.rect(15, 5 + bob, 3, 3, "WD0")
        # Cream feathered belly
        cv.rounded_box(9, 14 + bob, 6, 6, "MIST0", "INK")
        cv.hline(10, 15 + bob, 4, "MIST1")
        cv.p(10, 17 + bob, "WD1")
        cv.p(13, 17 + bob, "WD1")
        # Expressive golden eyes (blink on frame 2)
        if frame == 2:
            cv.hline(8, 11 + bob, 3, "INK")
            cv.hline(13, 11 + bob, 3, "INK")
        else:
            cv.rect(8, 10 + bob, 3, 3, "AMBHI")
            cv.rect(13, 10 + bob, 3, 3, "AMBHI")
            cv.p(9, 11 + bob, "INK")
            cv.p(14, 11 + bob, "INK")
        # Beak
        cv.rect(11, 12 + bob, 2, 2, "AMB2")
        # Subtle wing ruffle on frame 3
        wx = 1 if frame == 3 else 0
        cv.rounded_box(4 - wx, 12 + bob, 3, 6, "WD0", "INK")
        cv.rounded_box(17 + wx, 12 + bob, 3, 6, "WD0", "INK")
        # Tiny feet
        cv.hline(9, 21, 2, "AMB1")
        cv.hline(13, 21, 2, "AMB1")

    return cv.img


def render_shadow(w: int, h: int) -> Image.Image:
    cv = PixelCanvas(w, h)
    cv.oval(w / 2, h / 2, w / 2 - 1, h / 2 - 0.8, "SH0")
    cv.oval(w / 2, h / 2, w / 2 - 4, h / 2 - 2.0, "SH1")
    return cv.img


def pack_atlas(preview_dir: Path | None = None) -> dict:
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), C["T"])
    frames_meta: dict[str, dict] = {}

    def place(name: str, img: Image.Image, x: int, y: int) -> None:
        w, h = img.size
        assert x + w <= ATLAS_W and y + h <= ATLAS_H, f"Frame {name} exceeds {ATLAS_W}x{ATLAS_H} at ({x},{y})"
        atlas.paste(img, (x, y))
        frames_meta[name] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }

    def place_full_layer(layer_id: str, renderer, origin_x: int, origin_y: int) -> None:
        for row_idx, d in enumerate(DIRS):
            col = 0
            for posture, count in POSTURE_SPEC:
                for f in range(count):
                    pose = resolve_pose(d, posture, f)
                    img = renderer(pose)
                    place(f"{layer_id}_{d}_{posture}_{f}", img, origin_x + col * FRAME_W, origin_y + row_idx * FRAME_H)
                    col += 1

    # Left half (x = 0..511): 4 Starter Bases + skin_hoodie_blue (5 * 192 = 960px tall)
    for idx, style in enumerate(STARTER_STYLES):
        place_full_layer(style.key, lambda p, s=style: render_base_frame(s, p), 0, idx * 192)
    place_full_layer(
        "outfit_skin_hoodie_blue",
        lambda p: render_outfit_frame("outfit_skin_hoodie_blue", p),
        0,
        4 * 192,
    )

    # Right half (x = 512..1023): skin_scholar_blazer + 2 hats (3 * 192 = 576px tall)
    place_full_layer(
        "outfit_skin_scholar_blazer",
        lambda p: render_outfit_frame("outfit_skin_scholar_blazer", p),
        512,
        0,
    )
    place_full_layer(
        "hat_headphones",
        lambda p: render_hat_frame("hat_headphones", p),
        512,
        192,
    )
    place_full_layer(
        "hat_graduation_cap",
        lambda p: render_hat_frame("hat_graduation_cap", p),
        512,
        384,
    )

    # Right half lower (y = 576..959): 3 NPC aprons (idle 4f + walk 6f = 40 frames each -> 120 frames = 8 rows x 16 cols)
    npc_slots: list[tuple[str, Image.Image]] = []
    for apron_id in ("npc_apron_barista", "npc_apron_cashier", "npc_apron_server"):
        for d in DIRS:
            for posture, count in NPC_POSTURE_SPEC:
                for f in range(count):
                    pose = resolve_pose(d, posture, f)
                    npc_slots.append((f"{apron_id}_{d}_{posture}_{f}", render_npc_apron_frame(apron_id, pose)))

    for slot_idx, (name, img) in enumerate(npc_slots):
        col = slot_idx % 16
        row = slot_idx // 16
        place(name, img, 512 + col * FRAME_W, 576 + row * FRAME_H)

    # Bottom strip (y = 960..1023): 3 animated DESK_PET companions (24x24 x 4f) + pixel-art shadows
    pet_x = 0
    for pet_id in ("pet_sprout_pot", "pet_sleepy_cat", "pet_wise_owl"):
        for f in range(4):
            place(f"{pet_id}_{f}", render_desk_pet_frame(pet_id, f), pet_x, 968)
            pet_x += PET_SIZE + 4

    place("shadow_actor", render_shadow(24, 10), pet_x + 12, 976)
    place("shadow_pet", render_shadow(14, 6), pet_x + 48, 978)

    # Verify technical pixel-art constraints (RGBA alpha present, unique colors <= 48)
    colors = atlas.getcolors(maxcolors=256)
    assert colors is not None, "Atlas exceeded 256 colors!"
    color_count = len(colors)
    assert color_count <= 48, f"Palette lock violated: {color_count} > 48 colors"
    assert any(rgba[3] == 0 for _, rgba in colors), "Atlas must preserve full alpha transparency"

    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    png_path = SPRITES_DIR / "study-cafe-characters.png"
    json_path = SPRITES_DIR / "study-cafe-characters.json"
    manifest_path = SPRITES_DIR / "study-cafe-characters.manifest.json"

    atlas.save(png_path, format="PNG", optimize=True)

    atlas_json = {
        "frames": frames_meta,
        "meta": {
            "app": "LearningWithMe Botanical Paper-Doll Pipeline",
            "version": "1.0",
            "image": "study-cafe-characters.png",
            "format": "RGBA8888",
            "size": {"w": ATLAS_W, "h": ATLAS_H},
            "scale": "1",
        },
    }
    json_path.write_text(json.dumps(atlas_json, indent=2) + "\n", encoding="utf-8")

    manifest_json = {
        "schemaVersion": "1.0",
        "project": "LearningWithMe — Study Café (Botanical Night Studio)",
        "ticket": "P11-T7 (#83)",
        "paletteLock": "Botanical Night Studio (ADR-0010 / ADR-0013)",
        "assets": [
            {
                "id": "study-cafe-characters",
                "kind": "paper-doll-texture-atlas",
                "path": "/assets/sprites/study-cafe-characters.png",
                "atlasJson": "/assets/sprites/study-cafe-characters.json",
                "dimensions": {"width": ATLAS_W, "height": ATLAS_H},
                "frameCount": len(frames_meta),
                "colorCount": color_count,
                "source": {
                    "kind": "original-procedural-pixel-art",
                    "tool": "scripts/generate-study-cafe-characters-atlas.py (Python + Pillow)",
                    "createdAt": "2026-11-20",
                    "externalThirdPartyContent": False,
                },
                "license": {
                    "spdx": "CC0-1.0",
                    "cost": "0-cost",
                    "repoSafe": True,
                    "attributionRequired": False,
                    "notes": "100% original repo-authored 32x48 Paper-Doll pixel art dedicated under CC0-1.0.",
                },
                "technical_checks_passed": True,
            }
        ],
    }
    manifest_path.write_text(json.dumps(manifest_json, indent=2) + "\n", encoding="utf-8")

    if preview_dir is not None:
        build_composite_preview(atlas, frames_meta, preview_dir)

    return {
        "png": str(png_path),
        "frames": len(frames_meta),
        "colors": color_count,
        "bytes": png_path.stat().st_size,
    }


def build_composite_preview(atlas: Image.Image, frames: dict[str, dict], out_dir: Path) -> None:
    """Build a 4x nearest-neighbor visual QA showcase of composites and animation frames."""
    out_dir.mkdir(parents=True, exist_ok=True)
    bg_col = (22, 34, 30, 255)
    grid_col = (36, 54, 48, 255)

    def crop(name: str) -> Image.Image:
        r = frames[name]["frame"]
        return atlas.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))

    combos = [
        ("base_default_student", None, None, "pet_sprout_pot"),
        ("base_student_glasses", None, "hat_headphones", "pet_sleepy_cat"),
        ("base_student_hoodie", "outfit_skin_hoodie_blue", None, "pet_sprout_pot"),
        ("base_default_student", "outfit_skin_scholar_blazer", "hat_graduation_cap", "pet_wise_owl"),
        ("base_student_sprout", None, "hat_headphones", "pet_sprout_pot"),
        ("base_default_student", "npc_apron_barista", None, None),
        ("base_student_glasses", "npc_apron_cashier", None, None),
        ("base_student_sprout", "npc_apron_server", None, None),
    ]

    cols = len(combos)
    rows = 4  # down idle, left walk, up walk, down study (NPCs show down walk on row 3)
    cell_w, cell_h = 48, 56
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), bg_col)
    sh_actor = crop("shadow_actor")
    sh_pet = crop("shadow_pet")

    row_poses = [
        ("down", "idle", 0),
        ("left", "walk", 0),
        ("up", "walk", 3),
        ("down", "study", 1),
    ]

    for c_idx, (base_id, outfit_id, hat_id, pet_id) in enumerate(combos):
        is_npc = outfit_id is not None and outfit_id.startswith("npc_apron_")
        for r_idx, (d, posture, f) in enumerate(row_poses):
            if is_npc and posture == "study":
                posture, f = "walk", 2
            cx = c_idx * cell_w
            cy = r_idx * cell_h
            cell = Image.new("RGBA", (cell_w, cell_h), bg_col)
            for bx in range(cell_w):
                cell.putpixel((bx, 0), grid_col)
            for by in range(cell_h):
                cell.putpixel((0, by), grid_col)
            # Shadow + base + outfit + hat
            cell.alpha_composite(sh_actor, (12, 41))
            cell.alpha_composite(crop(f"{base_id}_{d}_{posture}_{f}"), (8, 4))
            if outfit_id:
                cell.alpha_composite(crop(f"{outfit_id}_{d}_{posture}_{f}"), (8, 4))
            if hat_id:
                cell.alpha_composite(crop(f"{hat_id}_{d}_{posture}_{f}"), (8, 4))
            if pet_id:
                cell.alpha_composite(sh_pet, (31, 45))
                cell.alpha_composite(crop(f"{pet_id}_{r_idx % 4}"), (25, 28))
            sheet.alpha_composite(cell, (cx, cy))

    scaled = sheet.resize((sheet.width * 3, sheet.height * 3), Image.Resampling.NEAREST)
    scaled.save(out_dir / "paper-doll-composites.png", format="PNG")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Botanical Paper-Doll character atlas")
    parser.add_argument("--preview-dir", type=Path, default=None)
    args = parser.parse_args()
    result = pack_atlas(preview_dir=args.preview_dir)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
