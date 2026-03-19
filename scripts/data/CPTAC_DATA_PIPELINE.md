# CPTAC Data Pipeline

This document explains the scripts that ingest CPTAC data into the HistoAtlas pipeline. CPTAC (Clinical Proteomic Tumor Analysis Consortium) is a multi-cancer proteogenomics program that, unlike TCGA, lacks a single unified data portal. Molecular data, clinical/survival data, and histomic features come from three separate sources with incompatible patient ID schemes. The scripts below handle downloading, reconciling, and reshaping this data so the dataset-agnostic Snakemake pipeline can process it identically to TCGA.

## Why so many scripts?

TCGA data flows through one download step because TCGA has a unified ID system and a single portal (UCSC Xena / cBioPortal) that serves all data types in consistent formats. CPTAC does not have this luxury:

1. **Two cBioPortal study versions per cancer type.** Published studies (e.g. `brca_cptac_2020`) have molecular profiles but poor survival data. GDC studies (e.g. `breast_cptac_gdc`) have standardized survival but limited molecular data. We must download from both and merge.

2. **Patient ID mismatch.** Published BRCA uses X-prefixed IDs (`X01BR001`), GDC uses unprefixed IDs (`01BR001`), and histomic slide features use yet another variant. A dedicated mapping step reconciles these.

3. **Missing cancer types.** LUSC has 108 molecular patients but zero slides processed through the cell segmentation model. It must be excluded before pipeline launch.

4. **Pipeline interface contract.** The Snakemake pipeline expects unprefixed files under the dataset directory at `data/datasets/cptac/processed/molecular/` (e.g. `clinical_unified.parquet`, not `cptac_clinical_unified.parquet`). A final preparation step writes these canonical files.

## Scripts

### Configuration modules (not run directly)

#### `_cptac_studies.py`

Centralized registry of all 6 CPTAC studies (BRCA, UCEC, LUAD, LUSC, PAAD, HNSCC). Each `CPTACStudy` dataclass stores the cBioPortal study ID, molecular profile IDs (expression, mutation, CNV), and the corresponding GDC study ID. All download scripts import from here to ensure consistency.

**Why it exists:** cBioPortal profile IDs are not predictable (e.g. `brca_cptac_2020_rna_seq_v2_mrna` vs `luad_cptac_2020_mrna`). Centralizing them prevents each script from hardcoding its own copy.

#### `_cptac_id_mapping.py`

Provides `normalize_published_id()` which strips the `X` prefix from published CPTAC IDs (e.g. `X01BR001` -> `01BR001`), and `build_mapping_table()` which matches published patient IDs to GDC patient IDs per cancer type.

**Why it exists:** Published BRCA and 4 LUAD patients use X-prefixed IDs that don't match either GDC clinical data or histomic slide features. Without this normalization, BRCA would have 0% overlap between molecular and slide data.

### Step 1: Download molecular data

#### `download_cptac_molecular.py`

Downloads 5 molecular data types from cBioPortal for all 6 CPTAC studies:

| Data type | Profile source | Output file |
|-----------|---------------|-------------|
| Clinical (unified) | Published + GDC merge | `cptac_clinical_unified.parquet` |
| Expression (curated) | Published studies | `cptac_expression_curated.parquet` |
| Expression (full) | Published studies | `cptac_expression_full.parquet` |
| Mutations | Published studies | `cptac_mutations.parquet` |
| CNV (GISTIC) | Published or GDC fallback | `cptac_cnv.parquet` |

Also saves raw clinical data as `cptac_clinical_patient.parquet` and `cptac_clinical_sample.parquet`.

**Why it exists:** CPTAC molecular data is not available from UCSC Xena (unlike TCGA). cBioPortal's REST API is the only programmatic source. Each data type requires a different API endpoint and response format, and some studies lack certain profiles (e.g. PAAD and LUSC have no published GISTIC CNV, so we fall back to GDC CNA).

**Run:** `uv run python scripts/data/download_cptac_molecular.py`

### Step 2: Download GDC survival data

#### `download_cptac_gdc_clinical.py`

Downloads patient-level clinical data from the GDC versions of each CPTAC study. GDC studies have standardized survival fields (`OS_STATUS`, `OS_MONTHS`) that published studies often lack entirely.

Output: `cptac_clinical_gdc.parquet`

**Why it exists:** The published CPTAC studies on cBioPortal have incomplete survival data. For example, BRCA published has 0 patients with `OS_MONTHS`. The GDC versions have this data but use different patient IDs. This script downloads the GDC side; the next script merges them.

**Run:** `uv run python scripts/data/download_cptac_gdc_clinical.py`

### Step 3: Enrich survival data

#### `enrich_cptac_survival.py`

Merges GDC survival fields into the unified clinical file by building an ID mapping between published and GDC patient IDs (using `_cptac_id_mapping.build_mapping_table()`). Fills in `os_status` and `os_months` where the published study had NaN.

**Why it exists:** After Step 1, BRCA has 0/122 patients with `os_months`. After this enrichment step, coverage jumps to 220/683 patients with `os_months` and 646/683 with `os_status` across all cancer types. Without this step, survival analysis would be impossible for most CPTAC cohorts.

**Run:** `uv run python scripts/data/enrich_cptac_survival.py`

### Step 4: Consolidate histomic features

#### `consolidate_cptac_histomics.py`

Walks the per-slide CSV outputs from the cell segmentation model (`~/Desktop/histomics/CPTAC_{cohort}/{slide}.svs/slide_level_features.csv`), extracts `case_id` from slide folder names using cohort-specific regex patterns, and concatenates everything into a single `data/cptac_slide_level_features.parquet` matching the TCGA schema.

Handles 4 different slide naming conventions:
- BRCA: `01BR001-uuid.svs` (numeric prefix + UUID)
- HNSCC/PAAD/UCEC: `C3L-XXXXX-NN.svs` (C3L/C3N format)
- LUAD: mix of C3L format and pure UUIDs

Output: `data/cptac_slide_level_features.parquet` (1,095 slides across 5 cancer types, 817 unique cases)

**Why it exists:** The cell segmentation pipeline outputs one CSV per slide in a nested directory structure. The Snakemake pipeline expects a single flat parquet file with `cancer_type`, `slide_name`, and `case_id` columns. This script bridges that gap and handles the heterogeneous CPTAC slide naming conventions.

**Run:** `uv run python scripts/data/consolidate_cptac_histomics.py`

### Step 5: Prepare pipeline inputs

#### `prepare_cptac_pipeline_inputs.py`

Final preparation step that makes CPTAC data compatible with the Snakemake pipeline:

1. **Normalizes case IDs** across all molecular files (strips X-prefix using `normalize_published_id()`), so molecular `case_id` values match the slide features.
2. **Drops LUSC** from all files (108 molecular patients with 0 slides).
3. **Writes unprefixed files** to `data/datasets/cptac/processed/molecular/` (e.g. `clinical_unified.parquet` instead of `cptac/cptac_clinical_unified.parquet`), which is where the Snakemake pipeline reads from when `--config dataset=cptac` is set.
4. **Verifies** per-cancer case_id overlap between slides and molecular data.

**Why it exists:** The Snakemake pipeline is dataset-agnostic and reads from per-dataset directories (`data/datasets/{name}/processed/molecular/`). This script is the adapter layer that bridges CPTAC's messy reality (X-prefixed IDs, LUSC without slides, `cptac_`-prefixed filenames) to the pipeline's clean interface.

**Run:** `uv run python scripts/data/prepare_cptac_pipeline_inputs.py`

> **Note:** The same normalization logic is also available via `setup_dataset_dirs.py`, which populates both TCGA and CPTAC dataset directories in one step. You only need to run `prepare_cptac_pipeline_inputs.py` directly if you want to re-normalize CPTAC data without touching TCGA.

## Execution order

```
1. download_cptac_molecular.py          # Molecular data from cBioPortal
2. download_cptac_gdc_clinical.py       # GDC survival data
3. enrich_cptac_survival.py             # Merge GDC survival into clinical
4. consolidate_cptac_histomics.py       # Consolidate per-slide CSVs
5. prepare_cptac_pipeline_inputs.py     # Normalize IDs, drop LUSC, write pipeline inputs
```

Steps 1-2 require internet access (cBioPortal API). Steps 3-5 are local transformations. Step 4 requires the cell segmentation outputs to exist on disk.

After step 5, run the one-time dataset directory setup and launch the pipeline:

```bash
# One-time setup (creates data/datasets/tcga/ and data/datasets/cptac/)
uv run python scripts/data/setup_dataset_dirs.py

# Run the pipeline on CPTAC
uv run snakemake --cores 8 --snakefile workflow/Snakefile --config dataset=cptac run_id=$(date +%Y-%m-%d_%H-%M)
```

## Data flow diagram

```
cBioPortal API (published studies)  ──┐
                                      ├──> download_cptac_molecular.py
cBioPortal API (GDC studies)    ──────┤         │
                                      │         ├── cptac_clinical_unified.parquet
                                      │         ├── cptac_expression_curated.parquet
                                      │         ├── cptac_expression_full.parquet
                                      │         ├── cptac_mutations.parquet
                                      │         ├── cptac_cnv.parquet
                                      │         ├── cptac_clinical_patient.parquet
                                      │         └── cptac_clinical_sample.parquet
                                      │
                                      └──> download_cptac_gdc_clinical.py
                                                │
                                                └── cptac_clinical_gdc.parquet
                                                        │
                                                        v
                                              enrich_cptac_survival.py
                                                        │
                                                        v
                                              cptac_clinical_unified.parquet (enriched)

Cell segmentation outputs ──> consolidate_cptac_histomics.py
  ~/Desktop/histomics/              │
  CPTAC_{cohort}/                   └── data/cptac_slide_level_features.parquet
    {slide}.svs/
      slide_level_features.csv

                    All cptac/ files + slide features
                                │
                                v
                    prepare_cptac_pipeline_inputs.py
                      (or setup_dataset_dirs.py)
                                │
                                ├── data/datasets/cptac/processed/molecular/clinical_unified.parquet
                                ├── data/datasets/cptac/processed/molecular/expression_curated.parquet
                                ├── data/datasets/cptac/processed/molecular/expression_full.parquet
                                ├── data/datasets/cptac/processed/molecular/mutations.parquet
                                ├── data/datasets/cptac/processed/molecular/cnv.parquet
                                ├── data/datasets/cptac/processed/molecular/clinical_patient.parquet
                                ├── data/datasets/cptac/processed/molecular/clinical_sample.parquet
                                └── data/datasets/cptac/slide_level_features.parquet (symlink)
                                            │
                                            v
                                    Snakemake pipeline
                                    (--config dataset=cptac)
```

## Known limitations

- **2 CPT* BRCA IDs** (`CPT000814`, `CPT001846`) cannot be normalized and won't match any slides.
- **~135 LUAD UUID slides** have UUID-format case_ids that don't match any molecular data. They are valid for histomics/clustering but will have NaN molecular features.
- **Immune subtypes** (`immune_subtypes.xlsx`) are TCGA-specific. Zero CPTAC patients match, so immune subtype analyses return empty results (no crash).
- **Batch effects** cannot be assessed because CPTAC has no TSS (Tissue Source Site) equivalent. The pipeline's `batch_proxy_column` is set to `null` and batch effect analysis is skipped.
- **Only OS endpoint** is available for most cancer types. PFS, DSS, and DFS are largely absent.
