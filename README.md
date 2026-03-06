# HistoAtlas

**A pan-cancer morphology atlas linking histological features to molecular and clinical outcomes.**

Explore the interactive atlas at **[histoatlas.com](https://histoatlas.com)**

---

## What is HistoAtlas?

HistoAtlas is a comprehensive resource mapping the morphological landscape of cancer across 33 TCGA cancer types. By extracting quantitative histological features from over 11,000 diagnostic whole-slide images, HistoAtlas reveals how tissue architecture relates to patient survival, molecular subtypes, mutational profiles, and immune microenvironment composition.

### Data Scope

- **33 cancer types** from The Cancer Genome Atlas (TCGA) Pan-Cancer Atlas
- **11,000+ H&E whole-slide images** analyzed with deep learning-based feature extraction
- **41 morphological features** capturing cellular composition, tissue architecture, and spatial organization
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

Histological features were extracted using the [HistoPlus](https://github.com/owkin/HistoSSLscaling) foundation model (Owkin), a self-supervised vision transformer trained on large-scale histopathology data. Features capture properties such as tumor cellularity, stromal content, immune infiltration patterns, necrosis, and tissue organization at multiple scales.

All statistical analyses — survival modeling, correlation testing, clustering, and multiple testing correction — were performed using purpose-built Python pipelines with rigorous statistical methodology, including bootstrap stability assessment for clustering and Benjamini-Hochberg correction for multiple comparisons.

## Citation

If you use HistoAtlas in your research, please cite:

```
HistoAtlas: A Pan-Cancer Morphology Atlas Linking Histological Features
to Molecular and Clinical Outcomes.
[Preprint forthcoming]
```

## License

This work is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](LICENSE) (CC BY-NC 4.0).

This project derives features from Owkin's HistoPlus model, which is restricted to non-commercial use. Accordingly, all derived data and analyses are shared under the same non-commercial terms.

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:
- **Attribution** — You must give appropriate credit and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes
