#!/usr/bin/env bash
# Run Phase A (masks + representative tiles) for all remaining cohorts.
# Idempotent: skips slides that already have mask.png + rep_tiles JSON.
set -euo pipefail

CELL_MASKS_ROOT="/Volumes/HDD WD 1TB/histotyper/cell_masks_remapped"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/visual_assets}"
N_WORKERS=10

COHORTS=(ACC BLCA BRCA CESC COAD ESCA HNSC LIHC LUAD LUSC PAAD PRAD READ STAD THCA THYM UCEC)

for cohort in "${COHORTS[@]}"; do
    cell_masks_dir="$CELL_MASKS_ROOT/$cohort"
    if [ ! -d "$cell_masks_dir" ]; then
        echo "SKIP $cohort — no cell_masks directory"
        continue
    fi
    echo "=============================="
    echo "Starting $cohort"
    echo "=============================="
    uv run python scripts/data/generate_visual_assets.py \
        --cohort "$cohort" \
        --cell-masks-dir "$cell_masks_dir" \
        --output-dir "$OUTPUT_DIR" \
        --phase A \
        --n-workers "$N_WORKERS" \
        2>&1 | tee "/tmp/phase_a_${cohort}.log"
done

echo ""
echo "All cohorts done."
echo "Total masks: $(find "$OUTPUT_DIR/bundles/v1/tiles" -name 'mask.png' | wc -l)"
echo "Total rep_tiles: $(ls "$OUTPUT_DIR/representative_tiles/" | wc -l)"
