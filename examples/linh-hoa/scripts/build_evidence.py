#!/usr/bin/env python3
"""Reassemble review evidence using *actual* Godot PNGs; never draw substitute frames.

Requires Pillow, runs on the trusted workspace. Art merit is not scored here.
"""
from __future__ import annotations
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "captures"
MOTION = CAPTURES / "motion-temp"
BASELINE = CAPTURES / "v3-reference" / "game-02.png"

def load(path: Path, size: tuple[int, int]) -> Image.Image:
    data = path.read_bytes()
    if len(data) > 5_000_000:
        raise ValueError(f"oversized evidence frame: {path}")
    image = Image.open(BytesIO(data)).convert("RGB")
    if image.size != size:
        raise ValueError(f"frame geometry mismatch: {path}: {image.size}")
    return image

def changed(a: Image.Image, b: Image.Image, roi: tuple[int, int, int, int], limit: int) -> int:
    diff = ImageChops.difference(a.crop(roi), b.crop(roi))
    return sum(max(pixel) > limit for pixel in diff.getdata())

def build() -> None:
    names = [f"motion-{i:02d}.png" for i in range(24)]
    motion = [load(MOTION / file, (960, 540)) for file in names]
    thumbs = [im.resize((480, 270), Image.Resampling.LANCZOS) for im in motion]
    thumbs[0].save(
        CAPTURES / "animation-preview.gif",
        save_all=True,
        append_images=thumbs[1:],
        duration=56,
        loop=0,
        optimize=True,
        disposal=2,
    )
    region = (196, 64, 284, 209)
    difference = [changed(a, b, region, 3) for a, b in zip(thumbs, thumbs[1:])]
    on = load(CAPTURES / "light-on.png", (960, 540))
    off = load(CAPTURES / "light-off.png", (960, 540))
    light_region = (240, 240, 720, 510)
    lit_diff = changed(on, off, light_region, 5)
    background_diff = changed(on, off, (0, 0, 100, 100), 5)
    assert min(difference) > 250, "motion no longer visible in flame crop"
    assert lit_diff > 10000, "actual lighting no longer responds in courtyard"
    assert background_diff < 200, "lighting A/B background changed unexpectedly"
    for edge in (64, 128):
        load(CAPTURES / f"native-{edge}.png", (edge, edge))
    for i in range(4):
        load(CAPTURES / f"game-{i:02d}.png", (960, 540))
    # Before/after reference is an independently captured V3 real framebuffer from
    # the preserved dirty VPS worktree, never a synthetic re-render or model image.
    old = load(BASELINE, (960, 540))
    new = load(CAPTURES / "game-02.png", (960, 540))
    sheet = Image.new("RGB", (960, 310), (14, 23, 36))
    canvas = ImageDraw.Draw(sheet)
    canvas.text((12, 8), "V3 source snapshot | same authored phase 0.78s", fill="#d2e5e0")
    canvas.text((492, 8), "V4 experiment | shared bend + rhythm + light response", fill="#d2e5e0")
    sheet.paste(old.resize((480, 270), Image.Resampling.LANCZOS), (0, 36))
    sheet.paste(new.resize((480, 270), Image.Resampling.LANCZOS), (480, 36))
    sheet.save(CAPTURES / "v3-v4-comparison.png")

    material = load(CAPTURES / "material-lit.png", (960,540))
    default = load(CAPTURES / "default-lit.png", (960,540))
    material_dark = load(CAPTURES / "material-dark.png", (960,540))
    default_dark = load(CAPTURES / "default-dark.png", (960,540))
    material_roi = (170,220,790,520)
    reactive_pixels = changed(material, default, material_roi, 3)
    dark_pixels = changed(material_dark, default_dark, material_roi, 3)
    sky_pixels = changed(material, default, (0,0,160,160), 3)
    assert reactive_pixels > 400, "stone and jade response did not reach framebuffer"
    assert dark_pixels < 20, "material response did not disappear when light is off"
    assert sky_pixels < 20, "material response leaked into the sky"
    pngs = sorted(CAPTURES.glob("*.png"))
    evidence = {
        "version": 4,
        "source": "real Godot framebuffer; no synthetic substitutions",
        "engine": "4.4.1.stable.official.49a5bc7b6",
        "renderer": "OpenGL Mesa llvmpipe under Xvfb",
        "scene": "res://showcase.tscn",
        "sceneTimesSeconds": [0, 0.34, 0.78, 1.21],
        "samples": {
            "64": "native Godot SubViewport 64x64",
            "128": "native Godot SubViewport 128x128",
            "game": "960x540 real scene framebuffer"
        },
        "motion": {
            "samples": 24,
            "sampleRateHz": 18,
            "actualFramebuffer": True,
            "flameCropAtPreviewResolution": list(region),
            "changedPixelMin": min(difference),
            "changedPixelMax": max(difference)
        },
        "baselineV3": {
            "provenance": "preserved uncommitted V3 worktree; re-captured in isolated V4 workspace",
            "frameSha256": sha256(BASELINE.read_bytes()).hexdigest(),
        },
        "materialAB": {
            "sameAuthoredPhaseSeconds": 0.78,
            "realLightEnergyDriven": True,
            "litResponsePixels": reactive_pixels,
            "unlitDifferencePixels": dark_pixels,
            "skyDifferencePixels": sky_pixels,
            "region": list(material_roi),
        },
        "lightAB": {
            "sameAuthoredPhaseSeconds": 0.78,
            "truePointLight2D": True,
            "worldRegion": list(light_region),
            "pixelChangeCountThreshold5": lit_diff,
            "backgroundPixelChangeCountThreshold5": background_diff
        },
        "preview": "Pillow reassembled 24 true Godot frames at 480x270, not a runtime FPS measurement",
        "artisticReview": "UNSCORED",
        "rightsVerified": False,
        "exportAllowed": False,
        "imagesSha256": {p.name: sha256(p.read_bytes()).hexdigest() for p in pngs},
    }
    (CAPTURES / "manifest.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    print("VERIFIED_REPLAY", "motion", min(difference), max(difference),
          "light", lit_diff, "background", background_diff, "png", len(pngs))

if __name__ == "__main__":
    build()
