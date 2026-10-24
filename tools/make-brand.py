#!/usr/bin/env python3
"""
BüroVersum – Brand-Assets erzeugen
=================================

Erzeugt die Grafiken, die die Website ausliefert, nach ``assets-src/``:

  og-image.png         1200 × 630  Vorschaukarte (Open Graph / Twitter)
  icon-512.png              512 px  App-Icon / PWA
  icon-192.png              192 px  App-Icon / PWA
  apple-touch-icon.png      180 px  iOS-Homescreen
  hero-building.png     720 × 720  Illustration (transparent, 404-Seite)

Die Dateien sind eingecheckt – dieses Skript braucht man nur, wenn die
Grafiken geändert werden sollen.

Voraussetzung: Pillow (``pip install pillow``) und eine DejaVu-Schrift.

Aufruf:  python tools/make-brand.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets-src"

FONT_CANDIDATES_MONO_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
FONT_CANDIDATES_SANS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]
FONT_CANDIDATES_SANS_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def _font(candidates: list[str]) -> str:
    for path in candidates:
        if Path(path).is_file():
            return path
    raise SystemExit(
        "Keine passende Schrift gefunden. Erwartet eine DejaVu- oder "
        "Liberation-Schrift unter /usr/share/fonts/truetype/."
    )


F_BOLD = _font(FONT_CANDIDATES_MONO_BOLD)
F_SANS = _font(FONT_CANDIDATES_SANS)
F_SANSB = _font(FONT_CANDIDATES_SANS_BOLD)

# Farbwelt der Website (siehe Shell-CSS in tools/build.py)
BG_TOP = (16, 26, 56)
BG_BOT = (5, 5, 14)
BLUE = (74, 159, 255)
PURPLE = (124, 92, 224)
GOLD = (240, 192, 64)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(w, h):
    img = Image.new("RGB", (w, h), BG_BOT)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        t = t ** 0.85
        d.line([(0, y), (w, y)], fill=lerp(BG_TOP, BG_BOT, t))
    return img


def glow(img, xy, radius, color, alpha=90):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.55))
    return Image.alpha_composite(img.convert("RGBA"), layer)


def grid(img, step=40, color=(74, 159, 255, 14)):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(0, img.width, step):
        d.line([(x, 0), (x, img.height)], fill=color)
    for y in range(0, img.height, step):
        d.line([(0, y), (img.width, y)], fill=color)
    return Image.alpha_composite(img.convert("RGBA"), layer)


def text_spaced(draw, xy, text, font, fill, spacing=0, shadow=None):
    x, y = xy
    if shadow:
        cx = x
        for ch in text:
            draw.text((cx + 6, y + 6), ch, font=font, fill=shadow)
            cx += font.getlength(ch) + spacing
    cx = x
    for ch in text:
        draw.text((cx, y), ch, font=font, fill=fill)
        cx += font.getlength(ch) + spacing
    return cx


def draw_building(d, x, y, s=1.0, lit=True):
    """Isometrischer Büroblock, alle Maße in px * s."""
    def R(x1, y1, x2, y2, fill, r=0):
        d.rounded_rectangle([x + x1 * s, y + y1 * s, x + x2 * s, y + y2 * s], radius=r * s, fill=fill)

    # Boden/Sockel
    R(-14, 196, 214, 212, (20, 34, 72), 6)
    # Turm (hinten)
    R(96, 30, 196, 200, (22, 38, 82), 8)
    # Hauptblock
    R(6, 84, 132, 200, (30, 52, 108), 8)
    # Dachkanten
    R(6, 84, 132, 92, (58, 98, 186), 4)
    R(96, 30, 196, 38, (58, 98, 186), 4)
    # Fenster Hauptblock
    for row in range(4):
        for col in range(3):
            fx = 18 + col * 38
            fy = 104 + row * 24
            on = lit and ((row + col) % 3 != 1)
            R(fx, fy, fx + 24, fy + 14, (255, 211, 110) if on else (18, 30, 62), 3)
    # Fenster Turm (rechts neben dem Hauptblock, damit sich nichts überlagert)
    for row in range(6):
        for col in range(2):
            fx = 140 + col * 30
            fy = 46 + row * 24
            on = lit and ((row * 2 + col) % 4 != 3)
            R(fx, fy, fx + 22, fy + 13, (255, 211, 110) if on else (18, 30, 62), 3)
    # Eingang
    R(44, 158, 82, 200, (12, 22, 48), 4)
    R(52, 168, 74, 200, (74, 159, 255), 3)
    # Antenne
    R(140, 8, 146, 30, (120, 150, 220), 2)
    d.ellipse([x + 138 * s, y + 0 * s, x + 148 * s, y + 10 * s], fill=(255, 92, 92))


def og_image(path):
    W, H = 1200, 630
    img = gradient(W, H)
    img = glow(img, (240, 90), 420, BLUE, 70)
    img = glow(img, (1010, 560), 380, PURPLE, 70)
    img = grid(img, 40)
    img = img.convert("RGBA")
    d = ImageDraw.Draw(img)

    # Brand-Chip
    chip_font = ImageFont.truetype(F_BOLD, 20)
    chip = "BROWSER-RPG · V7.10.11"
    cw = chip_font.getlength(chip) + 56
    d.rounded_rectangle([80, 74, 80 + cw, 116], radius=21, fill=(20, 34, 72, 235), outline=(90, 140, 230, 120), width=1)
    d.ellipse([98, 89, 108, 99], fill=(0, 204, 102))
    d.text((118, 82), chip, font=chip_font, fill=(170, 200, 245))

    # Titel
    title_font = ImageFont.truetype(F_BOLD, 82)
    text_spaced(d, (78, 150), "BÜROVERSUM", title_font, (255, 255, 255), spacing=2, shadow=(10, 30, 80, 160))

    # Untertitel
    sub_font = ImageFont.truetype(F_SANSB, 34)
    d.text((82, 262), "Dein Büroalltag als Pixel-RPG.", font=sub_font, fill=(190, 208, 240))
    small = ImageFont.truetype(F_SANS, 26)
    d.text((82, 312), "Akten, Kaffee und Überstunden – kein Download,", font=small, fill=(140, 162, 205))
    d.text((82, 348), "direkt im Browser spielbar.", font=small, fill=(140, 162, 205))

    # CTA-Pille
    btn_font = ImageFont.truetype(F_SANSB, 26)
    label = "JETZT SPIELEN"
    bw = btn_font.getlength(label) + 96
    d.rounded_rectangle([82, 410, 82 + bw, 470], radius=15, fill=(74, 159, 255))
    d.rounded_rectangle([82, 410, 82 + bw, 470], radius=15, outline=(160, 205, 255), width=2)
    d.polygon([(108, 426), (108, 454), (132, 440)], fill=(255, 255, 255))
    d.text((146, 426), label, font=btn_font, fill=(255, 255, 255))

    # Fakten
    fact_font = ImageFont.truetype(F_SANS, 22)
    d.text((82, 508), "Speicherstand im Browser  ·  Maus & Touch",
           font=fact_font, fill=(134, 156, 200))

    # Illustration rechts
    draw_building(d, 800, 150, s=1.85)

    # Vignette: nur leichte Abdunklung an den Rändern
    vig = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, W, H], fill=110)
    vd.ellipse([-W * 0.15, -H * 0.25, W * 1.15, H * 1.25], fill=0)
    vig = vig.filter(ImageFilter.GaussianBlur(90)).point(lambda v: int(v * 0.55))
    dark = Image.new("RGBA", (W, H), (2, 3, 10, 255))
    img = Image.composite(dark, img, vig)

    img.convert("RGB").save(path, optimize=True)
    print("wrote", path)


def icon(path, size):
    s = size / 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(112 * s), fill=(10, 12, 30, 255))
    # innerer Rahmen
    d.rounded_rectangle([int(10 * s), int(10 * s), size - int(10 * s), size - int(10 * s)],
                        radius=int(104 * s), outline=(74, 159, 255, 110), width=max(1, int(4 * s)))
    # Gebäude (pixelig, zentriert)
    bx, by = int(96 * s), int(120 * s)
    def R(x1, y1, x2, y2, fill, r=0):
        d.rounded_rectangle([x1, y1, x2, y2], radius=max(1, int(r * s)), fill=fill)

    R(bx + int(120 * s), by - int(44 * s), bx + int(240 * s), by + int(300 * s), (24, 40, 88, 255), 10)
    R(bx + int(20 * s), by + int(40 * s), bx + int(170 * s), by + int(300 * s), (36, 62, 126, 255), 10)
    R(bx + int(20 * s), by + int(40 * s), bx + int(170 * s), by + int(58 * s), (74, 159, 255, 255), 5)
    R(bx + int(120 * s), by - int(44 * s), bx + int(240 * s), by - int(26 * s), (74, 159, 255, 255), 5)
    for row in range(4):
        for col in range(3):
            fx = bx + int(38 * s) + col * int(44 * s)
            fy = by + int(78 * s) + row * int(52 * s)
            on = (row + col) % 3 != 1
            R(fx, fy, fx + int(28 * s), fy + int(30 * s), (255, 205, 96, 255) if on else (16, 26, 56, 255), 4)
    for row in range(4):
        for col in range(2):
            fx = bx + int(136 * s) + col * int(48 * s)
            fy = by + int(2 * s) + row * int(56 * s)
            on = (row * 2 + col) % 4 != 3
            R(fx, fy, fx + int(30 * s), fy + int(32 * s), (255, 205, 96, 255) if on else (16, 26, 56, 255), 4)
    img.save(path, optimize=True)
    print("wrote", path)


def hero_building(path):
    """Transparente Illustration für die Landing-Page (4x für Retina)."""
    W = H = 720
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Grundschatten
    d.ellipse([170, 560, 600, 640], fill=(0, 0, 0, 80))
    draw_building(d, 120, 40, s=2.4)
    img.save(path, optimize=True)
    print("wrote", path)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    og_image(OUT / "og-image.png")
    icon(OUT / "icon-512.png", 512)
    icon(OUT / "icon-192.png", 192)
    icon(OUT / "apple-touch-icon.png", 180)
    hero_building(OUT / "hero-building.png")
    print(f"Fertig – Assets liegen in {OUT}")


if __name__ == "__main__":
    sys.exit(main())
