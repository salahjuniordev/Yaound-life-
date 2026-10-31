#!/usr/bin/env bash
# Reproducible acquisition + preprocessing for the first geographical slice.
#
# Requirements:
#   - curl
#   - osmium-tool (osmium extract/export/cat)
#   - python3 with Pillow
#
# Raw and intermediate files are intentionally kept out of git. The generated
# public/world/v1 package is the shippable offline world asset.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RAW="data/geodata/raw"
PROCESSED="data/geodata/processed"
mkdir -p "$RAW" "$PROCESSED" data/geodata/config

PBF="$RAW/cameroon-261030.osm.pbf"
DEM="$RAW/Copernicus_DSM_COG_10_N03_00_E011_00_DEM.tif"
PBF_URL="https://download.geofabrik.de/africa/cameroon-261030.osm.pbf"
DEM_URL="https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N03_00_E011_00_DEM/Copernicus_DSM_COG_10_N03_00_E011_00_DEM.tif"

command -v osmium >/dev/null || { echo "osmium-tool is required (Termux: pkg install osmium-tool)" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

if [ ! -f "$PBF" ]; then
  echo "downloading OSM Cameroon extract (2026-10-30)..."
  curl -fL --retry 5 --retry-delay 2 -o "$PBF" "$PBF_URL"
fi
if [ ! -f "$DEM" ]; then
  echo "downloading Copernicus DEM GLO-30 tile..."
  curl -fL --retry 5 --retry-delay 2 -o "$DEM" "$DEM_URL"
fi

echo "verifying OSM extract..."
osmium fileinfo -e "$PBF" >/dev/null

echo "extracting Nlongkak bbox..."
osmium extract --bbox=11.5126,3.8780,11.5305,3.8960 --overwrite -o "$PROCESSED/nlongkak.osm.pbf" "$PBF"
osmium export "$PROCESSED/nlongkak.osm.pbf" -f geojson --add-unique-id=type_id -o "$PROCESSED/nlongkak.geojson"
osmium cat "$PROCESSED/nlongkak.osm.pbf" -f opl -o "$PROCESSED/nlongkak.opl"

echo "decoding DEM window..."
python3 scripts/dem-decode.py "$DEM" "$PROCESSED/nlongkak-dem.f32" "$PROCESSED/nlongkak-dem.json" --bbox 11.50 3.87 11.54 3.91

echo "building world package..."
npm run world:build
npm run world:validate
