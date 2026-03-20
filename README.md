# HistoAtlas

Interactive morphology atlas linking histomics to molecular and clinical variables across 33 TCGA cancer types.

## Setup

```bash
# Install dependencies with uv
uv sync

# Run scripts
uv run python scripts/download_tcga_molecular.py
```

## Data

The project uses TCGA Pan-Cancer Atlas data:
- **Histomics**: 9,028 slides with 85 morphological features
- **Mutations**: 9,104 samples, 40,543 genes (MC3 calls)
- **CNV**: 10,845 samples, 24,776 genes (GISTIC2)
- **Expression**: 10,071 samples, 133 curated genes
- **Clinical**: 10,953 patients with survival and demographics
