#!/usr/bin/env python3
"""Generate visual assets for the atlas frontend.

Processes local cell_masks.bin files and SVS slides from GDC to produce:
  - representative_tiles/{slide_name}.json  (tile coordinates per feature)
  - bundles/v1/tiles/{slide_name}/mask.png  (tissue mask)
  - bundles/v1/tiles/{slide_name}/thumbnail.jpg
  - bundles/v1/tiles/{slide_name}/{level}__{x}__{y}__224__224.jpg       (raw)
  - bundles/v1/tiles/{slide_name}/{level}__{x}__{y}__224__224_overlay.jpg

Two-phase pipeline:
  Phase A: Feature generation from cell_masks.bin (CPU-bound, parallelized)
  Phase B: SVS download + tile/thumbnail extraction (I/O-bound, pipelined)
"""

import argparse
import json
import logging
import os
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from joblib import Parallel, delayed
from PIL import Image
from tqdm import tqdm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

GDC_FILES_ENDPOINT = "https://api.gdc.cancer.gov/files"
GDC_DATA_ENDPOINT = "https://api.gdc.cancer.gov/data"

# Band mask color palette — painted in order (later layers overwrite earlier)
BAND_COLORS: dict[str, tuple[int, int, int]] = {
    # Base compartments (painted first, overwritten by bands)
    "necrosis": (80, 80, 80),  # dark gray
    "normal_epithelium": (0, 150, 0),  # green
    "other": (180, 180, 180),  # light gray
    # Stroma bands (far to near)
    "stroma_far": (180, 200, 230),  # pale blue — stroma > 200 µm
    "stroma_50_200": (100, 140, 210),  # medium blue — B_S^{50-200}
    "stroma_0_50": (30, 80, 180),  # deep blue — B_S^{0-50}
    # Tumor bands (core to front)
    "tumor_core": (200, 80, 80),  # muted red — B_T^{>50}
    "tumor_0_50": (230, 0, 0),  # bright red — B_T^{0-50}
    # Necrosis proximity
    "necrosis_ring": (180, 100, 50),  # brown-orange — R_Nec,T^{0-100}
}


@dataclass
class Config:
    cohort: str
    cell_masks_dir: Path
    output_dir: Path
    jpeg_quality: int = 85
    thumbnail_max_px: int = 512
    tile_size: int = 224
    representative_k: int = 5
    gdc_timeout: int = 600
    max_retries: int = 3
    svs_tmp_dir: Path = Path("/tmp/svs_staging")
    svs_buffer_gb: float = 100.0
    n_workers: int = max(1, os.cpu_count() - 1)
    n_download_workers: int = 3
    phase: str = "both"
    dry_run: bool = False

    def tiles_dir(self, slide_name: str) -> Path:
        return self.output_dir / "bundles" / "v1" / "tiles" / slide_name

    def rep_tiles_path(self, slide_name: str) -> Path:
        return self.output_dir / "representative_tiles" / f"{slide_name}.json"


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------


def load_progress(config: Config) -> dict:
    path = config.output_dir / "progress.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"completed_a": [], "completed_b": [], "failed": [], "skipped": []}


def save_progress(config: Config, progress: dict) -> None:
    path = config.output_dir / "progress.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(progress, indent=2))


# ---------------------------------------------------------------------------
# Phase A: Feature generation (CPU-bound)
# ---------------------------------------------------------------------------


def discover_slides(cell_masks_dir: Path) -> list[tuple[str, Path]]:
    """Scan cell_masks_dir for directories containing cell_masks.bin."""
    manifest = []
    for entry in sorted(cell_masks_dir.iterdir()):
        if entry.is_dir():
            bin_path = entry / "cell_masks.bin"
            if bin_path.exists():
                manifest.append((entry.name, bin_path))
    return manifest


def generate_tissue_mask(ctx, output_path: Path, max_px: int = 1000) -> None:
    """Render band-level tissue mask as a colored PNG, capped at max_px.

    Paints layers in order so that finer bands overwrite coarser base
    compartments. Uses SlideContext cached properties for band masks.
    """
    from histotyper.features.utils.tissue_map import (
        COMPARTMENT_NECROSIS,
        COMPARTMENT_NORMAL,
        COMPARTMENT_OTHER,
    )

    pmap = ctx.processed_tissue_map
    h, w = pmap.shape
    rgb = np.full((h, w, 3), 255, dtype=np.uint8)

    # 1. Base compartments (non-tumor, non-stroma)
    rgb[pmap == COMPARTMENT_NECROSIS] = BAND_COLORS["necrosis"]
    rgb[pmap == COMPARTMENT_NORMAL] = BAND_COLORS["normal_epithelium"]
    rgb[pmap == COMPARTMENT_OTHER] = BAND_COLORS["other"]

    # 2. Stroma bands (far → near, so near overwrites far)
    stroma_far = ctx.stroma_mask & ~ctx.stroma_near_tumor_200
    rgb[stroma_far] = BAND_COLORS["stroma_far"]
    rgb[ctx.band_stroma_50_200] = BAND_COLORS["stroma_50_200"]
    rgb[ctx.band_stroma_0_50] = BAND_COLORS["stroma_0_50"]

    # 3. Tumor bands (core first, then front overwrites edge)
    rgb[ctx.tumor_core_mask] = BAND_COLORS["tumor_core"]
    rgb[ctx.band_tumor_0_50] = BAND_COLORS["tumor_0_50"]

    # 4. Necrosis proximity ring (overwrites tumor core near necrosis)
    rgb[ctx.necrosis_ring_tumor_0_100] = BAND_COLORS["necrosis_ring"]

    img = Image.fromarray(rgb)
    if max(w, h) > max_px:
        scale = max_px / max(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.NEAREST)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, format="PNG")


def compute_slide_features(slide_name: str, cell_masks_path: Path, config: Config) -> str:
    """Run feature pipeline for one slide. Returns status string."""
    from histotyper.features.pipeline import generate_features
    from histotyper.features.representative_tiles import save_representative_tiles
    from histotyper.helpers.data.io import read_slide_segmentation_data

    json_path = config.rep_tiles_path(slide_name)
    mask_path = config.tiles_dir(slide_name) / "mask.png"
    if json_path.exists() and mask_path.exists():
        return "SKIP"

    try:
        slide_data = read_slide_segmentation_data(cell_masks_path)
        df, ctx, rep_tiles = generate_features(
            slide_data,
            compute_representative_tiles=True,
            representative_k=config.representative_k,
        )
        json_path.parent.mkdir(parents=True, exist_ok=True)
        if rep_tiles is not None:
            save_representative_tiles(rep_tiles, json_path)

        generate_tissue_mask(ctx, mask_path)
        return "OK"
    except Exception:
        logger.exception("Phase A failed for %s", slide_name)
        return "FAIL"


def run_phase_a(slide_manifest: list[tuple[str, Path]], config: Config) -> None:
    """Run Phase A in parallel with joblib."""
    logger.info("=" * 60)
    logger.info(
        "PHASE A: Feature generation (%d slides, %d workers)", len(slide_manifest), config.n_workers
    )
    logger.info("=" * 60)

    results = Parallel(n_jobs=config.n_workers, backend="loky")(
        delayed(compute_slide_features)(name, path, config)
        for name, path in tqdm(slide_manifest, desc="Phase A")
    )

    progress = load_progress(config)
    counts = {"OK": 0, "SKIP": 0, "FAIL": 0}
    for (name, _), status in zip(slide_manifest, results):
        counts[status] = counts.get(status, 0) + 1
        if status == "OK":
            progress["completed_a"].append(name)
        elif status == "FAIL":
            progress["failed"].append(name)
        elif status == "SKIP":
            progress["skipped"].append(name)
    save_progress(config, progress)

    logger.info("\nPhase A summary: %s", counts)


# ---------------------------------------------------------------------------
# Phase B: SVS download + tile extraction (I/O-bound)
# ---------------------------------------------------------------------------


def query_gdc_file_ids_batched(slide_names: list[str], batch_size: int = 100) -> dict[str, str]:
    """Query GDC for file IDs in batches. Returns {filename: file_id}."""
    result: dict[str, str] = {}
    for i in range(0, len(slide_names), batch_size):
        batch = slide_names[i : i + batch_size]
        # Slide names may already end with .svs (directory convention)
        svs_names = [n if n.endswith(".svs") else f"{n}.svs" for n in batch]
        filters = json.dumps(
            {
                "op": "in",
                "content": {"field": "file_name", "value": svs_names},
            }
        )
        params = urllib.parse.urlencode(
            {
                "filters": filters,
                "fields": "file_id,file_name",
                "format": "JSON",
                "size": len(svs_names),
            }
        )
        url = f"{GDC_FILES_ENDPOINT}?{params}"
        resp = urllib.request.urlopen(url, timeout=60)
        data = json.loads(resp.read())
        for hit in data["data"]["hits"]:
            fname = hit["file_name"]
            # Map back to the slide_name as used in our manifest
            # If original slide_name already had .svs, use fname directly
            if fname in batch:
                result[fname] = hit["file_id"]
            else:
                # Strip .svs suffix we added
                result[fname.rsplit(".svs", 1)[0]] = hit["file_id"]
        logger.info(
            "  GDC batch %d-%d: found %d/%d", i, i + len(batch), len(result), i + len(batch)
        )
    return result


def download_svs(file_id: str, dest: Path, timeout: int = 600, max_retries: int = 3) -> Path:
    """Download an SVS file from GDC with retries."""
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{GDC_DATA_ENDPOINT}/{file_id}"
    partial = dest.with_suffix(".partial")

    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(url, stream=True, timeout=timeout)
            resp.raise_for_status()
            with open(partial, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8 * 1024 * 1024):
                    f.write(chunk)
            partial.rename(dest)
            return dest
        except Exception:
            if partial.exists():
                partial.unlink()
            if attempt < max_retries:
                backoff = 2 ** (attempt - 1)
                logger.warning(
                    "Download retry %d/%d for %s (backoff %ds)",
                    attempt,
                    max_retries,
                    file_id,
                    backoff,
                )
                time.sleep(backoff)
            else:
                raise
    return dest  # unreachable, satisfies type checker


def is_slide_complete(slide_name: str, config: Config) -> bool:
    """Check if Phase B outputs already exist for a slide."""
    return (config.tiles_dir(slide_name) / "thumbnail.jpg").exists()


def collect_unique_tiles(
    rep_tiles_json: Path,
) -> list[tuple[int, int, int]]:
    """Load representative tiles JSON and deduplicate (level, x, y) tuples."""
    data = json.loads(rep_tiles_json.read_text())
    seen: set[tuple[int, int, int]] = set()
    for tiles in data.values():
        for t in tiles:
            key = (t["tile_level"], t["tile_grid_x"], t["tile_grid_y"])
            seen.add(key)
    return sorted(seen)


def extract_raw_tiles(dz, tiles: list[tuple[int, int, int]], output_dir: Path, quality: int) -> int:
    """Extract raw tile JPEGs from a DeepZoomGenerator. Returns count."""
    count = 0
    for level, x, y in tiles:
        out_path = output_dir / f"{level}__{x}__{y}__224__224.jpg"
        if out_path.exists():
            count += 1
            continue
        try:
            img = dz.get_tile(level, (x, y))
            img.convert("RGB").save(out_path, "JPEG", quality=quality)
            count += 1
        except Exception:
            logger.warning("Failed to extract tile (%d, %d, %d)", level, x, y)
    return count


def build_tile_lookup(slide_data) -> dict[tuple[int, int], int]:
    """Build (dz_x, dz_y) -> tile index lookup."""
    lookup: dict[tuple[int, int], int] = {}
    for idx, tile_info in enumerate(slide_data.iterate_over_tiles()):
        lookup[(int(tile_info["x"]), int(tile_info["y"]))] = idx
    return lookup


def render_tile_overlay(
    dz,
    level: int,
    x: int,
    y: int,
    slide_data,
    tile_lookup: dict[tuple[int, int], int],
    cmap: dict[str, tuple[int, int, int]],
) -> np.ndarray | None:
    """Render a tile with cell segmentation overlay."""
    from histotyper.viz.cell import contours_to_instance_map, get_image_with_masks

    idx = tile_lookup.get((x, y))
    if idx is None:
        return None

    raw_img = dz.get_tile(level, (x, y))
    raw_rgb = np.array(raw_img.convert("RGB"))
    tile_data = slide_data.get_tile(idx)

    n_instances = len(tile_data["cell_masks"])
    if n_instances == 0:
        return raw_rgb

    contours = [np.array(tile_data["cell_masks"][i]["coordinates"]) for i in range(n_instances)]
    w, h = int(tile_data["width"]), int(tile_data["height"])
    instance_map = contours_to_instance_map(contours, (h, w))
    labels = [tile_data["cell_masks"][i]["cell_type"] for i in range(n_instances)]

    _, overlay = get_image_with_masks(raw_rgb, instance_map, labels, cmap=cmap)
    # get_image_with_masks upsamples to 996x996; resize back to original tile size
    if overlay.shape[:2] != raw_rgb.shape[:2]:
        overlay = np.array(
            Image.fromarray(overlay).resize((raw_rgb.shape[1], raw_rgb.shape[0]), Image.LANCZOS)
        )
    return overlay


def extract_overlay_tiles(
    dz,
    tiles: list[tuple[int, int, int]],
    slide_data,
    tile_lookup: dict[tuple[int, int], int],
    output_dir: Path,
    quality: int,
) -> int:
    """Extract overlay tile JPEGs. Returns count."""
    from histotyper.viz.cell import get_cmap_deterministic

    cmap = get_cmap_deterministic()
    count = 0
    for level, x, y in tiles:
        out_path = output_dir / f"{level}__{x}__{y}__224__224_overlay.jpg"
        if out_path.exists():
            count += 1
            continue
        try:
            overlay = render_tile_overlay(dz, level, x, y, slide_data, tile_lookup, cmap)
            if overlay is not None:
                Image.fromarray(overlay).save(out_path, "JPEG", quality=quality)
                count += 1
        except Exception:
            logger.warning("Failed overlay for tile (%d, %d, %d)", level, x, y)
    return count


def generate_thumbnail(wsi, output_path: Path, max_px: int, quality: int) -> None:
    """Generate a thumbnail JPEG from the WSI."""
    thumb = wsi.get_thumbnail((max_px, max_px))
    thumb.convert("RGB").save(output_path, "JPEG", quality=quality)


def process_slide_images(slide_name: str, svs_path: Path, config: Config) -> str:
    """Process a single downloaded SVS: extract tiles, overlays, thumbnail."""
    import openslide
    from histotyper.helpers.data.io import read_slide_segmentation_data
    from openslide.deepzoom import DeepZoomGenerator

    tiles_dir = config.tiles_dir(slide_name)
    tiles_dir.mkdir(parents=True, exist_ok=True)

    try:
        wsi = openslide.OpenSlide(str(svs_path))
        dz = DeepZoomGenerator(wsi, tile_size=config.tile_size, overlap=0)

        # Load tile coordinates
        rep_path = config.rep_tiles_path(slide_name)
        if not rep_path.exists():
            logger.warning("No representative tiles JSON for %s, skipping", slide_name)
            return "SKIP"
        tiles = collect_unique_tiles(rep_path)

        # Raw tiles
        extract_raw_tiles(dz, tiles, tiles_dir, config.jpeg_quality)

        # Overlay tiles (need cell_masks.bin)
        cell_masks_path = config.cell_masks_dir / slide_name / "cell_masks.bin"
        if cell_masks_path.exists():
            slide_data = read_slide_segmentation_data(cell_masks_path)
            tile_lookup = build_tile_lookup(slide_data)
            extract_overlay_tiles(
                dz, tiles, slide_data, tile_lookup, tiles_dir, config.jpeg_quality
            )

        # Thumbnail
        thumb_path = tiles_dir / "thumbnail.jpg"
        generate_thumbnail(wsi, thumb_path, config.thumbnail_max_px, config.jpeg_quality)

        wsi.close()
        return "OK"
    except Exception:
        logger.exception("Phase B processing failed for %s", slide_name)
        return "FAIL"


def run_phase_b(slide_names: list[str], config: Config) -> dict[str, int]:
    """Run Phase B: download SVS files and extract tiles."""
    logger.info("=" * 60)
    logger.info("PHASE B: SVS download + tile extraction (%d slides)", len(slide_names))
    logger.info("=" * 60)

    # Filter already-complete slides
    todo = [s for s in slide_names if not is_slide_complete(s, config)]
    logger.info(
        "  %d slides need processing (%d already complete)", len(todo), len(slide_names) - len(todo)
    )
    if not todo:
        logger.info("  Nothing to do.")
        return {"OK": 0, "SKIP": 0, "FAIL": 0}

    # Query GDC for file IDs
    logger.info("\n1. Querying GDC for file IDs...")
    gdc_mapping = query_gdc_file_ids_batched(todo)
    logger.info("  Found %d/%d file IDs", len(gdc_mapping), len(todo))

    missing = [s for s in todo if s not in gdc_mapping]
    if missing:
        logger.warning("  %d slides not found in GDC: %s", len(missing), missing[:5])

    # Pipelined download + process with FIFO disk buffer
    logger.info("\n2. Downloading and processing slides...")
    logger.info("  SVS buffer: %.0f GB at %s", config.svs_buffer_gb, config.svs_tmp_dir)
    config.svs_tmp_dir.mkdir(parents=True, exist_ok=True)
    progress = load_progress(config)
    pbar = tqdm(total=len(gdc_mapping), desc="Phase B")

    buffer_limit_bytes = int(config.svs_buffer_gb * 1024 * 1024 * 1024)
    buffer_lock = threading.Lock()

    def _buffer_usage() -> int:
        """Current bytes of SVS files (including partials) in the staging dir."""
        return sum(
            f.stat().st_size
            for f in config.svs_tmp_dir.iterdir()
            if f.is_file() and (f.suffix == ".svs" or f.suffix == ".partial")
        )

    def download_and_process(slide_name: str) -> tuple[str, str]:
        file_id = gdc_mapping[slide_name]
        svs_dest = config.svs_tmp_dir / f"{slide_name}.svs"
        try:
            # Wait for buffer space before downloading
            while True:
                with buffer_lock:
                    usage = _buffer_usage()
                if usage < buffer_limit_bytes:
                    break
                logger.info(
                    "Buffer full (%.1f / %.0f GB), waiting...",
                    usage / (1024**3),
                    config.svs_buffer_gb,
                )
                time.sleep(10)

            download_svs(file_id, svs_dest, config.gdc_timeout, config.max_retries)
            status = process_slide_images(slide_name, svs_dest, config)
        except Exception:
            logger.exception("Failed download/process for %s", slide_name)
            status = "FAIL"
        finally:
            if svs_dest.exists():
                svs_dest.unlink()
            partial = svs_dest.with_suffix(".partial")
            if partial.exists():
                partial.unlink()
        return slide_name, status

    with ThreadPoolExecutor(max_workers=config.n_download_workers) as pool:
        futures = {pool.submit(download_and_process, name): name for name in gdc_mapping}
        counts = {"OK": 0, "SKIP": 0, "FAIL": 0}
        for future in as_completed(futures):
            slide_name, status = future.result()
            counts[status] = counts.get(status, 0) + 1
            if status == "OK":
                progress["completed_b"].append(slide_name)
            elif status == "FAIL":
                progress["failed"].append(slide_name)
            pbar.update(1)

    pbar.close()
    save_progress(config, progress)
    logger.info("\nPhase B summary: %s", counts)
    return counts


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def main(config: Config) -> None:
    logger.info("=" * 60)
    logger.info("GENERATE VISUAL ASSETS — %s", config.cohort)
    logger.info("=" * 60)
    logger.info("  cell_masks_dir: %s", config.cell_masks_dir)
    logger.info("  output_dir:     %s", config.output_dir)
    logger.info("  phase:          %s", config.phase)
    logger.info("  dry_run:        %s", config.dry_run)

    # Discover slides
    slide_manifest = discover_slides(config.cell_masks_dir)
    logger.info("\nFound %d slides with cell_masks.bin", len(slide_manifest))

    if config.dry_run:
        slide_manifest = slide_manifest[:3]
        logger.info("[DRY-RUN] Subset to %d slides", len(slide_manifest))

    if not slide_manifest:
        logger.warning("No slides found. Exiting.")
        return

    slide_names = [name for name, _ in slide_manifest]

    if config.phase in ("A", "both"):
        run_phase_a(slide_manifest, config)

    phase_b_counts: dict[str, int] = {}
    if config.phase in ("B", "both"):
        phase_b_counts = run_phase_b(slide_names, config)

    n_failed = phase_b_counts.get("FAIL", 0)
    if n_failed > 0:
        logger.error(
            "\n%s\nFAILED: %d slides had errors in Phase B\n%s",
            "=" * 60,
            n_failed,
            "=" * 60,
        )
        sys.exit(1)

    logger.info("\n" + "=" * 60)
    logger.info("COMPLETE")
    logger.info("=" * 60)


def parse_args() -> Config:
    parser = argparse.ArgumentParser(description="Generate visual assets for the atlas frontend.")
    parser.add_argument("--cohort", required=True, help="TCGA cohort code (e.g. BRCA)")
    parser.add_argument(
        "--cell-masks-dir",
        required=True,
        type=Path,
        help="Directory containing {slide_name}/cell_masks.bin",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/visual_assets"),
        help="Root output directory (default: data/visual_assets)",
    )
    parser.add_argument(
        "--n-workers",
        type=int,
        default=max(1, os.cpu_count() - 1),
        help="Joblib workers for Phase A (default: cpu_count - 1)",
    )
    parser.add_argument(
        "--n-download-workers",
        type=int,
        default=3,
        help="Concurrent GDC downloads in Phase B (default: 3)",
    )
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=85,
        help="JPEG quality for tiles/thumbnails (default: 85)",
    )
    parser.add_argument(
        "--thumbnail-max-px", type=int, default=512, help="Max thumbnail dimension (default: 512)"
    )
    parser.add_argument(
        "--k", type=int, default=5, help="Representative tiles per feature (default: 5)"
    )
    parser.add_argument(
        "--svs-tmp-dir",
        type=Path,
        default=Path("/tmp/svs_staging"),
        help="Temp directory for SVS files (default: /tmp/svs_staging)",
    )
    parser.add_argument(
        "--svs-buffer-gb",
        type=float,
        default=100.0,
        help="Max GB of SVS files to keep on disk at once (default: 100)",
    )
    parser.add_argument(
        "--phase",
        choices=["A", "B", "both"],
        default="both",
        help="Run Phase A, Phase B, or both (default: both)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Process only 3 slides for testing")

    args = parser.parse_args()
    return Config(
        cohort=args.cohort,
        cell_masks_dir=args.cell_masks_dir,
        output_dir=args.output_dir,
        jpeg_quality=args.jpeg_quality,
        thumbnail_max_px=args.thumbnail_max_px,
        representative_k=args.k,
        svs_tmp_dir=args.svs_tmp_dir,
        svs_buffer_gb=args.svs_buffer_gb,
        n_workers=args.n_workers,
        n_download_workers=args.n_download_workers,
        phase=args.phase,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main(parse_args())
