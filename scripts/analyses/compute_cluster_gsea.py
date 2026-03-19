#!/usr/bin/env python3
"""
Compute GSEA for Histomic Clusters.

Runs Gene Set Enrichment Analysis (GSEA) for each L1 cluster using
pathway signatures. Identifies pathways that are differentially enriched
in cluster vs non-cluster samples.

Method:
- For each cluster, compute t-statistics comparing in-cluster vs out-cluster expression
- Run GSEA with permutation test to compute NES and p-values
- Compute canonical GSEA FDR q-values per cluster (pooled null NES)

Caching:
- GSEA results are cached in data/cache/gsea/ keyed on a hash of inputs
  (cluster assignments, gene column names, pathway names, n_perm, seed).
- Cache is reused across pipeline runs when inputs are unchanged.

Output:
- cluster_pathway_gsea.parquet
"""

import hashlib
import logging
import os
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd
from _config import get_dry_run_settings
from _paths import CLUSTER_ANALYSES_DIR, ensure_dirs
from joblib import Parallel, delayed

from histoatlas import run_gsea_for_cluster
from histoatlas.molecular.gsea import GSEAResult

# Suppress FutureWarnings from pandas and RuntimeWarnings from GSEA permutation edge cases
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*invalid value.*")
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*All-NaN slice.*")
logging.basicConfig(level=logging.INFO, format="%(message)s")

logger = logging.getLogger(__name__)

EXPR_META_COLS = ["sampleId", "patientId", "case_id", "cancer_type"]


# Cache directory lives outside per-run dirs so it persists across runs.
# HISTOATLAS_DATA_ROOT is typically data/runs/<run_id> or data/dry_run/<run_id>,
# so we go up to the top-level data/ directory by finding the "data" ancestor.
def _resolve_cache_dir() -> Path:
    """Resolve the GSEA cache directory, robust to both standalone and Snakemake execution."""
    data_root = Path(os.environ.get("HISTOATLAS_DATA_ROOT", "data")).resolve()
    # Walk up until we find a directory named "data" (the project data root)
    for parent in [data_root, *data_root.parents]:
        if parent.name == "data":
            return parent / "cache" / "gsea"
    # Fallback: place cache next to the data root
    return data_root / "cache" / "gsea"


_CACHE_DIR = _resolve_cache_dir()


def _compute_cache_key(
    merged_df: pd.DataFrame,
    gene_cols: list[str],
    pathway_names: list[str],
    n_perm: int,
    seed: int = 42,
) -> str:
    """Compute a deterministic hash of GSEA inputs.

    Hashes: cluster assignments (L1+L2), expression matrix shape,
    all gene column names, pathway names, n_perm, and seed.
    Expression values are NOT hashed (too large, and the TCGA
    matrix is immutable).
    """
    h = hashlib.sha256()
    # Cluster assignments (the main thing that changes between runs)
    l1 = merged_df["cluster_l1"].values
    h.update(l1.tobytes())
    if "cluster_l2" in merged_df.columns:
        l2 = merged_df["cluster_l2"].dropna().values
        h.update(l2.tobytes())
    # Expression matrix fingerprint (shape + all column names)
    h.update(f"{len(merged_df)}x{len(gene_cols)}".encode())
    h.update(",".join(gene_cols).encode())
    # Pathway names
    h.update(",".join(sorted(pathway_names)).encode())
    # Config
    h.update(f"n_perm={n_perm},seed={seed}".encode())
    return h.hexdigest()[:16]


def _load_cache(cache_key: str) -> pd.DataFrame | None:
    """Load cached GSEA results if they exist."""
    cache_path = _CACHE_DIR / f"{cache_key}.parquet"
    if cache_path.exists():
        logger.info("   Cache hit: %s", cache_path)
        return pd.read_parquet(cache_path)
    return None


def _save_cache(gsea_df: pd.DataFrame, cache_key: str) -> None:
    """Save GSEA results to cache."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = _CACHE_DIR / f"{cache_key}.parquet"
    gsea_df.to_parquet(cache_path, index=False)
    logger.info("   Cached results: %s", cache_path)


@dataclass
class Config:
    """Configuration for cluster GSEA analysis."""

    n_perm: int = 1000

    def __post_init__(self) -> None:
        """Apply dry-run settings if active."""
        dry_run = get_dry_run_settings()
        if dry_run:
            self.n_perm = dry_run.n_perm

    @property
    def molecular_dir(self) -> Path:
        from _paths import MOLECULAR_DIR

        return MOLECULAR_DIR

    @property
    def slides_path(self) -> Path:
        from _paths import SLIDE_HISTOMICS

        return SLIDE_HISTOMICS

    @property
    def expression_path(self) -> Path:
        from _paths import EXPRESSION_FULL

        return EXPRESSION_FULL

    @property
    def output_path(self) -> Path:
        from _paths import CLUSTER_PATHWAY_GSEA

        return CLUSTER_PATHWAY_GSEA


def load_data(config: Config) -> tuple[pd.DataFrame, list[str], dict]:
    """Load and merge slides with expression data.

    Returns:
        Tuple of (merged DataFrame with cluster labels and expression, list of gene columns, pathways)
    """
    slides_df = pd.read_parquet(config.slides_path)
    if "case_id" not in slides_df.columns:
        raise ValueError("slide_histomics.parquet must contain a 'case_id' column.")

    expression_df = pd.read_parquet(config.expression_path)

    gene_cols = [c for c in expression_df.columns if c not in EXPR_META_COLS]

    from histoatlas import load_hallmark_gene_sets

    pathways = load_hallmark_gene_sets()

    # Apply dry-run subsetting
    dry_run = get_dry_run_settings()
    if dry_run:
        gene_cols = gene_cols[: dry_run.n_genes * 10]  # Keep more genes for pathway scoring
        # Subset pathways
        pathway_names = list(pathways.keys())[: dry_run.n_pathways]
        pathways = {k: pathways[k] for k in pathway_names}
        logger.info(f"   [DRY-RUN] Subset to {len(gene_cols)} genes, {len(pathways)} pathways")

    logger.info(f"   Slides: {len(slides_df)}")
    logger.info(f"   Genes: {len(gene_cols)}")
    logger.info(f"   Pathway signatures: {len(pathways)}")

    slide_cols = ["case_id", "cancer_type", "cluster_l1"]
    if "cluster_l2" in slides_df.columns:
        slide_cols.append("cluster_l2")

    merged_df = slides_df[slide_cols].merge(
        expression_df[["case_id"] + gene_cols], on="case_id", how="inner"
    )

    logger.info(f"   Merged samples with expression: {len(merged_df)}")

    return merged_df, gene_cols, pathways


def _gsea_cluster_task(
    expr_with_clusters: pd.DataFrame,
    cluster_id: int,
    pathways: dict,
    gene_cols: list[str],
    n_perm: int,
    seed: int = 42,
) -> list[GSEAResult]:
    """Run GSEA for a single L1 cluster (for parallel execution)."""
    cluster_mask = (expr_with_clusters["cluster_l1"] == cluster_id).values
    return run_gsea_for_cluster(
        expression_df=expr_with_clusters,
        cluster_mask=cluster_mask,
        pathways=pathways,
        gene_cols=gene_cols,
        cluster_id=int(cluster_id),
        cluster_level="L1",
        n_perm=n_perm,
        seed=seed,
        cancer_type="PAN",
    )


def _gsea_l2_cluster_task(
    cancer_df: pd.DataFrame,
    cluster_id: int,
    pathways: dict,
    gene_cols: list[str],
    n_perm: int,
    cancer_type: str,
    seed: int = 42,
) -> list[GSEAResult]:
    """Run GSEA for a single L2 cluster (for parallel execution)."""
    cluster_mask = (cancer_df["cluster_l2"] == cluster_id).values
    return run_gsea_for_cluster(
        expression_df=cancer_df,
        cluster_mask=cluster_mask,
        pathways=pathways,
        gene_cols=gene_cols,
        cluster_id=int(cluster_id),
        cluster_level="L2",
        n_perm=n_perm,
        seed=seed,
        cancer_type=cancer_type,
    )


def run_gsea_for_all_clusters(
    merged_df: pd.DataFrame,
    gene_cols: list[str],
    pathways: dict,
    n_perm: int,
) -> list[GSEAResult]:
    """Run GSEA analysis for each cluster.

    Args:
        merged_df: DataFrame with cluster labels and gene expression
        gene_cols: List of gene column names
        pathways: Dictionary of pathway signatures
        n_perm: Number of permutations for GSEA

    Returns:
        List of GSEAResult objects for all clusters
    """

    expr_with_clusters = merged_df[["case_id", "cluster_l1"] + gene_cols].dropna(
        subset=["cluster_l1"]
    )

    clusters = sorted(expr_with_clusters["cluster_l1"].unique())
    n_jobs = int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))

    logger.info(
        "   Clusters to analyze: %d (n_jobs=%d, n_perm=%d, n_genes=%d, n_pathways=%d)",
        len(clusters),
        n_jobs,
        n_perm,
        len(gene_cols),
        len(pathways),
    )

    cluster_results_list = Parallel(n_jobs=n_jobs, backend="loky", verbose=10)(
        delayed(_gsea_cluster_task)(
            expr_with_clusters,
            cluster_id,
            pathways,
            gene_cols,
            n_perm,
        )
        for cluster_id in clusters
    )

    gsea_results: list[GSEAResult] = []
    for cluster_results in cluster_results_list:
        gsea_results.extend(cluster_results)

    logger.info(
        "   L1 GSEA complete: %d pathway results from %d clusters", len(gsea_results), len(clusters)
    )
    return gsea_results


def run_gsea_for_l2_clusters(
    merged_df: pd.DataFrame,
    gene_cols: list[str],
    pathways: dict,
    n_perm: int,
) -> list[GSEAResult]:
    """Run GSEA analysis for each L2 (cancer-specific) cluster.

    Args:
        merged_df: DataFrame with cluster labels, cancer_type, and gene expression
        gene_cols: List of gene column names
        pathways: Dictionary of pathway signatures
        n_perm: Number of permutations for GSEA

    Returns:
        List of GSEAResult objects for all L2 clusters
    """
    if "cluster_l2" not in merged_df.columns:
        logger.info("   No cluster_l2 column — skipping L2 GSEA")
        return []

    n_jobs = int(os.environ.get("HISTOATLAS_N_JOBS", "-1"))
    cancer_types = merged_df["cancer_type"].dropna().unique()

    # Collect all L2 tasks upfront for a single parallel dispatch.
    # The original sequential loop left most workers idle (only ~3 clusters
    # per cancer type). Flattening runs all ~60 tasks in one pool.
    tasks: list[tuple] = []
    for cancer in sorted(cancer_types):
        cancer_df = merged_df[merged_df["cancer_type"] == cancer].dropna(subset=["cluster_l2"])
        clusters = sorted(cancer_df["cluster_l2"].unique())

        if len(clusters) < 2:
            logger.info("   Skipping %s — only %d L2 cluster(s)", cancer, len(clusters))
            continue

        logger.info(
            "   %s: %d L2 clusters, %d samples",
            cancer,
            len(clusters),
            len(cancer_df),
        )

        for cluster_id in clusters:
            tasks.append((cancer_df, cluster_id, pathways, gene_cols, n_perm, cancer))

    if not tasks:
        return []

    logger.info(
        "   Total L2 tasks: %d (n_jobs=%d, n_perm=%d, n_genes=%d, n_pathways=%d)",
        len(tasks),
        n_jobs,
        n_perm,
        len(gene_cols),
        len(pathways),
    )

    all_results = Parallel(n_jobs=n_jobs, backend="loky", verbose=10)(
        delayed(_gsea_l2_cluster_task)(*args) for args in tasks
    )

    gsea_results: list[GSEAResult] = []
    for cluster_results in all_results:
        gsea_results.extend(cluster_results)

    logger.info(
        "   L2 GSEA complete: %d pathway results from %d tasks", len(gsea_results), len(tasks)
    )
    return gsea_results


def add_fdr_metadata(gsea_df: pd.DataFrame) -> pd.DataFrame:
    """Add correction metadata columns to GSEA results.

    Args:
        gsea_df: DataFrame with GSEA results

    Returns:
        DataFrame with added correction metadata columns
    """
    gsea_df["correction_method"] = "GSEA FDR (pooled null NES)"
    group_cols = ["cluster_level", "cancer_type", "cluster_id"]
    gsea_df["n_tests_in_family"] = gsea_df.groupby(group_cols)["pathway_name"].transform("count")
    gsea_df["correction_family_id"] = gsea_df.apply(
        lambda r: f"{r['cluster_level']}_{r['cancer_type']}_{int(r['cluster_id'])}", axis=1
    )
    return gsea_df


def save_results(gsea_df: pd.DataFrame, config: Config) -> None:
    """Save results and print summary.

    Args:
        gsea_df: DataFrame with GSEA results
        config: Configuration object
    """
    ensure_dirs()
    CLUSTER_ANALYSES_DIR.mkdir(parents=True, exist_ok=True)

    gsea_df.to_parquet(config.output_path, index=False)
    logger.info("   Saved %s", config.output_path.name)

    if gsea_df.empty:
        logger.info("   Total GSEA results: 0")
        return

    logger.info(f"   Total GSEA results: {len(gsea_df)}")
    logger.info(f"   Significant (GSEA FDR q < 0.25): {gsea_df['is_significant'].sum()}")

    logger.info("\n   Top enriched pathways by NES:")
    top = gsea_df.nsmallest(10, "fdr_q")[["cluster_id", "pathway_name", "nes", "fdr_q"]]
    for _, row in top.iterrows():
        logger.info(
            f"      Cluster {int(row['cluster_id'])}: {row['pathway_name']} "
            f"(NES={row['nes']:.2f}, FDR q={row['fdr_q']:.3f})"
        )


def main(config: Config) -> None:
    """Orchestrate the GSEA analysis pipeline."""
    logger.info("=" * 60)
    logger.info("CLUSTER GSEA ANALYSIS")
    logger.info("=" * 60)

    logger.info("\n1. Loading data...")
    merged_df, gene_cols, pathways = load_data(config)

    # Check cache before computing
    cache_key = _compute_cache_key(merged_df, gene_cols, list(pathways.keys()), config.n_perm)
    logger.info("   Cache key: %s", cache_key)
    cached_df = _load_cache(cache_key)

    if cached_df is not None:
        logger.info("   Using cached GSEA results — skipping computation")
        gsea_df = cached_df
    else:
        logger.info("   No cache found — computing GSEA from scratch")

        from _config import include_pancan

        if include_pancan():
            logger.info("\n2. Running GSEA per L1 cluster...")
            l1_results = run_gsea_for_all_clusters(merged_df, gene_cols, pathways, config.n_perm)
        else:
            logger.info("\n2. L1 GSEA skipped (include_pancan=false)")
            l1_results = []

        logger.info("\n3. Running GSEA per L2 cluster (cancer-specific)...")
        l2_results = run_gsea_for_l2_clusters(merged_df, gene_cols, pathways, config.n_perm)

        logger.info("\n4. Computing GSEA FDR...")
        all_results = l1_results + l2_results
        if not all_results:
            logger.info("   No GSEA results computed — writing empty output")
            gsea_df = pd.DataFrame()
        else:
            gsea_df = pd.DataFrame([asdict(r) for r in all_results])
            if not gsea_df.empty:
                gsea_df = add_fdr_metadata(gsea_df)

        _save_cache(gsea_df, cache_key)

    save_results(gsea_df, config)

    logger.info("\n" + "=" * 60)
    logger.info("CLUSTER GSEA COMPLETE")
    logger.info("=" * 60)

    logger.info("\nOutput files:")
    logger.info("  - cluster_pathway_gsea.parquet")


if __name__ == "__main__":
    config = Config()
    main(config)
