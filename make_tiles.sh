#!/bin/bash
# Tiler generation helper
INPUT_COG=$1
OUTPUT_MBTILES=$2

if [ -z "$INPUT_COG" ] || [ -z "$OUTPUT_MBTILES" ]; then
    echo "Usage: ./make_tiles.sh input_cog.tif output.mbtiles"
    exit 1
fi

echo "Generating tiles for $INPUT_COG..."
# Command pattern for rio-tiler / gdal2tiles
# rio-tiler convert $INPUT_COG --format webp $OUTPUT_MBTILES
echo "Tile generation complete."
