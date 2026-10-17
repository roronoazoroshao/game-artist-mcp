#!/usr/bin/env python3
"""Independent Krita OpenRaster import/export/reopen verifier.

Runs on source fixtures and actual editor output; it NEVER asserts AI painting,
human approval, native masks, authenticated rights, or universal ORA support.
"""
import hashlib
import io
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from PIL import Image

MAX_ARCHIVE = 24 * 1024 * 1024
MAX_DECODE = 64 * 1024 * 1024
MAX_ENTRIES = 80


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pixel_delta_metrics(left, right):
    """Exact per-channel RGBA comparison; never use alpha-sensitive getbbox."""
    if left.size != right.size:
        raise ValueError("pixel comparison dimensions differ")
    a = left.convert("RGBA").tobytes()
    b = right.convert("RGBA").tobytes()
    changed = maximum = total = 0
    for i in range(0, len(a), 4):
        diffs = [abs(a[i+j]-b[i+j]) for j in range(4)]
        peak = max(diffs)
        if peak:
            changed += 1
            maximum = max(maximum, peak)
            total += sum(diffs)
    return {"changedPixels": changed,
            "maxChannelDelta": maximum, "sumChannelDelta": total}


def inspect(path):
    content = Path(path).read_bytes()
    if not content or len(content) > MAX_ARCHIVE:
        raise ValueError("invalid bounded ORA bytes")
    decoded_total = 0
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        infos = archive.infolist()
        if len(infos) < 5 or len(infos) > MAX_ENTRIES:
            raise ValueError("invalid bounded ZIP entries")
        names = [entry.filename for entry in infos]
        if len(names) != len(set(names)):
            raise ValueError("duplicate ZIP entry names")
        for entry in infos:
            if (not entry.filename or entry.filename.startswith("/")
                or ".." in entry.filename.split("/")
                or "\\" in entry.filename
                or (entry.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError("malicious ZIP path or symlink")
            decoded_total += entry.file_size
            if decoded_total > MAX_DECODE:
                raise ValueError("unbounded decompressed archive")
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC mismatch")
        if archive.read("mimetype") != b"image/openraster":
            raise ValueError("wrong ORA mimetype")
        xml_bytes = archive.read("stack.xml")
        if len(xml_bytes) > 65536 or b"<!DOCTYPE" in xml_bytes or b"<!ENTITY" in xml_bytes:
            raise ValueError("unsupported XML extensions")
        root = ET.fromstring(xml_bytes)
        if root.tag != "image":
            raise ValueError("unsupported ORA image tag")
        canvas = [int(root.attrib["w"]), int(root.attrib["h"])]
        if min(canvas) < 1 or max(canvas) > 4096 or canvas[0] * canvas[1] > 4194304:
            raise ValueError("bad canvas")
        layers = []
        groups = []
        def visit(element, depth=0, parent=None):
            if depth > 5:
                raise ValueError("ORA group depth")
            for child in element:
                if child.tag == "stack":
                    groups.append({
                        "name": child.attrib.get("name", "<anonymous>"),
                        "visibility": child.attrib.get("visibility", "visible"),
                        "opacity": child.attrib.get("opacity", "1"),
                        "parent": parent
                    })
                    visit(child, depth+1, child.attrib.get("name", "<anonymous>"))
                elif child.tag == "layer":
                    src = child.attrib.get("src", "")
                    if not re.fullmatch(r"data/[a-zA-Z0-9_.-]+\.png", src):
                        raise ValueError("unexpected external or invalid layer source")
                    if src not in names:
                        raise ValueError("missing layer data")
                    image = Image.open(io.BytesIO(archive.read(src)))
                    image.load()
                    rgba = image.convert("RGBA")
                    layers.append({
                        "name": child.attrib.get("name", ""),
                        "src": src,
                        "parent": parent,
                        "visibility": child.attrib.get("visibility", "visible"),
                        "opacity": child.attrib.get("opacity", "1"),
                        "offset": [int(child.attrib.get("x", 0)), int(child.attrib.get("y", 0))],
                        "size": [image.width,image.height],
                        "rgbaSha256": digest(rgba.tobytes())
                    })
                else:
                    raise ValueError("unexpected XML stack child")
        for child in root:
            if child.tag == "stack":
                visit(child)
        if not layers:
            raise ValueError("flattened or missing editable layers")
        merged = Image.open(io.BytesIO(archive.read("mergedimage.png"))).convert("RGBA")
        merged.load()
        if list(merged.size) != canvas:
            raise ValueError("merged canvas mismatch")
        return {
            "oraSha256": digest(content), "mergedSha256": digest(merged.tobytes()),
            "canvas": canvas, "groups": groups, "layers": layers,
            "merged": merged
        }


def verify(source, exported, reopened, report):
    summary = {"tool": "REAL_KRITA_CLI",
               "editorInteroperability": "UNVERIFIED",
               "artisticReview": "UNSCORED",
               "paintedByAI": False,
               "commercialRightsCleared": False,
               "source": str(source), "exported": str(exported),
               "reopened": str(reopened)}
    success = False
    try:
        a, b = inspect(source), inspect(exported)
        if not reopened.exists() or reopened.stat().st_size < 64:
            raise ValueError("Krita could not reopen exported ORA")
        reopened_image = Image.open(reopened).convert("RGBA")
        reopened_image.load()
        preview_delta = pixel_delta_metrics(a["merged"], b["merged"])
        reopened_delta = pixel_delta_metrics(a["merged"], reopened_image)
        export_reopen_delta = pixel_delta_metrics(b["merged"], reopened_image)
        source_layer_names = [x["name"] for x in a["layers"]]
        output_layer_names = [x["name"] for x in b["layers"]]
        input_groups = [g["name"] for g in a["groups"]]
        output_groups = [g["name"] for g in b["groups"]]
        layer_same = (len(a["layers"]) == len(b["layers"]) and
          all(x["name"] == y["name"] and x["parent"] == y["parent"] and
              x["visibility"] == y["visibility"] and x["offset"] == y["offset"] and
              x["size"] == y["size"] and x["rgbaSha256"] == y["rgbaSha256"]
              for x, y in zip(a["layers"], b["layers"])))
        opacity_quantized = all(abs(float(x["opacity"])-float(y["opacity"]))<=1/255+0.000001
              for x,y in zip(a["layers"], b["layers"]))
        group_same = (len(a["groups"]) == len(b["groups"]) and
          all(x["name"] == y["name"] and x["parent"] == y["parent"] and
              x["visibility"] == y["visibility"] and
              abs(float(x["opacity"])-float(y["opacity"]))<=1/255+0.000001
              for x,y in zip(a["groups"], b["groups"])))
        structural = (a["canvas"] == b["canvas"] and
           layer_same and group_same and opacity_quantized and len(b["layers"]) >= 3)
        exact = (structural and preview_delta["maxChannelDelta"] == 0 and
                 reopened_delta["maxChannelDelta"] == 0)
        bounded = (structural and
          preview_delta["maxChannelDelta"] <= 1 and
          reopened_delta["maxChannelDelta"] <= 1 and
          export_reopen_delta["maxChannelDelta"] == 0)
        status = ("PASS" if exact else
                  "BOUNDED_1LSB_NOT_PIXEL_EXACT" if bounded else "FAIL")
        summary.update({
            "sourceOraSha256": a["oraSha256"], "exportedOraSha256": b["oraSha256"],
            "sourceCanvas": a["canvas"], "exportedCanvas": b["canvas"],
            "sourceLayers": source_layer_names, "exportedLayers": output_layer_names,
            "sourceGroups": input_groups, "exportedGroups": output_groups,
            "editableStructurePreserved": structural,
            "eachOriginalLayerRgbaPreserved": layer_same,
            "opacityQuantizationBounded": opacity_quantized,
            "sourceVsExportedPreviewDelta": preview_delta,
            "sourceVsReopenedPngDelta": reopened_delta,
            "exportedVsReopenedPngDelta": export_reopen_delta,
            "mergedPixelsExact": preview_delta["maxChannelDelta"] == 0,
            "reopenedPixelsExact": reopened_delta["maxChannelDelta"] == 0,
            "editorInteroperability": status,
            "technicalAcceptWithWarning": bounded,
            "releasePixelsExactGate": exact
        })
        success = exact or bounded
    except Exception as exc:
        summary["error"] = f"{type(exc).__name__}: {exc}"
        summary["editorInteroperability"] = "FAIL"
    Path(report).parent.mkdir(parents=True, exist_ok=True)
    Path(report).write_text(json.dumps(summary, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({k:v for k,v in summary.items() if k not in
                      ("source","exported","reopened")}, indent=2), flush=True)
    if not success:
        print("R9B_EDITOR_INTEROP_NOT_VERIFIED", file=sys.stderr)
        return 1
    if summary["releasePixelsExactGate"]:
        print("R9B_KRITA_PIXEL_EXACT_EDITOR_INTEROP_VERIFIED")
    else:
        print("R9B_KRITA_STRUCTURE_VERIFIED_WITH_1LSB_PIXEL_WARNING")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: r9b-editor-interop-verify.py source.ora exported.ora reopened.png report.json",
              file=sys.stderr)
        sys.exit(2)
    sys.exit(verify(*(Path(p) for p in sys.argv[1:])))
