"""Centralized CPTAC study configuration for cBioPortal API.

Each study maps to its available molecular profiles. Expression profile names
vary across CPTAC studies, so we store the correct profile ID for each.

Two sources are used:
  - Published studies: richer molecular data (GISTIC CNV, expression, mutations)
  - GDC studies: standardized clinical/survival data

All download scripts should import from here to ensure consistency.
"""

from dataclasses import dataclass


@dataclass
class CPTACStudy:
    """Configuration for a single CPTAC study on cBioPortal."""

    study_id: str
    cancer_type: str  # Standardized code (e.g., "BRCA", "LUAD")
    cancer_name: str
    expression_profile: str  # mRNA expression profile ID (continuous values)
    mutation_profile: str  # Mutation profile ID (MAF format)
    cnv_profile: str | None  # GISTIC discrete CNV profile ID (may be absent)
    proteomics_profile: str | None = None  # TMT global proteomics profile ID
    citation: str = ""

    # Optional GDC counterpart for clinical/survival data
    gdc_study_id: str | None = None
    gdc_cnv_profile: str | None = None  # Fallback CNA from GDC if published lacks GISTIC

    @property
    def is_gdc_only(self) -> bool:
        """True if this study has no separate published study (GDC is the primary source)."""
        return self.study_id == self.gdc_study_id


# Published CPTAC studies — primary source for molecular data
CPTAC_STUDIES: list[CPTACStudy] = [
    CPTACStudy(
        study_id="brca_cptac_2020",
        cancer_type="BRCA",
        cancer_name="Breast Cancer",
        expression_profile="brca_cptac_2020_rna_seq_v2_mrna",
        mutation_profile="brca_cptac_2020_mutations",
        cnv_profile="brca_cptac_2020_gistic",
        proteomics_profile="brca_cptac_2020_protein_quantification",
        citation="Krug et al. Cell 2020",
        gdc_study_id="breast_cptac_gdc",
        gdc_cnv_profile=None,  # GDC breast has no CNA
    ),
    CPTACStudy(
        study_id="ucec_cptac_2020",
        cancer_type="UCEC",
        cancer_name="Endometrial Carcinoma",
        expression_profile="ucec_cptac_2020_mrna",
        mutation_profile="ucec_cptac_2020_mutations",
        cnv_profile="ucec_cptac_2020_gistic",
        proteomics_profile="ucec_cptac_2020_protein_quantification",
        citation="Dou et al. Cell 2020",
        gdc_study_id="uec_cptac_gdc",
        gdc_cnv_profile="uec_cptac_gdc_cna",
    ),
    CPTACStudy(
        study_id="luad_cptac_2020",
        cancer_type="LUAD",
        cancer_name="Lung Adenocarcinoma",
        expression_profile="luad_cptac_2020_mrna",
        mutation_profile="luad_cptac_2020_mutations",
        cnv_profile="luad_cptac_2020_gistic",
        proteomics_profile="luad_cptac_2020_protein_quantification",
        citation="Gillette et al. Cell 2020",
        gdc_study_id="luad_cptac_gdc",
        gdc_cnv_profile="luad_cptac_gdc_cna",
    ),
    CPTACStudy(
        study_id="lusc_cptac_2021",
        cancer_type="LUSC",
        cancer_name="Lung Squamous Cell Carcinoma",
        expression_profile="lusc_cptac_2021_rna_seq_mrna",
        mutation_profile="lusc_cptac_2021_mutations",
        cnv_profile=None,  # Published study has no GISTIC
        proteomics_profile="lusc_cptac_2021_protein_quantification",
        citation="Satpathy et al. Cell 2021",
        gdc_study_id="lusc_cptac_gdc",
        gdc_cnv_profile="lusc_cptac_gdc_cna",
    ),
    CPTACStudy(
        study_id="paad_cptac_2021",
        cancer_type="PAAD",
        cancer_name="Pancreatic Ductal Adenocarcinoma",
        expression_profile="paad_cptac_2021_mrna",
        mutation_profile="paad_cptac_2021_mutations",
        cnv_profile=None,  # Published study has no GISTIC
        proteomics_profile="paad_cptac_2021_protein_quantification",
        citation="Cao et al. Cell 2021",
        gdc_study_id="pancreas_cptac_gdc",
        gdc_cnv_profile="pancreas_cptac_gdc_cna",
    ),
    CPTACStudy(
        study_id="ohnca_cptac_gdc",
        cancer_type="HNSCC",
        cancer_name="Head and Neck Squamous Cell Carcinoma",
        expression_profile="ohnca_cptac_gdc_rna_seq_mrna",
        mutation_profile="ohnca_cptac_gdc_mutations",
        cnv_profile="ohnca_cptac_gdc_cna",
        proteomics_profile=None,  # GDC-only study; no proteomics available
        gdc_study_id="ohnca_cptac_gdc",  # GDC-only study (no separate published study)
        gdc_cnv_profile=None,
    ),
]

# Study ID lookup
CPTAC_STUDY_MAP: dict[str, CPTACStudy] = {s.study_id: s for s in CPTAC_STUDIES}
CPTAC_CANCER_TYPE_MAP: dict[str, CPTACStudy] = {s.cancer_type: s for s in CPTAC_STUDIES}

# All published study IDs (for iteration)
CPTAC_STUDY_IDS: list[str] = [s.study_id for s in CPTAC_STUDIES]
