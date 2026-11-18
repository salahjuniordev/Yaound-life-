#!/usr/bin/env bash
# Reproducible acquisition + preprocessing for one district pack.
#
# Usage:
#   bash scripts/world-acquire.sh [data/geodata/config/<area>.json]
#
# Requirements:
#   - curl
#   - osmium-tool (osmium extract/export/cat)
#   - python3 with Pillow
#
# Raw and intermediate files are intentionally kept out of git. The generated
# public/world/<area>/v1 package is the shippable offline world asset. The
# script only prepares and builds the requested area; it never regenerates an
# unrelated pack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONFIG="${1:-data/geodata/config/nlongkak.json}"
if [ ! -f "$CONFIG" ]; then
  echo "missing area config: $CONFIG" >&2
  exit 1
fi

eval "$(node - "$CONFIG" <<'NODE'
const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const osm = config.sources?.find((source) => source.id === 'openstreetmap');
const dem = config.sources?.find((source) => source.id === 'copernicus_dem_glo30');
if (!osm || !dem) {
  console.error('config needs openstreetmap and copernicus_dem_glo30 sources');
  process.exit(1);
}
const bbox = config.bbox;
if (!bbox || [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].some((value) => !Number.isFinite(value))) {
  console.error('config needs a finite bbox');
  process.exit(1);
}
const basePath = config.outputDir.replace(/^public\//, '').replace(/\/$/, '');
if (!/^world\/[A-Za-z0-9._/-]+$/.test(basePath) || basePath.includes('..')) {
  console.error('outputDir must be under public/world');
  process.exit(1);
}
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const line = (name, value) => console.log(`${name}=${quote(value)}`);
line('AREA_ID', config.areaId);
line('OSM_RAW', osm.rawFile);
line('OSM_EXTRACT', osm.extractFile);
line('OSM_EXPORT', osm.exportFile);
line('OSM_OPL', osm.oplFile);
line('OSM_DOWNLOAD_URL', osm.downloadUrl ?? '');
line('DEM_RAW', dem.rawFile);
line('DEM_DECODED', dem.decodedFile);
line('DEM_META', dem.decodedMetaFile);
line('DEM_DOWNLOAD_URL', dem.downloadUrl ?? '');
line('PACK_BASE_PATH', basePath);
const margin = 0.005;
console.log(`MIN_LON=${bbox.minLon}`);
console.log(`MIN_LAT=${bbox.minLat}`);
console.log(`MAX_LON=${bbox.maxLon}`);
console.log(`MAX_LAT=${bbox.maxLat}`);
console.log(`DEM_MIN_LON=${bbox.minLon - margin}`);
console.log(`DEM_MIN_LAT=${bbox.minLat - margin}`);
console.log(`DEM_MAX_LON=${bbox.maxLon + margin}`);
console.log(`DEM_MAX_LAT=${bbox.maxLat + margin}`);
NODE
)"

command -v osmium >/dev/null || { echo "osmium-tool is required (Termux: pkg install osmium-tool)" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
python3 -c 'from PIL import Image' >/dev/null 2>&1 || { echo "python3 Pillow is required (Termux: pkg install python-pillow)" >&2; exit 1; }

mkdir -p data/geodata/raw data/geodata/processed data/geodata/config
PBF="$ROOT/$OSM_RAW"
DEM="$ROOT/$DEM_RAW"
for path in "$PBF" "$DEM"; do mkdir -p "$(dirname "$path")"; done

if [ ! -f "$PBF" ]; then
  if [ -z "$OSM_DOWNLOAD_URL" ]; then
    echo "missing OSM extract and no downloadUrl in config: $PBF" >&2
    exit 1
  fi
  echo "downloading pinned OSM extract for $AREA_ID..."
  curl -fL --retry 5 --retry-delay 2 -o "$PBF" "$OSM_DOWNLOAD_URL"
fi
if [ ! -f "$DEM" ]; then
  if [ -z "$DEM_DOWNLOAD_URL" ]; then
    echo "missing DEM tile and no downloadUrl in config: $DEM" >&2
    exit 1
  fi
  echo "downloading pinned Copernicus DEM tile for $AREA_ID..."
  curl -fL --retry 5 --retry-delay 2 -o "$DEM" "$DEM_DOWNLOAD_URL"
fi

mkdir -p "$(dirname "$ROOT/$OSM_EXTRACT")" "$(dirname "$ROOT/$OSM_EXPORT")" "$(dirname "$ROOT/$OSM_OPL")" "$(dirname "$ROOT/$DEM_DECODED")" "$(dirname "$ROOT/$DEM_META")"

echo "verifying OSM extract..."
osmium fileinfo -e "$PBF" >/dev/null

echo "extracting $AREA_ID bbox..."
osmium extract --bbox="$MIN_LON,$MIN_LAT,$MAX_LON,$MAX_LAT" --overwrite -o "$ROOT/$OSM_EXTRACT" "$PBF"
osmium export "$ROOT/$OSM_EXTRACT" -f geojson --add-unique-id=type_id --overwrite -o "$ROOT/$OSM_EXPORT"
osmium cat --overwrite "$ROOT/$OSM_EXTRACT" -f opl -o "$ROOT/$OSM_OPL"

echo "decoding DEM window..."
python3 scripts/dem-decode.py "$DEM" "$ROOT/$DEM_DECODED" "$ROOT/$DEM_META" \
  --bbox "$DEM_MIN_LON" "$DEM_MIN_LAT" "$DEM_MAX_LON" "$DEM_MAX_LAT"

echo "building world package at $PACK_BASE_PATH..."
npm run world:build -- "$CONFIG"
npm run world:validate

echo "world acquisition complete: $AREA_ID -> $PACK_BASE_PATH"
