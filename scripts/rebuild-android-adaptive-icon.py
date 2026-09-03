#!/usr/bin/env python3
"""Rebuild Android adaptive-icon foregrounds with safe-zone padding.

Android masks adaptive icons to roughly the center 66% (safe zone). Our white
logo on purple was ~66% wide with only ~16% side margin, so wing tips clipped
on circular/squircle launchers.

This extracts the mark from resources/icon.png, scales it to fit inside ~55% of
the canvas, and writes transparent-foreground + solid-background mipmaps.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "resources" / "icon.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
OUT_FG_MASTER = ROOT / "resources" / "android-icon-foreground.png"

# Adaptive foreground full-bleed sizes (108dp @ density)
FG_SIZES = {
    "mipmap-ldpi": 81,
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

# Legacy launcher icons (48dp @ density)
LEGACY_SIZES = {
    "mipmap-ldpi": 36,
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Keep logo inside adaptive safe zone (center ~66%). Use 55% for wing tips.
MAX_CONTENT_FRAC = 0.55
BG_RGB = (108, 71, 255)  # #6C47FF — matches ic_launcher_background


def extract_logo(src: Image.Image) -> Image.Image:
    """Chroma-key near-background purple → transparent; keep the white mark."""
    rgba = src.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    bg = px[2, 2][:3]
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out_px = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 40:
                out_px[x, y] = (r, g, b, a)
    bbox = out.getbbox()
    if not bbox:
        raise SystemExit(f"No logo content found in {SRC}")
    return out.crop(bbox)


def fit_on_canvas(logo: Image.Image, size: int, *, transparent: bool) -> Image.Image:
    max_px = int(size * MAX_CONTENT_FRAC)
    lw, lh = logo.size
    scale = min(max_px / lw, max_px / lh)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    if transparent:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (size, size), (*BG_RGB, 255))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def solid_bg(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), (*BG_RGB, 255))


def main() -> None:
    src = Image.open(SRC)
    logo = extract_logo(src)

    master = fit_on_canvas(logo, 1024, transparent=True)
    OUT_FG_MASTER.parent.mkdir(parents=True, exist_ok=True)
    master.save(OUT_FG_MASTER)
    print(f"wrote {OUT_FG_MASTER.relative_to(ROOT)}")

    for folder, size in FG_SIZES.items():
        d = RES / folder
        d.mkdir(parents=True, exist_ok=True)
        fg = fit_on_canvas(logo, size, transparent=True)
        fg.save(d / "ic_launcher_foreground.png")
        solid_bg(size).save(d / "ic_launcher_background.png")
        print(f"wrote {folder}/ic_launcher_foreground.png ({size}px)")

    for folder, size in LEGACY_SIZES.items():
        d = RES / folder
        legacy = fit_on_canvas(logo, size, transparent=False)
        legacy.save(d / "ic_launcher.png")
        legacy.save(d / "ic_launcher_round.png")
        print(f"wrote {folder}/ic_launcher.png ({size}px)")

    bbox = master.getbbox()
    assert bbox
    l, t, r, b = bbox
    print(
        f"master content {r - l}x{b - t} "
        f"({100 * (r - l) / 1024:.0f}% x {100 * (b - t) / 1024:.0f}%); "
        f"pad LTRB%={100 * l / 1024:.1f} {100 * t / 1024:.1f} "
        f"{100 * (1024 - r) / 1024:.1f} {100 * (1024 - b) / 1024:.1f}"
    )


if __name__ == "__main__":
    main()
