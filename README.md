# HistoAtlas

**A pan-cancer morphology atlas linking histological features to molecular and clinical outcomes.**

Explore the interactive atlas at **[histoatlas.com](https://histoatlas.com)**

---

## What is HistoAtlas?

HistoAtlas is a comprehensive resource mapping the morphological landscape of cancer across 21 TCGA cancer types. By extracting quantitative histological features from over 6,000 diagnostic whole-slide images, HistoAtlas reveals how tissue architecture relates to patient survival, molecular subtypes, mutational profiles, and immune microenvironment composition.

### Data Scope

- **21 cancer types** from The Cancer Genome Atlas (TCGA) Pan-Cancer Atlas
- **6,000+ H&E whole-slide images** analyzed with deep learning-based cell and tissue segmentation
- **40 morphological features** capturing cellular composition, tissue architecture, and spatial organization
- **Multi-omic integration** with mutations, copy number alterations, gene expression, pathway scores, and immune cell estimates

### Key Capabilities

- **Survival analysis** — Cox proportional hazards models linking morphological features to overall survival, with Kaplan-Meier curves and restricted mean survival time (RMST) estimates
- **Molecular correlations** — Spearman correlations between histological features and gene expression, pathway activity (GSVA), copy number alterations, and immune cell infiltration scores
- **Categorical associations** — Associations between morphological features and somatic mutations, molecular subtypes, and treatment response, quantified with Cliff's delta effect sizes
- **Morphological clustering** — Pan-cancer and cancer-specific clustering of slides based on morphological profiles, revealing shared histological phenotypes across cancer types
- **Interactive exploration** — UMAP embeddings, slide-level deep dives, and cluster characterization through an interactive web interface

## Explore

Visit **[histoatlas.com](https://histoatlas.com)** to:

- Browse the pan-cancer morphological embedding
- Examine survival associations for any feature and cancer type
- Discover molecular correlates of tissue architecture
- Explore morphological clusters and their molecular signatures
- View representative H&E image tiles for each cluster

## Methods

The analysis pipeline has three stages:

1. **Cell and tissue segmentation** — Cell-level instance segmentation is performed using the HistoPLUS model ([Adjadj et al., 2025](https://arxiv.org/abs/2508.09926)), which detects and classifies individual cells into nine morphological types (tumor cells, lymphocytes, fibroblasts, plasmocytes, neutrophils, eosinophils, red blood cells, apoptotic bodies, and mitotic figures). Tissue-level semantic segmentation classifies each pixel into tissue compartments (cancerous epithelium, stroma, necrosis, normal epithelium, blood) using a CellViT-based architecture ([Hörst et al., 2024](https://doi.org/10.1016/j.media.2024.103143)) with a Phikon self-supervised backbone ([Filiot et al., 2023](https://doi.org/10.1101/2023.07.21.23292757)), trained on the PanopTILs dataset ([Amgad et al., 2019](https://doi.org/10.1093/bioinformatics/btz083)).

2. **Spatial feature extraction** — Histomics features are computed within spatially defined bands around the tumor–stroma interface using signed Euclidean distance transforms. This captures the invasive margin, tumor core, peritumoral stroma, and perinecrotic zones at biologically meaningful scales.

3. **Statistical analysis** — Survival modelling (Cox PH, RMST), Spearman correlations, categorical association testing (Cliff's delta), gene set enrichment analysis, and unsupervised clustering (K-means with bootstrap stability assessment). All analyses include Benjamini-Hochberg multiple testing correction, evidence strength classification, and confounding adjustment (age, sex, stage, tissue source site, tumor purity). The full pipeline is orchestrated with Snakemake ([Mölder et al., 2021](https://doi.org/10.12688/f1000research.29032.2)).

Clinical endpoints are sourced from the TCGA Pan-Cancer Clinical Data Resource ([Liu et al., 2018](https://doi.org/10.1016/j.cell.2018.02.052)). Molecular annotations include somatic mutations from the MC3 ensemble ([Ellrott et al., 2018](https://doi.org/10.1016/j.cels.2018.03.002)), immune cell estimates from CIBERSORT ([Newman et al., 2015](https://doi.org/10.1038/nmeth.3337)) and xCell ([Aran et al., 2017](https://doi.org/10.1186/s13059-017-1349-1)), and tumor purity from ABSOLUTE ([Carter et al., 2012](https://doi.org/10.1038/nbt.2203)).

For the full methodology, see [histoatlas.com/methods](https://histoatlas.com/methods).

## Citation

If you use HistoAtlas in your research, please cite:

```bibtex
@misc{histoatlas2026,
  title     = {HistoAtlas: A Pan-Cancer Morphology Atlas Linking Histomics
               to Molecular Programs and Clinical Outcomes},
  author    = {Bannier, Pierre-Antoine},
  year      = {2026},
  url       = {https://histoatlas.com},
  note      = {Version 1.0}
}
```

## License

This work is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](LICENSE) (CC BY-NC 4.0).

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:
- **Attribution** — You must give appropriate credit and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes
