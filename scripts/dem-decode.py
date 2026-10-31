#!/usr/bin/env python3
"""Decode the pinned Copernicus GLO-30 tile into a small raw elevation window.

The raw window is only used by the build-time world pipeline. It is not shipped
to the browser. Run with:

  python3 scripts/dem-decode.py \
    data/geodata/raw/Copernicus_DSM_COG_10_N03_00_E011_00_DEM.tif \
    data/geodata/processed/nlongkak-dem.f32 \
    data/geodata/processed/nlongkak-dem.json \
    --bbox 11.50 3.87 11.54 3.91

The Copernicus tile is named N03_00_E011_00, covering 3N..4N and 11E..12E at
1 arc-second resolution. Pixel (0, 0) is the north-west corner.
"""

import argparse
import json
import os
import struct
import sys

from PIL import Image

TILE_LON0 = 11.0
TILE_LAT0 = 4.0
PIXEL_DEGREES = 1.0 / 3600.0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tif")
    parser.add_argument("out_f32")
    parser.add_argument("out_json")
    parser.add_argument("--bbox", nargs=4, type=float, metavar=("MIN_LON", "MIN_LAT", "MAX_LON", "MAX_LAT"))
    args = parser.parse_args()

    image = Image.open(args.tif).convert("F")
    width, height = image.size
    min_lon, min_lat, max_lon, max_lat = args.bbox or (TILE_LON0, TILE_LAT0 - 1, TILE_LON0 + 1, TILE_LAT0)
    x0 = max(0, int((min_lon - TILE_LON0) / PIXEL_DEGREES))
    x1 = min(width, int((max_lon - TILE_LON0) / PIXEL_DEGREES + 0.999999))
    y0 = max(0, int((TILE_LAT0 - max_lat) / PIXEL_DEGREES))
    y1 = min(height, int((TILE_LAT0 - min_lat) / PIXEL_DEGREES + 0.999999))
    if x1 <= x0 or y1 <= y0:
        print("DEM crop is empty", file=sys.stderr)
        return 1
    crop = image.crop((x0, y0, x1, y1))
    values = list(crop.getdata())
    finite = [v for v in values if v == v and abs(v) < 10000]
    if not finite:
        print("DEM crop contains no finite elevations", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(os.path.abspath(args.out_f32)), exist_ok=True)
    with open(args.out_f32, "wb") as fh:
        fh.write(struct.pack("<%df" % len(values), *values))
    meta = {
        "source": "copernicus_dem_glo30",
        "sourceFile": os.path.basename(args.tif),
        "width": x1 - x0,
        "height": y1 - y0,
        "pixelDegrees": PIXEL_DEGREES,
        "lon0": TILE_LON0 + x0 * PIXEL_DEGREES,
        "lat0": TILE_LAT0 - y0 * PIXEL_DEGREES,
        "minElevation": min(finite),
        "maxElevation": max(finite),
        "byteOrder": sys.byteorder,
        "dtype": "float32",
        "verticalDatum": "EGM2008",
    }
    with open(args.out_json, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")
    print(f"decoded {meta['width']}x{meta['height']} DEM window -> {args.out_f32}")
    print(f"elevation range {meta['minElevation']:.1f}..{meta['maxElevation']:.1f} m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
