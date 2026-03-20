import { Equation } from '../ui/Equation';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-sm bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700">
      {children}
    </code>
  );
}

function Eq({ tex }: { tex: string }) {
  return <Equation tex={tex} />;
}

function DisplayEq({ tex }: { tex: string }) {
  return (
    <div className="my-4 overflow-x-auto">
      <Equation tex={tex} display />
    </div>
  );
}

function SectionHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-zinc-900 mb-4 mt-12 scroll-mt-20">
      {number}. {title}
    </h2>
  );
}

function SubHeading({ title }: { title: string }) {
  return <h3 className="text-base font-semibold text-zinc-900 mb-2 mt-6">{title}</h3>;
}

function PartDivider({ label }: { label: string }) {
  return (
    <div className="mt-16 mb-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Table of Contents                                                  */
/* ------------------------------------------------------------------ */

const TOC_PART_A = [
  { id: 'overview', title: 'Overview' },
  { id: 'data-sources', title: 'Data Sources and Cohort Definition' },
  { id: 'cell-segmentation', title: 'Cell Segmentation' },
  { id: 'tissue-segmentation', title: 'Tissue Segmentation' },
  { id: 'spatial-regions', title: 'Spatial Region Definition' },
] as const;

const TOC_PART_B = [
  { id: 'preprocessing', title: 'Feature Preprocessing' },
  { id: 'dimensionality-reduction', title: 'Dimensionality Reduction' },
  { id: 'clustering', title: 'Clustering and Stability Assessment' },
  { id: 'survival', title: 'Survival Analysis' },
  { id: 'continuous-associations', title: 'Continuous Association Analysis' },
  { id: 'categorical-associations', title: 'Categorical Association Analysis' },
  { id: 'gsea', title: 'Gene Set Enrichment Analysis' },
  { id: 'multiple-testing', title: 'Multiple Testing Correction' },
  { id: 'mdes', title: 'Statistical Power and Minimum Detectable Effect Sizes' },
  { id: 'evidence', title: 'Evidence Strength Classification' },
  { id: 'confounding', title: 'Confounding Adjustment Framework' },
  { id: 'software', title: 'Software and Reproducibility' },
] as const;

const TOC_REFS = [
  { id: 'references', title: 'References' },
] as const;

function TableOfContents() {
  const partAOffset = 0;
  const partBOffset = TOC_PART_A.length;
  const refsOffset = partBOffset + TOC_PART_B.length;

  return (
    <nav className="bg-white border border-zinc-200 rounded-lg p-5 mb-10">
      <h2 className="text-base font-semibold text-zinc-900 mb-3">Table of Contents</h2>

      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mt-4 mb-1.5">
        Part A &middot; Image Analysis Pipeline
      </p>
      <ol className="space-y-1.5">
        {TOC_PART_A.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              <span className="text-zinc-400 mr-2">{partAOffset + i + 1}.</span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>

      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mt-4 mb-1.5">
        Part B &middot; Statistical Methods
      </p>
      <ol className="space-y-1.5">
        {TOC_PART_B.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              <span className="text-zinc-400 mr-2">{partBOffset + i + 1}.</span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>

      <ol className="space-y-1.5 mt-3">
        {TOC_REFS.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              <span className="text-zinc-400 mr-2">{refsOffset + i + 1}.</span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Tables                                                             */
/* ------------------------------------------------------------------ */

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-2.5 text-zinc-700 ${className}`}>
      {children}
    </td>
  );
}

function CovariateTable() {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <Th>Model</Th>
            <Th>Covariates</Th>
            <Th>TSS handling</Th>
            <Th>Purpose</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr>
            <Td className="font-medium">Unadjusted</Td>
            <Td>None (feature only)</Td>
            <Td>--</Td>
            <Td>Marginal association</Td>
          </tr>
          <tr>
            <Td className="font-medium">Adjusted</Td>
            <Td>Age, sex, AJCC pathological stage</Td>
            <Td>Survival: stratified Cox; Correlations: top-5 sites + &quot;Other&quot;</Td>
            <Td>Confounding adjustment</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PHViolationTable() {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <Th>Flag</Th>
            <Th>Condition</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700">Pass</span></Td>
            <Td><Eq tex="p_{\text{Schoenfeld}} \ge 0.05" /></Td>
            <Td>No evidence of PH violation; Cox HR reported without caveat</Td>
          </tr>
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">Warn</span></Td>
            <Td><Eq tex="0.01 \le p_{\text{Schoenfeld}} < 0.05" /></Td>
            <Td>Borderline violation; HR reported with a warning annotation</Td>
          </tr>
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-red-50 text-red-700">Fail</span></Td>
            <Td><Eq tex="p_{\text{Schoenfeld}} < 0.01" /></Td>
            <Td>Strong evidence of non-proportionality; RMST difference becomes the primary reported effect</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EvidenceTable() {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <Th>Tier</Th>
            <Th>P-value</Th>
            <Th>Effect size</Th>
            <Th>CI width</Th>
            <Th>Sample size</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700">Strong</span></Td>
            <Td className="font-mono text-xs"><Eq tex="p_{\text{adj}} < 0.01" /></Td>
            <Td>Above threshold (see below)</Td>
            <Td>Narrow</Td>
            <Td><Eq tex="n \ge 100" /></Td>
          </tr>
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">Moderate</span></Td>
            <Td className="font-mono text-xs"><Eq tex="p_{\text{adj}} < 0.05" /></Td>
            <Td>Above threshold (see below)</Td>
            <Td>Narrow or moderate</Td>
            <Td><Eq tex="n \ge 50" /></Td>
          </tr>
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-zinc-100 text-zinc-600">Suggestive</span></Td>
            <Td className="font-mono text-xs"><Eq tex="p_{\text{adj}} < 0.10" /> or CI excludes null (HR = 1, <Eq tex="r_s" /> = 0, <Eq tex="\delta" /> = 0, or <Eq tex="\eta^2" /> = 0)</Td>
            <Td>&ndash;</Td>
            <Td>&ndash;</Td>
            <Td><Eq tex="n \ge 30" /></Td>
          </tr>
          <tr>
            <Td><span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-zinc-100 text-zinc-500">Insufficient</span></Td>
            <Td className="font-mono text-xs">&ndash;</Td>
            <Td>&ndash;</Td>
            <Td>&ndash;</Td>
            <Td><Eq tex="n < 30" /></Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CorrectionFamilyTable() {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <Th>Analysis type</Th>
            <Th>Grouping key (correction family)</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr>
            <Td>Cox survival (features)</Td>
            <Td className="font-mono text-xs">cancer_type &times; endpoint &times; model</Td>
          </tr>
          <tr>
            <Td>Cluster survival (Cox)</Td>
            <Td className="font-mono text-xs">cluster_level &times; analysis_type &times; cancer_type &times; endpoint &times; model</Td>
          </tr>
          <tr>
            <Td>Cluster survival (log-rank)</Td>
            <Td className="font-mono text-xs">cluster_level &times; analysis_type &times; cancer_type &times; endpoint</Td>
          </tr>
          <tr>
            <Td>RMST</Td>
            <Td className="font-mono text-xs">cancer_type &times; endpoint &times; model</Td>
          </tr>
          <tr>
            <Td>Spearman correlations</Td>
            <Td className="font-mono text-xs">cancer_type &times; target_set_id &times; corr_method &times; model</Td>
          </tr>
          <tr>
            <Td>Categorical associations</Td>
            <Td className="font-mono text-xs">cancer_type &times; categorical_var &times; test_type &times; model</Td>
          </tr>
          <tr>
            <Td>GSEA</Td>
            <Td className="font-mono text-xs">Pooled null NES per cluster (canonical GSEA FDR)</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SampleSizeTable() {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <Th>Analysis type</Th>
            <Th>Minimum n</Th>
            <Th>Additional requirement</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr>
            <Td>Cox proportional hazards</Td>
            <Td className="font-mono text-xs">30</Td>
            <Td>Events &ge; 10</Td>
          </tr>
          <tr>
            <Td>RMST</Td>
            <Td className="font-mono text-xs">20</Td>
            <Td>&ge; 5 per group</Td>
          </tr>
          <tr>
            <Td>Spearman correlation</Td>
            <Td className="font-mono text-xs">30</Td>
            <Td>&ndash;</Td>
          </tr>
          <tr>
            <Td>Categorical (2-group)</Td>
            <Td className="font-mono text-xs">30</Td>
            <Td>&ge; 5 per group</Td>
          </tr>
          <tr>
            <Td>Categorical (k-group)</Td>
            <Td className="font-mono text-xs">30</Td>
            <Td>&ge; 5 per group</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CIWidthTable() {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <Th>Scale</Th>
            <Th>Narrow</Th>
            <Th>Moderate</Th>
            <Th>Wide</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr>
            <Td className="font-medium">Ratio (HR)</Td>
            <Td className="font-mono text-xs">CI upper/lower &lt; 2</Td>
            <Td className="font-mono text-xs">2 &le; ratio &lt; 4</Td>
            <Td className="font-mono text-xs">ratio &ge; 4</Td>
          </tr>
          <tr>
            <Td className="font-medium">Additive (<Eq tex="r_s" />, <Eq tex="\delta" />)</Td>
            <Td className="font-mono text-xs">CI width &lt; 0.3</Td>
            <Td className="font-mono text-xs">0.3 &le; width &lt; 0.6</Td>
            <Td className="font-mono text-xs">width &ge; 0.6</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function MethodsContent() {
  return (
    <div className="text-zinc-600 leading-relaxed text-[15px]">
      <TableOfContents />

      {/* ============================================================= */}
      {/*  PART A: IMAGE ANALYSIS PIPELINE                               */}
      {/* ============================================================= */}
      <PartDivider label="Image Analysis Pipeline" />

      {/* --------------------------------------------------------------- */}
      {/* 1. Overview                                                      */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="overview" number={1} title="Overview" />
      <p>
        HistoAtlas is a pan-cancer atlas of computational histopathology features derived from
        The Cancer Genome Atlas (TCGA). It integrates 38 quantitative histomics features
        extracted from hematoxylin-and-eosin (H&E) whole-slide images with clinical, genomic,
        and molecular annotations. The analysis pipeline has three stages: (1) cell and tissue
        segmentation from H&E whole-slide images (§3-§4), (2) spatial region definition and
        histomics feature extraction (§5), and (3) statistical analysis of feature-outcome
        associations (§6-§17). The platform provides a suite of statistical analyses:
        survival modelling, correlation analysis, categorical association testing, gene set
        enrichment, and unsupervised clustering, all designed to characterise how tissue
        morphology relates to patient outcomes and tumour biology across 24 cancer types.
        All analyses are executed through a reproducible Snakemake pipeline with multiple
        testing correction, evidence strength classification, and confounding adjustment
        applied systematically.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 2. Data Sources and Cohort Definition                            */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="data-sources" number={2} title="Data Sources and Cohort Definition" />
      <p>
        Tissue slides and clinical annotations are sourced from TCGA via the Genomic Data
        Commons (GDC). The atlas includes 9,028 diagnostic whole-slide images spanning 33
        TCGA cancer types. One representative formalin-fixed, paraffin-embedded (FFPE) diagnostic
        slide is selected per patient case. Slides are excluded if the viable tissue area
        (i.e., the area of all non-whitespace, non-artefact compartments after tissue
        segmentation, §4) falls below 1&nbsp;mm&sup2;, or if the slide exhibits severe
        processing artefacts (pen marks covering &gt;20% of tissue area, out-of-focus
        regions), or if essential clinical metadata (vital status, follow-up time) is
        missing. In addition, nine TCGA cancer types are excluded entirely because
        their dominant cell morphologies fall outside the training domain of the
        HistoPLUS cell detection model (§3), which was developed primarily on
        squamous and epithelial tissue: KIRC, KIRP, and KICH (renal clear-cell,
        papillary, and chromophobe carcinomas), DLBC (diffuse large B-cell
        lymphoma), LAML (acute myeloid leukaemia), LGG and GBM (lower-grade and
        high-grade gliomas), SKCM (cutaneous melanoma), and PCPG
        (pheochromocytoma and paraganglioma). After all exclusions, the final
        cohort comprises 24 cancer types.
      </p>
      <p className="mt-3">
        Clinical endpoints include overall survival (OS), progression-free survival (PFS), disease-specific survival (DSS), and disease-free survival (DFS),
        with time-to-event and censoring indicators sourced from the TCGA Pan-Cancer Clinical
        Data Resource (TCGA-CDR; <a href="https://doi.org/10.1016/j.cell.2018.02.052" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Liu et al., 2018</a>).
      </p>
      <p className="mt-3">
        Molecular annotations are derived from published TCGA companion studies. Somatic
        mutation calls originate from the MC3 multi-caller ensemble (<a href="https://doi.org/10.1016/j.cels.2018.03.002" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ellrott et al., 2018</a>).
        Immune cell fraction estimates are obtained from CIBERSORT (<a href="https://doi.org/10.1038/nmeth.3337" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Newman et al., 2015</a>)
        and xCell (<a href="https://doi.org/10.1186/s13059-017-1349-1" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Aran et al., 2017</a>). Tumour purity is estimated by ABSOLUTE (<a href="https://doi.org/10.1038/nbt.2203" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Carter et al.,
        2012</a>). Immune subtypes (C1-C6) are taken from the pan-cancer immune landscape
        analysis of <a href="https://doi.org/10.1016/j.immuni.2018.03.023" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Thorsson et al. (2018)</a>, which classified TCGA samples into six
        categories: wound healing (C1), IFN-&gamma; dominant (C2), inflammatory (C3),
        lymphocyte depleted (C4), immunologically quiet (C5), and TGF-&beta; dominant
        (C6), based on integrated immune gene expression, leukocyte fraction, and
        neoantigen data.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 3. Cell Segmentation                                             */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="cell-segmentation" number={3} title="Cell Segmentation" />
      <p>
        Cell-level instance segmentation is performed using Owkin&rsquo;s HistoPLUS
        model (<a href="https://arxiv.org/abs/2508.09926" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Adjadj et al., 2025</a>), a cell detection, segmentation and classification model for computational pathology.
        HistoPLUS detects and classifies individual cells into nine morphological types:
      </p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <Th>Cell type</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><Td className="font-medium">Tumor cells</Td><Td>Neoplastic epithelial cells</Td></tr>
            <tr><Td className="font-medium">Lymphocytes</Td><Td>T cells, B cells, NK cells</Td></tr>
            <tr><Td className="font-medium">Fibroblasts</Td><Td>Stromal spindle cells</Td></tr>
            <tr><Td className="font-medium">Plasmocytes</Td><Td>Antibody-secreting B cell derivatives</Td></tr>
            <tr><Td className="font-medium">Neutrophils</Td><Td>Polymorphonuclear granulocytes</Td></tr>
            <tr><Td className="font-medium">Eosinophils</Td><Td>Bilobed eosinophilic granulocytes</Td></tr>
            <tr><Td className="font-medium">Red blood cells</Td><Td>Erythrocytes (excluded from density computations)</Td></tr>
            <tr><Td className="font-medium">Apoptotic bodies</Td><Td>Cell death fragments</Td></tr>
            <tr><Td className="font-medium">Mitotic figures</Td><Td>Cells undergoing division</Td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Inference is performed tile-by-tile on 224&nbsp;&times;&nbsp;224&nbsp;px tiles.
        When 40&times; magnification is available (0.25&nbsp;&mu;m/px), it is used directly;
        otherwise, the model falls back to 20&times; (0.50&nbsp;&mu;m/px). Tiles are extracted with a 64-pixel
        (16&nbsp;&mu;m) overlap margin between adjacent tiles. Cells detected in overlap
        regions are deduplicated via a union-find algorithm that merges instances whose
        centroids fall within 10&nbsp;&mu;m of each other, preventing border-effect
        artefacts at tile boundaries.
      </p>
      <p className="mt-3">
        The output for each cell is an instance segmentation mask, a centroid coordinate
        (<Eq tex="x, y" />), and a cell-type label. HistoPLUS achieves a mean panoptic
        quality (PQ) of 0.509 across cell types on its evaluation benchmark; see <a href="https://arxiv.org/abs/2508.09926" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Adjadj
        et al. (2025)</a> for the full evaluation protocol.
        These per-cell annotations serve as
        inputs for downstream density, ratio, and spatial features (§5).
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 4. Tissue Segmentation                                           */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="tissue-segmentation" number={4} title="Tissue Segmentation" />
      <p>
        Tissue-level semantic segmentation classifies each pixel of the whole-slide image
        into one of nine tissue compartments. The model uses a CellViT-inspired architecture
        (<a href="https://doi.org/10.1016/j.media.2024.103143" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Hörst et al., 2024</a>) with a Phikon self-supervised backbone (<a href="https://doi.org/10.1101/2023.07.21.23292757" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Filiot et al., 2023</a>),
        trained on the PanopTILs crowdsourced annotation dataset (<a href="https://doi.org/10.1093/bioinformatics/btz083" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Amgad et al., 2019</a>).
        Inference is performed at 0.5&nbsp;&mu;m/px on 224&nbsp;&times;&nbsp;224&nbsp;px tiles.
        Adjacent tiles overlap by 32 pixels and the final segmentation mask is obtained by
        majority voting in overlap regions, followed by downsampling to the
        analysis resolution of 8&nbsp;&mu;m/px (§5). On the PanopTILs held-out test set, the
        model achieves a mean intersection-over-union (mIoU) of 0.72 across tissue classes;
        see supplementary materials for the per-class breakdown.
      </p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <Th>Tissue class</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><Td className="font-medium">Cancerous epithelium</Td><Td>Tumour cell regions</Td></tr>
            <tr><Td className="font-medium">Stroma</Td><Td>Connective tissue and fibroblast-rich areas</Td></tr>
            <tr><Td className="font-medium">Necrosis</Td><Td>Dead tissue regions</Td></tr>
            <tr><Td className="font-medium">Normal epithelium</Td><Td>Non-neoplastic epithelial tissue</Td></tr>
            <tr><Td className="font-medium">TILs</Td><Td>Tumour-infiltrating lymphocyte-dense areas</Td></tr>
            <tr><Td className="font-medium">Junk / Debris</Td><Td>Processing artefacts and tissue folds</Td></tr>
            <tr><Td className="font-medium">Blood</Td><Td>Vascular lumens and haemorrhagic regions</Td></tr>
            <tr><Td className="font-medium">Other</Td><Td>Unclassified tissue</Td></tr>
            <tr><Td className="font-medium">Whitespace</Td><Td>Background / empty glass</Td></tr>
          </tbody>
        </table>
      </div>

      <SubHeading title="TIL region reclassification" />
      <p>
        Before any downstream computation, regions classified as &ldquo;TILs&rdquo; by
        the tissue segmentation model are reclassified as Stroma. TIL-dense zones
        are biologically embedded within the stromal compartment (<a href="https://doi.org/10.1016/j.celrep.2018.03.086" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Saltz et al., 2018</a>),
        and treating them as a separate compartment would shrink the
        effective stromal area, inflating cell density estimates in immune-rich regions
        and creating a systematic bias in density-based features. This convention follows
        the International Immuno-Oncology Biomarker Working Group recommendation to assess
        stromal TILs as a fraction of the total stromal area (<a href="https://doi.org/10.1093/annonc/mdu450" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Salgado et al., 2015</a>).
        After reclassification,
        the effective compartments used for spatial analysis are: cancerous epithelium,
        stroma, necrosis, normal epithelium, and blood.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 5. Spatial Region Definition                                     */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="spatial-regions" number={5} title="Spatial Region Definition" />
      <p>
        Histomics features are computed within spatially defined regions (bands) that
        capture the tumour-stroma interface at biologically meaningful scales.
        Let <Eq tex="\Omega \subset \mathbb{R}^2" /> denote the full tissue domain of a
        whole-slide image, discretised on a regular pixel
        lattice at resolution <Eq tex="r = 8\;\mu\text{m/px}" />. All spatial computations
        are performed at this resolution, ensuring invariance across different TCGA scanners.
        The tissue segmentation model (§4) partitions <Eq tex="\Omega" /> into disjoint
        compartments; after TIL reclassification (§4), the effective partition is:
      </p>
      <DisplayEq tex="\Omega = \Omega_{\text{Tum}} \;\cup\; \Omega_{\text{Str}} \;\cup\; \Omega_{\text{Nec}} \;\cup\; \Omega_{\text{Epi}} \;\cup\; \Omega_{\text{Bld}} \;\cup\; \Omega_{\varnothing}" />
      <p>
        where <Eq tex="\Omega_{\text{Tum}}" /> is cancerous
        epithelium, <Eq tex="\Omega_{\text{Str}}" /> is stroma (including reclassified TIL
        regions), <Eq tex="\Omega_{\text{Nec}}" /> is
        necrosis, <Eq tex="\Omega_{\text{Epi}}" /> is normal
        epithelium, <Eq tex="\Omega_{\text{Bld}}" /> is blood,
        and <Eq tex="\Omega_{\varnothing}" /> is the union of non-tissue classes (whitespace,
        junk/debris, other) excluded from all downstream computation. The compartments are
        pairwise disjoint and their union covers <Eq tex="\Omega" />.
      </p>

      <SubHeading title="Resolution standardisation" />
      <p>
        Let <Eq tex="r_{\text{scan}}" /> denote the native resolution of a given scanner
        (in &mu;m/px). Before any spatial computation, compartment masks are resampled to the
        common lattice at <Eq tex="r = 8\;\mu\text{m/px}" /> by nearest-neighbour
        interpolation. All distance thresholds, area thresholds, and kernel sizes defined
        below are in physical units (&mu;m, &mu;m&sup2;) and are converted to pixel counts
        via <Eq tex="r" />.
      </p>

      <SubHeading title="Signed distance transform" />
      <p>
        Let <Eq tex="\partial\Omega_{\text{Tum}} = \bigl\{x \in \Omega_{\text{Tum}} : \exists\, y \in N_8(x),\; y \notin \Omega_{\text{Tum}}\bigr\}" /> denote
        the inner boundary of the tumour compartment under 8-connectivity, where <Eq tex="N_8(x)" /> is
        the set of 8-connected neighbours of pixel <Eq tex="x" /> on the lattice. The signed Euclidean distance
        transform assigns to each pixel <Eq tex="x \in \Omega" /> a
        value <Eq tex="d_T(x) \in \mathbb{R}" />:
      </p>
      <DisplayEq tex="d_T(x) = \begin{cases} +\min_{b \in \partial\Omega_{\text{Tum}}} \|x - b\|_2 & \text{if } x \in \Omega_{\text{Tum}}, \\[4pt] -\min_{b \in \partial\Omega_{\text{Tum}}} \|x - b\|_2 & \text{if } x \notin \Omega_{\text{Tum}}, \end{cases}" />
      <p>
        where <Eq tex="\|\cdot\|_2" /> is the Euclidean norm
        in <Eq tex="\mathbb{R}^2" />. In practice, <Eq tex="d_T" /> is computed using the
        exact Euclidean distance transform on the discrete pixel lattice
        (<a href="https://doi.org/10.1109/TPAMI.2003.1177156" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Maurer et al., 2003</a>), which yields the exact L2 distance from each pixel to the
        nearest boundary pixel. By
        convention, <Eq tex="d_T(x) > 0" /> inside the tumour
        and <Eq tex="d_T(x) < 0" /> outside; pixels exactly on the
        boundary satisfy <Eq tex="d_T(x) = 0" />. This transform is the basis for defining
        the four tumour-stroma bands below.
      </p>
      <p className="mt-3">
        Analogously, for
        necrosis, let <Eq tex="\partial\Omega_{\text{Nec}}" /> denote the inner boundary
        of <Eq tex="\Omega_{\text{Nec}}" /> and define the unsigned distance to the
        necrosis boundary:
      </p>
      <DisplayEq tex="d_N(x) = \min_{b \in \partial\Omega_{\text{Nec}}} \|x - b\|_2 \;\in\; [0,\, +\infty)" />

      <SubHeading title="Band definitions" />
      <p>
        Five spatial bands are defined as subsets of <Eq tex="\Omega" /> via the distance
        transforms <Eq tex="d_T" /> and <Eq tex="d_N" />. Each band is a set of pixels
        satisfying a distance predicate:
      </p>
      <DisplayEq tex="\begin{aligned} B_T^{0\text{-}50} &= \bigl\{\, x \in \Omega_{\text{Tum}} : 0 \le d_T(x) \le 50\;\mu\text{m} \,\bigr\} \\[4pt] B_T^{>50} &= \bigl\{\, x \in \Omega_{\text{Tum}} : d_T(x) > 50\;\mu\text{m} \,\bigr\} \\[4pt] B_S^{0\text{-}50} &= \bigl\{\, x \in \Omega \setminus \Omega_{\text{Tum}} : -50\;\mu\text{m} \le d_T(x) < 0 \,\bigr\} \\[4pt] B_S^{50\text{-}200} &= \bigl\{\, x \in \Omega \setminus \Omega_{\text{Tum}} : -200\;\mu\text{m} \le d_T(x) < -50\;\mu\text{m} \,\bigr\} \\[4pt] R_{\text{Nec}}^{0\text{-}100} &= \bigl\{\, x \in \Omega : d_N(x) \le 100\;\mu\text{m} \,\bigr\} \end{aligned}" />
      <p>
        The first four bands are pairwise disjoint and
        satisfy <Eq tex="B_T^{0\text{-}50} \cup B_T^{>50} \subseteq \Omega_{\text{Tum}}" /> and{' '}
        <Eq tex="B_S^{0\text{-}50} \cup B_S^{50\text{-}200} \subseteq \Omega \setminus \Omega_{\text{Tum}}" />.
        Note: the stromal bands (<Eq tex="B_S" />) include all non-tumour tissue pixels
        within the distance range, not only pixels classified as stroma. A necrotic or
        normal-epithelium pixel at <Eq tex="d_T(x) = {-}30\;\mu\text{m}" /> is included
        in <Eq tex="B_S^{0\text{-}50}" />. This convention captures the full peritumoral
        microenvironment regardless of tissue class. Cell-type-specific density features
        are then computed per band, so the tissue composition within each band is resolved
        at the feature level rather than the band definition level.
        The necrosis ring <Eq tex="R_{\text{Nec}}^{0\text{-}100}" /> may overlap
        with any of the four tumour-stroma bands.
      </p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <Th>Band</Th>
              <Th>Predicate</Th>
              <Th>Purpose</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <Td className="font-medium">Tumor front <Eq tex="B_T^{0\text{-}50}" /></Td>
              <Td><Eq tex="0 \le d_T(x) \le 50\;\mu\text{m}" /></Td>
              <Td>Invasive margin (tumour side)</Td>
            </tr>
            <tr>
              <Td className="font-medium">Tumor core <Eq tex="B_T^{>50}" /></Td>
              <Td><Eq tex="d_T(x) > 50\;\mu\text{m}" /></Td>
              <Td>Deep tumour interior</Td>
            </tr>
            <tr>
              <Td className="font-medium">Stroma near <Eq tex="B_S^{0\text{-}50}" /></Td>
              <Td><Eq tex="-50\;\mu\text{m} \le d_T(x) < 0" /></Td>
              <Td>Peritumoral stroma</Td>
            </tr>
            <tr>
              <Td className="font-medium">Stroma far <Eq tex="B_S^{50\text{-}200}" /></Td>
              <Td><Eq tex="-200\;\mu\text{m} \le d_T(x) < -50\;\mu\text{m}" /></Td>
              <Td>Extended stromal microenvironment</Td>
            </tr>
            <tr>
              <Td className="font-medium">Necrosis ring <Eq tex="R_{\text{Nec}}^{0\text{-}100}" /></Td>
              <Td><Eq tex="d_N(x) \le 100\;\mu\text{m}" /></Td>
              <Td>Perinecrotic zone</Td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading title="Island removal" />
      <p>
        Let <Eq tex="\{K_1, K_2, \dots\}" /> denote the connected components of a
        compartment <Eq tex="\Omega_{\text{comp}}" /> (where "comp"
        is Tum, Str, or Nec), computed under 8-connectivity on the pixel lattice.
        Let <Eq tex="\operatorname{Area}(K_i) = |K_i| \cdot r^2" /> denote the physical
        area of component <Eq tex="K_i" /> in &mu;m&sup2;. Components below the area
        threshold <Eq tex="A_{\min} = 2{,}048\;\mu\text{m}^2" /> are removed:
      </p>
      <DisplayEq tex="\Omega_{\text{comp}}^{\prime} = \bigcup_{\{i\,:\;\operatorname{Area}(K_i)\,\ge\, A_{\min}\}} K_i" />
      <p>
        The filtered compartments <Eq tex="\Omega_{\text{comp}}^{\prime}" /> replace the
        originals before computing the distance
        transforms <Eq tex="d_T" /> and <Eq tex="d_N" />. This prevents noisy segmentation
        fragments from producing spurious boundary pixels that would distort the distance
        transform and introduce artefactual band regions.
      </p>

      <SubHeading title="Macro-tumour mask" />
      <p>
        Let <Eq tex="\mathcal{D}_\rho" /> denote a disk structuring element of
        radius <Eq tex="\rho = 200\;\mu\text{m}" />. The macro-tumour mask is obtained by
        morphological closing of the filtered tumour
        compartment <Eq tex="\Omega_{\text{Tum}}^{\prime}" />:
      </p>
      <DisplayEq tex="\Omega_{\text{Tum}}^{\text{macro}} = \bigl(\Omega_{\text{Tum}}^{\prime} \oplus \mathcal{D}_\rho\bigr) \ominus \mathcal{D}_\rho" />
      <p>
        where <Eq tex="\oplus" /> denotes Minkowski dilation
        and <Eq tex="\ominus" /> Minkowski erosion. The closing bridges gaps
        smaller than <Eq tex="2\rho = 400\;\mu\text{m}" /> in infiltrative tumours where
        thin stromal septa fragment the tumour region. The macro-tumour mask is used
        exclusively for the quality-control
        metric <Code>micro_interface_ratio</Code>, not for primary feature computation.
      </p>

      <SubHeading title="Growth pattern classification" />
      <p>
        Slides are classified into growth pattern regimes based on the front
        fraction <Eq tex="\phi \in [0,\,1]" />, defined as the ratio of tumour-front area
        to total tumour area:
      </p>
      <DisplayEq tex="\phi = \frac{|B_T^{0\text{-}50}|}{|B_T^{0\text{-}50}| + |B_T^{>50}|}  = \frac{\operatorname{Area}\!\bigl(B_T^{0\text{-}50}\bigr)}{\operatorname{Area}\!\bigl(\Omega_{\text{Tum}}^{\prime}\bigr)}" />
      <p>
        where <Eq tex="|\cdot|" /> denotes pixel count (proportional to physical area
        at fixed <Eq tex="r" />). Growth pattern regimes:
      </p>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li>
          <strong>Mass-forming</strong> (<Eq tex="\phi \le 0.5" />): compact tumour with
          a small invasive margin relative to total area
        </li>
        <li>
          <strong>Intermediate</strong> (<Eq tex="0.5 < \phi \le 0.8" />): mixed growth
          pattern
        </li>
        <li>
          <strong>Infiltrative</strong> (<Eq tex="\phi > 0.8" />): highly dispersed tumour
          with most tumour area near the stromal interface
        </li>
      </ul>
      <p className="mt-3">
        The same features are computed for all slides regardless of growth pattern; the
        regime label aids interpretation of spatial features and is not used as a filter.
      </p>

      <SubHeading title="Design rationale" />
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li>
          <strong>50&nbsp;&mu;m front band</strong>: approximately 5 cell diameters
          (typical epithelial cell diameter &asymp; 10&nbsp;&mu;m), capturing the invasive
          margin zone where tumour-stroma interactions are most active
        </li>
        <li>
          <strong>200&nbsp;&mu;m stroma far cutoff</strong>: beyond this distance,
          tumour-stroma interaction effects attenuate, as shown by spatial analyses of
          immune cell infiltration gradients (<a href="https://doi.org/10.1016/j.celrep.2018.03.086" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Saltz et al., 2018</a>; <a href="https://doi.org/10.1016/j.cell.2018.08.039" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Keren et al., 2018</a>)
        </li>
        <li>
          <strong><Eq tex="r = 8\;\mu\text{m/px}" /> resolution</strong>: balances spatial
          precision with computational tractability and is invariant across TCGA scanner
          platforms
        </li>
        <li>
          <strong><Eq tex="A_{\min} = 2{,}048\;\mu\text{m}^2" /> island threshold</strong>:
          corresponds to <Eq tex="\approx 32" /> pixels at <Eq tex="r = 8\;\mu\text{m/px}" />,
          removing objects smaller than a single cell cluster
        </li>
        <li>
          <strong>Identical parameters for all 24 cancer types</strong>: ensures
          cross-cancer comparability of all histomics features
        </li>
      </ul>

      {/* ============================================================= */}
      {/*  PART B: STATISTICAL METHODS                                    */}
      {/* ============================================================= */}
      <PartDivider label="Statistical Methods" />

      {/* --------------------------------------------------------------- */}
      {/* 6. Feature Preprocessing                                         */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="preprocessing" number={6} title="Feature Preprocessing" />
      <p>
        Let <Eq tex="\mathbf{X} \in \mathbb{R}^{n \times p}" /> denote the raw feature matrix,
        where <Eq tex="n" /> is the number of samples and <Eq tex="p = 40" /> is the number of
        morphological features. Each sample belongs to exactly one cancer
        type <Eq tex="c \in \{1, \dots, C\}" />; we
        write <Eq tex="\mathbf{X}_c \in \mathbb{R}^{n_c \times p}" /> for the submatrix of
        samples of type <Eq tex="c" />, with <Eq tex="\sum_c n_c = n" />. Log-transformation
        and winsorisation are applied to the full dataset; z-score standardisation is applied
        differently depending on the downstream consumer (see Standardisation below).
      </p>
      <p className="mt-3">
        This preprocessing is applied exclusively for statistical modelling and
        embedding computation (UMAP, K-means clustering, Cox regression, RMST,
        Spearman correlations, and categorical association tests). Feature values
        displayed in tables and tooltips throughout the platform are the
        raw entries of <Eq tex="\mathbf{X}" />; winsorisation, log-transformation, and
        standardisation are never applied to displayed data.
      </p>

      <SubHeading title="Log transformation" />
      <p>
        Let <Eq tex="\mathcal{L} \subset \{1, \dots, p\}" /> with <Eq tex="|\mathcal{L}| = 22" /> denote
        the index set of right-skewed features (densities, ratios, heterogeneity
        measures). For each feature <Eq tex="j \in \mathcal{L}" /> and
        sample <Eq tex="i \in \{1, \dots, n\}" />, we apply the <Eq tex="\log(1+x)" /> transform
        to stabilise variance and attenuate the influence of extreme values:
      </p>
      <DisplayEq tex="x_{ij}^{(1)} = \begin{cases} \log(1 + x_{ij}) & \text{if } j \in \mathcal{L}, \\ x_{ij} & \text{otherwise.} \end{cases}" />
      <p>
        The remaining <Eq tex="p - |\mathcal{L}| = 18" /> features, which are approximately
        symmetric, are left unchanged. The full list of log-transformed features is defined
        in the preprocessing configuration.
      </p>

      <SubHeading title="Winsorisation" />
      <p>
        To limit the influence of outliers, all <Eq tex="p" /> features are winsorised
        at the 0.5th and 99.5th percentiles across the full dataset.
        Let <Eq tex="Q_j(\alpha)" /> denote
        the <Eq tex="\alpha" />-quantile of feature <Eq tex="j" /> computed over
        all <Eq tex="n" /> samples (after the log-transformation step). The winsorised
        values are:
      </p>
      <DisplayEq tex="x_{ij}^{(2)} = \operatorname{clip}\!\bigl(x_{ij}^{(1)},\; Q_j(0.005),\; Q_j(0.995)\bigr)" />
      <p>
        where <Eq tex="\operatorname{clip}(v, a, b) = \min\!\bigl(\max(v, a),\, b\bigr)" />.
        The two global preprocessing steps are applied in order: (1) log-transformation on
        the <Eq tex="|\mathcal{L}|" /> right-skewed features, (2) winsorisation at the 0.5th
        and 99.5th percentiles. Z-score standardisation, when applied, occurs downstream
        and its scope depends on the analysis (see below).
      </p>

      <SubHeading title="Standardisation" />
      <p>
        Z-score standardisation is applied differently depending on the downstream analysis.
        Let <Eq tex="\hat{\mu}_j^{(\cdot)}" /> and <Eq tex="\hat{\sigma}_j^{(\cdot)}" /> denote
        the sample mean and standard deviation of the winsorised
        feature <Eq tex="j" /> computed over a reference set of samples (specified below):
      </p>
      <DisplayEq tex="z_{ij} = \frac{x_{ij}^{(2)} - \hat{\mu}_j^{(\cdot)}}{\hat{\sigma}_j^{(\cdot)}}" />
      <p>
        The scope of standardisation varies by consumer:
      </p>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li>
          <strong>Embeddings and clustering (§7, §8):</strong> global standardisation across
          all <Eq tex="n" /> samples, yielding the
          matrix <Eq tex="\mathbf{Z} \in \mathbb{R}^{n \times p}" /> with column-wise zero mean
          and unit variance over the full cohort. This ensures that embedding distances and
          cluster assignments are comparable across cancer types.
        </li>
        <li>
          <strong>Cox regression (§9):</strong> per-cancer-type standardisation at analysis time.
          For each cancer type <Eq tex="c" />, features are standardised to zero mean and unit
          variance within the <Eq tex="n_c" /> samples of that cancer type. This ensures that
          hazard ratios are interpretable as per-standard-deviation effects within each cancer type.
        </li>
        <li>
          <strong>Spearman correlations (§10):</strong> no z-score standardisation is applied.
          Spearman's rank correlation operates on ranks of the preprocessed (log-transformed and
          winsorised) values; the rank transformation is the natural standardisation for
          rank-based methods.
        </li>
      </ul>

      {/* --------------------------------------------------------------- */}
      {/* 7. Dimensionality Reduction                                      */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="dimensionality-reduction" number={7} title="Dimensionality Reduction" />
      <p>
        Two-dimensional embeddings are computed for interactive visualisation.
        The input is the preprocessed feature matrix from §6 (log-transformed and winsorised).
        Because some entries may be missing, we first impute each
        missing value with the column median of the corresponding feature across
        all <Eq tex="n" /> samples, then apply global z-score standardisation (§6), yielding
        the complete
        matrix <Eq tex="\tilde{\mathbf{Z}} \in \mathbb{R}^{n \times p}" /> (column-wise zero
        mean, unit variance over the full cohort).
      </p>

      <SubHeading title="UMAP" />
      <p>
        Uniform Manifold Approximation and Projection (UMAP; <a href="https://arxiv.org/abs/1802.03426" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">McInnes et al., 2018</a>) computes a
        map <Eq tex="f \colon \mathbb{R}^{p} \to \mathbb{R}^{2}" /> that approximately preserves
        local neighbourhood structure. Applied row-wise
        to <Eq tex="\tilde{\mathbf{Z}}" />, it produces the embedding matrix:
      </p>
      <DisplayEq tex="\mathbf{E} = f\!\bigl(\tilde{\mathbf{Z}}\bigr) \in \mathbb{R}^{n \times 2}" />
      <p>
        where <Eq tex="\mathbf{E}" /> contains the two-dimensional coordinates used for scatter-plot
        visualisation. Hyperparameters are set
        to <Code>n_neighbors=15</Code>, <Code>min_dist=0.1</Code>, with Euclidean distance in the
        ambient space <Eq tex="\mathbb{R}^{p}" />. These balance local neighbourhood preservation
        with global structure visibility. A fixed random
        seed (<Code>random_state=42</Code>) ensures reproducibility.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 8. Clustering and Stability Assessment                           */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="clustering" number={8} title="Clustering and Stability Assessment" />

      <SubHeading title="K-means clustering" />
      <p>
        Samples are clustered using K-means on the imputed, re-standardised
        matrix <Eq tex="\tilde{\mathbf{Z}}_c \in \mathbb{R}^{n_c \times p}" /> from §7. K-means
        seeks a partition <Eq tex="\{C_1, \dots, C_k\}" /> of
        the <Eq tex="n_c" /> samples and a set of
        centroids <Eq tex="\boldsymbol{\mu}_1, \dots, \boldsymbol{\mu}_k \in \mathbb{R}^{p}" /> that
        minimise the within-cluster sum of squares (inertia):
      </p>
      <DisplayEq tex="W(k) = \sum_{\ell=1}^{k} \sum_{i \in C_\ell} \bigl\|\tilde{\mathbf{z}}_i - \boldsymbol{\mu}_\ell\bigr\|_2^2" />
      <p>
        where <Eq tex="\tilde{\mathbf{z}}_i \in \mathbb{R}^{p}" /> is the <Eq tex="i" />-th
        row of <Eq tex="\tilde{\mathbf{Z}}_c" />. The algorithm is run with 10 random
        initialisations (<Code>n_init=10</Code>), retaining the partition that
        achieves the smallest <Eq tex="W(k)" />.
      </p>

      <SubHeading title="Hierarchical cluster levels" />
      <p>
        Two levels of clustering granularity are provided. <strong>L1 (coarse)</strong> is
        computed at fixed <Eq tex="k" /> values (5, 10, 15, 20)
        with <Eq tex="k = 10" /> selected for downstream analysis based on silhouette
        analysis as a balance between granularity and interpretability.{' '}
        <strong>L2 (fine, cancer-specific)</strong> uses the elbow method to select the
        optimal <Eq tex="k" /> within the range <Eq tex="[2,\, 8]" />. Both <Eq tex="k" /> and{' '}
        <Eq tex="W(k)" /> are min-max normalised to <Eq tex="[0,\,1]" />, and
        the optimal <Eq tex="k" /> is the value that maximises the perpendicular distance from
        the point <Eq tex="(k,\, W(k))" /> to the line segment connecting the endpoints{' '}
        <Eq tex="(2,\, W(2))" /> and <Eq tex="(8,\, W(8))" /> in the normalised plane.
        This hierarchy allows users to explore broad morphological groupings or finer-grained
        subtypes.
      </p>

      <SubHeading title="Bootstrap stability assessment" />
      <p>
        Cluster stability is assessed via bootstrap resampling (50 iterations, 80% subsample
        without replacement). For each bootstrap replicate <Eq tex="b" />, K-means is re-run to
        obtain a bootstrap partition <Eq tex="\{C'_1, \dots, C'_k\}" />, which is compared to
        the full-data partition <Eq tex="\{C_1, \dots, C_k\}" /> using two metrics:
      </p>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li>
          <strong>Adjusted Rand Index (ARI)</strong>: the chance-corrected Rand index measuring
          overall partition agreement. ARI = 1 indicates perfect agreement; ARI = 0
          corresponds to the expected value under random assignment.
        </li>
        <li>
          <strong>Jaccard similarity</strong>: computed per cluster <Eq tex="\ell" /> as the
          overlap with its best-matching bootstrap
          cluster <Eq tex="C'_m" />:
          <DisplayEq tex="J_\ell = \max_{m} \frac{|C_\ell \cap C'_m|}{|C_\ell \cup C'_m|}" />
          capturing per-cluster recovery on a <Eq tex="[0,\,1]" /> scale.
        </li>
      </ul>

      <SubHeading title="Validation metrics" />
      <p>
        Internal cluster quality is quantified using three complementary metrics.
      </p>
      <p className="mt-3">
        <strong>Silhouette score.</strong> For each
        sample <Eq tex="i" />, let <Eq tex="a_i" /> be the mean distance to all other samples
        in the same cluster, and <Eq tex="b_i" /> the mean distance to samples in the nearest
        neighbouring cluster. The silhouette coefficient is:
      </p>
      <DisplayEq tex="s_i = \frac{b_i - a_i}{\max(a_i,\, b_i)} \in [-1,\, 1]" />
      <p>
        The overall silhouette score is <Eq tex="\bar{s} = n_c^{-1}\sum_{i=1}^{n_c} s_i" />.
      </p>
      <p className="mt-3">
        <strong>Calinski-Harabasz (CH) index.</strong> Let{' '}
        <Eq tex="B = \sum_{\ell=1}^{k} |C_\ell|\,\|\boldsymbol{\mu}_\ell - \bar{\mathbf{z}}\|_2^2" /> be
        the between-cluster dispersion,
        where <Eq tex="\bar{\mathbf{z}} = n_c^{-1}\sum_i \tilde{\mathbf{z}}_i" /> is the global
        centroid. Then:
      </p>
      <DisplayEq tex="\text{CH} = \frac{B\,/\,(k - 1)}{W(k)\,/\,(n_c - k)}" />
      <p>
        Higher CH indicates more compact, well-separated clusters.
      </p>
      <p className="mt-3">
        <strong>Davies-Bouldin (DB) index.</strong> Let <Eq tex="\sigma_\ell" /> be the mean
        intra-cluster distance in cluster <Eq tex="\ell" /> and{' '}
        <Eq tex="d_{\ell m} = \|\boldsymbol{\mu}_\ell - \boldsymbol{\mu}_m\|_2" /> the
        inter-centroid distance. Then:
      </p>
      <DisplayEq tex="\text{DB} = \frac{1}{k}\sum_{\ell=1}^{k} \max_{m \neq \ell} \frac{\sigma_\ell + \sigma_m}{d_{\ell m}}" />
      <p>
        Lower DB indicates better cluster separation. These three metrics are reported
        alongside stability results to provide a comprehensive assessment of clustering quality.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 9. Survival Analysis                                             */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="survival" number={9} title="Survival Analysis" />

      <SubHeading title="Cox proportional hazards regression" />
      <p>
        The association between each morphological feature <Eq tex="j" /> and time-to-event
        outcomes is estimated using Cox proportional hazards regression.
        For sample <Eq tex="i" />, define the covariate
        vector <Eq tex="\mathbf{x}_i = (z_{ij},\, w_{i1},\, \dots,\, w_{iq})^{\!\top} \in \mathbb{R}^{q+1}" />,
        where <Eq tex="z_{ij}" /> is the feature value standardised to zero mean and unit
        variance within cancer type <Eq tex="c" /> at analysis time (per-cancer-type
        standardisation, §6) and <Eq tex="w_{i1}, \dots, w_{iq}" /> are the confounding covariates defined in
        §16 (the number of covariates <Eq tex="q" /> depends on the adjustment model: <Eq tex="q = 0" /> for
        unadjusted, <Eq tex="q = 3" /> for adjusted [age, sex, stage]; TSS is handled via stratification, not as a covariate). The
        Cox model specifies the hazard function as:
      </p>
      <DisplayEq tex="h(t \mid \mathbf{x}_i) = h_0(t)\,\exp\!\bigl(\beta_1\, z_{ij} + \boldsymbol{\beta}_{\text{cov}}^{\!\top}\, \mathbf{w}_i\bigr)" />
      <p>
        where <Eq tex="h_0(t)" /> is the unspecified baseline hazard, <Eq tex="\beta_1 \in \mathbb{R}" /> is
        the coefficient for the morphological feature, and{' '}
        <Eq tex="\boldsymbol{\beta}_{\text{cov}} \in \mathbb{R}^{q}" /> is the vector of
        covariate coefficients. Models are fit by partial-likelihood maximisation using
        the <Code>lifelines</Code> library with no L2 penalisation (<Code>penalizer=0.0</Code>).
        The hazard ratio for feature <Eq tex="j" /> is:
      </p>
      <DisplayEq tex="\text{HR}_j = \exp(\hat{\beta}_1)" />
      <p>
        with 95% Wald confidence interval:
      </p>
      <DisplayEq tex="\exp\!\Bigl(\hat{\beta}_1 \pm \Phi^{-1}(0.975)\;\text{SE}(\hat{\beta}_1)\Bigr)" />
      <p>
        where <Eq tex="\Phi^{-1}" /> is the standard normal quantile function
        (<Eq tex="\Phi^{-1}(0.975) \approx 1.96" />)
        and <Eq tex="\text{SE}(\hat{\beta}_1)" /> is the standard error derived from the
        observed Fisher information matrix. Two-sided Wald p-values
        test <Eq tex="H_0\colon \beta_1 = 0" />. Since features are standardised within cancer
        type, hazard ratios are interpretable as the multiplicative change in hazard per one
        standard deviation increase in the feature.
      </p>

      <SubHeading title="Proportional hazards assumption" />
      <p>
        The proportional hazards assumption is tested for each model using the Schoenfeld
        residual test with the Kaplan-Meier time transform. The resulting p-value determines
        a three-level flag:
      </p>
      <PHViolationTable />
      <p>
        When the PH assumption is violated (<Code>fail</Code>), the restricted mean survival
        time (RMST) difference is reported as the primary effect measure instead of the
        hazard ratio.
      </p>

      <SubHeading title="Restricted mean survival time (RMST)" />
      <p>
        RMST provides a clinically interpretable, assumption-free measure of survival
        benefit. Let <Eq tex="t_1 < t_2 < \cdots < t_m" /> be the ordered distinct event
        times, <Eq tex="d_i" /> the number of events at <Eq tex="t_i" />,
        and <Eq tex="n_i" /> the number at risk just before <Eq tex="t_i" />. The Kaplan-Meier
        estimator of the survival function is:
      </p>
      <DisplayEq tex="\hat{S}(t) = \prod_{t_i \le t} \left(1 - \frac{d_i}{n_i}\right)" />
      <p>
        The RMST at restriction time <Eq tex="\tau" /> is defined as the area under
        the Kaplan-Meier curve:
      </p>
      <DisplayEq tex="\hat{\mu}(\tau) = \int_0^\tau \hat{S}(t)\,dt" />
      <p>
        The variance is estimated using the Irwin (1949) formula:
      </p>
      <DisplayEq tex="\widehat{\text{Var}}\!\bigl(\hat{\mu}(\tau)\bigr) = \sum_{t_i \le \tau} \frac{d_i}{n_i(n_i - d_i)} \left[\int_{t_i}^\tau \hat{S}(u)\,du\right]^2" />
      <p className="mt-3">
        The restriction time <Eq tex="\tau" /> is set to 1,095 days (3 years) by default, with
        cancer-specific overrides for aggressive tumours (730 days for GBM, PAAD, MESO) and
        indolent tumours (1,825 days for LGG, THCA, PRAD). These horizons are chosen to ensure
        adequate follow-up and event counts within each cancer type.
      </p>
      <p className="mt-3">
        Samples are split into two groups by the median of feature <Eq tex="z_{ij}" />:
        group <Eq tex="G_1 = \{i : z_{ij} > \text{median}(z_{\cdot j})\}" /> (above
        median) and <Eq tex="G_0" /> (at-or-below median). The RMST difference is:
      </p>
      <DisplayEq tex="\Delta\hat{\mu}(\tau) = \hat{\mu}_{G_1}(\tau) - \hat{\mu}_{G_0}(\tau)" />
      <p>
        95% confidence intervals for <Eq tex="\Delta\hat{\mu}(\tau)" /> are obtained
        by bootstrap percentile method (1,000 resamples). Statistical significance is assessed
        via two-sided permutation test (5,000 permutations), where the p-value is the proportion
        of null differences with absolute value at least as large as the observed difference.
      </p>

      <SubHeading title="Kaplan-Meier curves" />
      <p>
        For visualisation, continuous features are dichotomised at the median (or split into
        quartiles) to produce Kaplan-Meier survival curves. These serve as visual summaries
        and are not used for formal inference.
      </p>

      <SubHeading title="Sample size requirements" />
      <p>
        Cox models require a minimum of <Eq tex="n \ge 30" /> subjects with at least 10
        observed events. RMST analyses require <Eq tex="n \ge 20" /> subjects with at least
        5 per group. Analyses not meeting these thresholds are excluded and flagged as having
        insufficient data.
      </p>

      <SubHeading title="Cluster-level survival comparisons" />
      <p>
        For cluster-level survival comparisons, a two-sided log-rank test is computed between
        cluster members and non-members, with Benjamini-Hochberg correction applied within each
        cluster level, analysis type, cancer type, and endpoint.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 10. Continuous Association Analysis                                */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="continuous-associations" number={10} title="Continuous Association Analysis" />

      <SubHeading title="Spearman rank correlation" />
      <p>
        Associations between morphological features and continuous molecular variables are
        quantified using Spearman's rank correlation coefficient. Let{' '}
        <Eq tex="\mathbf{x} = (x_1, \dots, x_n)^{\!\top} \in \mathbb{R}^{n}" /> be the
        vector of preprocessed feature values (log-transformed and winsorised per §6) and{' '}
        <Eq tex="\mathbf{y} = (y_1, \dots, y_n)^{\!\top} \in \mathbb{R}^{n}" /> the vector
        of molecular target values for the <Eq tex="n" /> samples in a given cancer type.
        Define the rank operator <Eq tex="R(\cdot)" /> that replaces each value by its rank
        among the <Eq tex="n" /> entries, with tied values receiving the average of their
        ranks. Spearman's rank correlation is:
      </p>
      <DisplayEq tex="r_s = r_{\text{Pearson}}\!\bigl(R(\mathbf{x}),\, R(\mathbf{y})\bigr) \in [-1,\, 1]" />
      <p>
        Spearman's <Eq tex="r_s" /> is robust to non-linear monotonic relationships and
        is not sensitive to the distributional assumptions that limit Pearson's <Eq tex="r" />.
      </p>

      <SubHeading title="Partial Spearman correlation" />
      <p>
        To control for confounders, partial Spearman correlations are computed using
        residualisation. Let{' '}
        <Eq tex="\mathbf{W} \in \mathbb{R}^{n \times q}" /> denote the covariate matrix
        (§16). All variables are first rank-transformed: <Eq tex="\mathbf{r}_x = R(\mathbf{x})" />,{' '}
        <Eq tex="\mathbf{r}_y = R(\mathbf{y})" />, and each column of <Eq tex="\mathbf{W}" /> is
        likewise replaced by its ranks. OLS residuals are then computed:
      </p>
      <DisplayEq tex="\boldsymbol{\varepsilon}_x = \mathbf{r}_x - \mathbf{W}(\mathbf{W}^{\!\top}\mathbf{W})^{-1}\mathbf{W}^{\!\top}\,\mathbf{r}_x, \qquad \boldsymbol{\varepsilon}_y = \mathbf{r}_y - \mathbf{W}(\mathbf{W}^{\!\top}\mathbf{W})^{-1}\mathbf{W}^{\!\top}\,\mathbf{r}_y" />
      <p>
        The partial Spearman correlation is the Pearson correlation of these residuals:
      </p>
      <DisplayEq tex="r_{s,\text{partial}} = r_{\text{Pearson}}(\boldsymbol{\varepsilon}_x,\, \boldsymbol{\varepsilon}_y)" />
      <SubHeading title="Inference" />
      <p>
        P-values for both unadjusted and partial Spearman correlations are computed using
        the standard <Eq tex="t" />-test:{' '}
        <Eq tex="t = r\sqrt{\mathrm{df}/(1 - r^2)}" /> with{' '}
        <Eq tex="\mathrm{df} = n - 2 - k" />, where <Eq tex="k" /> is the number of covariate
        columns after one-hot encoding (<Eq tex="k = 0" /> for unadjusted). The two-sided
        P-value is obtained from the <Eq tex="t(\mathrm{df})" /> distribution. 95% confidence
        intervals for <Eq tex="r_s" /> are obtained by bootstrap percentile method (1,000
        resamples).
      </p>

      <SubHeading title="Fisher z-transform for MDES" />
      <p>
        For power calculations (§14), the Fisher z-transform variance-stabilises the
        correlation coefficient:
      </p>
      <DisplayEq tex="z_F = \operatorname{artanh}(r_s) = \tfrac{1}{2}\ln\!\left(\frac{1 + r_s}{1 - r_s}\right)" />
      <p>
        Under <Eq tex="H_0\colon r_s = 0" />, the standard error of <Eq tex="z_F" /> is:
      </p>
      <DisplayEq tex="\text{SE}(z_F) = \frac{1}{\sqrt{n - q - 3}}" />
      <p>
        where <Eq tex="n" /> is the sample size and <Eq tex="q" /> is the number of
        covariates in the partial model. The inverse
        transform <Eq tex="\tanh(\cdot)" /> maps back to the
        correlation scale (used in §14 for MDES computation).
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 11. Categorical Association Analysis                               */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="categorical-associations" number={11} title="Categorical Association Analysis" />

      <SubHeading title="Two-group comparisons" />
      <p>
        For binary categorical variables (e.g., mutation status), the Mann-Whitney U test
        is used with a two-sided alternative. Let{' '}
        <Eq tex="\mathbf{a} = (a_1, \dots, a_m)^{\!\top}" /> and{' '}
        <Eq tex="\mathbf{b} = (b_1, \dots, b_{m'})^{\!\top}" /> be the preprocessed feature
        values in group 0 and group 1 respectively, with group
        sizes <Eq tex="m" /> and <Eq tex="m'" />. The effect size is quantified by Cliff's
        delta:
      </p>
      <DisplayEq tex="\delta = \frac{1}{m\,m'}\sum_{i=1}^{m}\sum_{j=1}^{m'} \operatorname{sgn}(a_i - b_j)" />
      <p>
        where <Eq tex="\operatorname{sgn}(u) = \mathbb{1}[u > 0] - \mathbb{1}[u < 0]" /> is
        the sign function. Cliff's <Eq tex="\delta \in [-1,\, +1]" />, with 0 indicating no
        stochastic dominance. 95% confidence intervals are obtained by bootstrap percentile
        method (1,000 resamples).
      </p>

      <SubHeading title="Multi-group comparisons" />
      <p>
        For categorical variables with <Eq tex="k \ge 3" /> levels, the Kruskal-Wallis H test
        (omnibus, non-directional) is used. Let <Eq tex="n = \sum_{\ell=1}^{k} n_\ell" /> be
        the total sample size and <Eq tex="R_\ell = \sum_{i \in C_\ell} R_i" /> the rank sum
        for group <Eq tex="\ell" />, where <Eq tex="R_i" /> is the rank
        of sample <Eq tex="i" /> among all <Eq tex="n" /> observations. The Kruskal-Wallis
        statistic is:
      </p>
      <DisplayEq tex="H = \frac{12}{n(n+1)}\sum_{\ell=1}^{k}\frac{R_\ell^2}{n_\ell} - 3(n+1)" />
      <p>
        The effect size is reported as the bias-corrected epsilon-squared (labelled{' '}
        <Eq tex="\eta^2" /> in the platform for brevity), with 95% bootstrap percentile
        confidence intervals (1,000 resamples):
      </p>
      <DisplayEq tex="\varepsilon^2 = \frac{H - k + 1}{n - k}" />
      <p className="mt-3">
        For the unadjusted model, inference uses the exact or asymptotic distribution of
        the test statistic (Mann-Whitney U or Kruskal-Wallis H) as implemented
        in <Code>scipy.stats</Code>. Freedman-Lane permutation testing is used only for
        the covariate-adjusted models described below.
      </p>

      <SubHeading title="Covariate-adjusted tests (rank-ANCOVA)" />
      <p>
        For adjusted models, a rank-based ANCOVA is performed using Freedman-Lane
        permutation (1,000 permutations). Let <Eq tex="\mathbf{r}_y \in \mathbb{R}^n" /> be
        the vector of rank-transformed feature values, <Eq tex="\mathbf{G} \in \{0,1\}^{n \times k}" /> the
        group indicator matrix, and <Eq tex="\mathbf{R}_W" /> the rank-transformed covariate
        matrix. Define the full and reduced OLS models:
      </p>
      <DisplayEq tex="\text{Full:}\;\; \mathbf{r}_y \sim \mathbf{1} + \mathbf{G} + \mathbf{R}_W, \qquad \text{Reduced:}\;\; \mathbf{r}_y \sim \mathbf{1} + \mathbf{R}_W" />
      <p>
        Let <Eq tex="\text{SS}_{\text{resid,full}}" /> and <Eq tex="\text{SS}_{\text{resid,red}}" /> be
        the residual sums of squares from the full and reduced models respectively.
        The group sum of squares and F-statistic are:
      </p>
      <DisplayEq tex="\text{SS}_{\text{group}} = \text{SS}_{\text{resid,red}} - \text{SS}_{\text{resid,full}}" />
      <DisplayEq tex="F = \frac{\text{SS}_{\text{group}}\,/\,(k - 1)}{\text{SS}_{\text{resid,full}}\,/\,(n - k - q)}" />
      <p>
        where <Eq tex="q" /> is the number of covariates. The partial eta-squared is:
      </p>
      <DisplayEq tex="\eta_p^2 = \frac{\text{SS}_{\text{group}}}{\text{SS}_{\text{group}} + \text{SS}_{\text{resid,full}}}" />
      <p>
        The Freedman-Lane procedure residualises <Eq tex="\mathbf{r}_y" /> on the covariates,
        then permutes these residuals to generate the null distribution
        of <Eq tex="F" />. The permutation p-value is the proportion of
        null <Eq tex="F" />-statistics at least as large as the observed value.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 12. Gene Set Enrichment Analysis                                   */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="gsea" number={12} title="Gene Set Enrichment Analysis" />
      <p>
        Gene Set Enrichment Analysis (GSEA) is performed to identify molecular pathways
        enriched in morphologically defined clusters, following the method of <a href="https://doi.org/10.1073/pnas.0506580102" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Subramanian
        et al. (2005)</a>. Enrichment is computed against MSigDB Hallmark gene sets (<a href="https://doi.org/10.1016/j.cels.2015.12.004" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Liberzon
        et al., 2015</a>) using the full TCGA Pan-Cancer batch-corrected transcriptome
        (~20,500 genes per sample). Gene sets with fewer than 10 genes after
        intersection with the expression matrix are excluded from analysis.
      </p>

      <SubHeading title="Ranking metric" />
      <p>
        Genes are ranked by Welch's t-statistic (unequal variance) comparing expression
        in cluster members versus non-members. Welch's t is used rather than the standard
        t-test to account for potentially unequal group variances that arise from unbalanced
        cluster sizes.
      </p>

      <SubHeading title="Enrichment score and normalisation" />
      <p>
        Let the <Eq tex="N" /> genes be ordered by decreasing Welch's{' '}
        <Eq tex="t" />-statistic: <Eq tex="t_{(1)} \ge t_{(2)} \ge \cdots \ge t_{(N)}" />.
        For a gene set <Eq tex="\mathcal{H}" /> of size <Eq tex="N_h = |\mathcal{H}|" />, define
        the running sum at position <Eq tex="j \in \{1, \dots, N\}" /> using the weighted
        scheme (<Eq tex="p = 1" />) from the original GSEA method:
      </p>
      <DisplayEq tex="\text{RS}(j) = \sum_{i=1}^{j} \begin{cases} \dfrac{|t_{(i)}|}{\sum_{\ell:\,\text{gene}_\ell \in \mathcal{H}} |t_{(\ell)}|} & \text{if gene } i \in \mathcal{H}, \\[6pt] -\dfrac{1}{N - N_h} & \text{otherwise.} \end{cases}" />
      <p>
        The enrichment score is the value of the running sum with maximum absolute deviation
        from zero:
      </p>
      <DisplayEq tex="\text{ES} = \begin{cases} \max_j\,\text{RS}(j) & \text{if } |\max_j \text{RS}(j)| \ge |\min_j \text{RS}(j)|, \\ \min_j\,\text{RS}(j) & \text{otherwise.} \end{cases}" />
      <p>
        To account for gene set size, the normalised enrichment score
        (NES) is computed by dividing the observed ES by the mean absolute null ES,
        separately for positive and negative enrichments:
      </p>
      <DisplayEq tex="\text{NES} = \begin{cases} \text{ES}\;/\;\overline{|\text{ES}_{\text{null}}^{+}|} & \text{if } \text{ES} \ge 0, \\ \text{ES}\;/\;\overline{|\text{ES}_{\text{null}}^{-}|} & \text{if } \text{ES} < 0, \end{cases}" />
      <p>
        where <Eq tex="\text{ES}_{\text{null}}^{+}" /> and <Eq tex="\text{ES}_{\text{null}}^{-}" /> denote
        the positive and negative enrichment scores from the permutation null distribution,
        respectively.
      </p>

      <SubHeading title="Significance" />
      <p>
        Null distributions are generated by permuting phenotype labels (2,000 permutations).
        False discovery rates are estimated using a pooled null NES distribution across all
        gene sets. Gene sets with FDR <Eq tex="q < 0.25" /> are reported as significant,
        following the conventional GSEA threshold.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 13. Multiple Testing Correction                                   */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="multiple-testing" number={13} title="Multiple Testing Correction" />
      <p>
        All p-values are corrected for multiple testing using the Benjamini-Hochberg (BH)
        procedure to control the false discovery rate (FDR) at &alpha; = 0.05. Correction is applied within
        defined families of tests to balance statistical power against false positive
        control:
      </p>
      <CorrectionFamilyTable />
      <p>
        Each result stores its <Code>correction_family_id</Code> and{' '}
        <Code>n_tests_in_family</Code> for full transparency. The family definitions
        ensure that biologically related comparisons (e.g., all features tested against
        the same endpoint within one cancer type and model) share a correction burden,
        while unrelated comparisons across cancer types or analysis modalities do not
        inflate each other's thresholds.
      </p>
      <p className="mt-3">
        Permutation p-values (RMST, rank-ANCOVA) use the add-one
        correction of <a href="https://www.degruyterbrill.com/document/doi/10.2202/1544-6115.1585/html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Phipson &amp; Smyth (2010)</a>: <Eq tex="p = (B^+ + 1)/(B + 1)" />,
        where <Eq tex="B^+" /> is the count of null statistics at least as extreme as the
        observed value and <Eq tex="B" /> is the number of valid permutations. This prevents
        p-values of exactly zero and provides a conservative estimate.
      </p>
      <p className="mt-3">
        GSEA uses its own canonical FDR procedure based on pooled null NES distributions,
        as described in the original method (<a href="https://doi.org/10.1073/pnas.0506580102" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Subramanian et al., 2005</a>), rather than BH
        correction.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 14. Statistical Power and MDES                                    */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="mdes" number={14} title="Statistical Power and Minimum Detectable Effect Sizes" />
      <p>
        For each analysis, HistoAtlas computes the minimum detectable effect size (MDES) at
        80% power and <Eq tex="\alpha = 0.05" /> (two-sided). The MDES contextualises
        observed results: a non-significant finding is more informative when the study was
        well-powered to detect small effects.
      </p>

      <SubHeading title="Cox regression (Schoenfeld-Freedman)" />
      <p>
        Let <Eq tex="\Phi^{-1}" /> denote the standard normal quantile function,
        with <Eq tex="\Phi^{-1}(1 - \alpha/2)" /> the two-sided significance
        quantile and <Eq tex="\Phi^{-1}(1 - \beta)" /> the power quantile. At the
        defaults <Eq tex="\alpha = 0.05" />, <Eq tex="\beta = 0.20" /> (80% power):
      </p>
      <DisplayEq tex="\Phi^{-1}(0.975) \approx 1.96, \qquad \Phi^{-1}(0.80) \approx 0.84" />
      <p>
        For Cox models, the variance of the log-hazard-ratio estimator under the
        Schoenfeld (1982) approximation with worst-case binary
        allocation (<Eq tex="\pi(1 - \pi) = 1/4" />) is:
      </p>
      <DisplayEq tex="\text{Var}(\hat{\beta}_1) \approx \frac{1}{D\,\pi(1-\pi)} = \frac{4}{D}" />
      <p>
        where <Eq tex="D" /> is the number of observed events. The MDES on the hazard ratio
        scale is then:
      </p>
      <DisplayEq tex="\text{MDES}_{\text{HR}} = \exp\!\left(\bigl[\Phi^{-1}(1 - \alpha/2) + \Phi^{-1}(1 - \beta)\bigr] \cdot \frac{2}{\sqrt{D}}\right)" />

      <SubHeading title="Correlation (Fisher z-transform)" />
      <p>
        For Spearman correlations, the MDES is computed via the Fisher z-transform (§10).
        Using the standard error <Eq tex="\text{SE}(z_F) = 1/\sqrt{n - q - 3}" /> from §10:
      </p>
      <DisplayEq tex="\text{MDES}_{r} = \tanh\!\left(\frac{\Phi^{-1}(1 - \alpha/2) + \Phi^{-1}(1 - \beta)}{\sqrt{n - q - 3}}\right)" />
      <p>
        where <Eq tex="q" /> is the number of covariates in the partial model
        and <Eq tex="\tanh(\cdot)" /> inverts the Fisher z-transform,
        mapping back from the variance-stabilised scale to the correlation scale.
      </p>

      <SubHeading title="Mann-Whitney and Kruskal-Wallis (simulation-based)" />
      <p>
        For nonparametric categorical tests, closed-form MDES formulae are not available.
        Instead, MDES is computed via simulation-based binary search (2,000 simulations per
        candidate effect size). The algorithm searches for the smallest effect size that
        achieves 80% rejection rate at <Eq tex="\alpha = 0.05" />.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 15. Evidence Strength Classification                              */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="evidence" number={15} title="Evidence Strength Classification" />
      <p>
        Each analysis result is classified into one of four evidence tiers based on
        statistical significance, effect magnitude, confidence interval precision, and
        sample size. The classification integrates multiple dimensions of evidence quality
        rather than relying on a single p-value threshold:
      </p>
      <EvidenceTable />

      <SubHeading title="Confidence interval width categories" />
      <p>
        The precision of point estimates is categorised using scale-appropriate thresholds:
      </p>
      <CIWidthTable />
      <p>
        For ratio-scale quantities (hazard ratios), the CI width is measured as the ratio
        of upper to lower bounds. For additive quantities (correlations, Cliff's delta),
        the CI width is the difference between bounds. These categories are calibrated to
        distinguish clinically informative from uninformative estimates.
      </p>

      <SubHeading title="Effect size thresholds" />
      <p>
        Each analysis type has preset minimum effect size thresholds that differ
        between the &ldquo;Strong&rdquo; (Cohen&rsquo;s medium) and &ldquo;Moderate&rdquo;
        (Cohen&rsquo;s small) tiers:
      </p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <Th>Analysis</Th>
              <Th>Effect metric</Th>
              <Th>Strong threshold</Th>
              <Th>Moderate threshold</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <Td>Survival</Td>
              <Td>HR</Td>
              <Td className="font-mono text-xs">&ge; 1.5 or &le; 0.667</Td>
              <Td className="font-mono text-xs">&ge; 1.18 or &le; 0.847</Td>
            </tr>
            <tr>
              <Td>Correlation</Td>
              <Td><Eq tex="|r_s|" /></Td>
              <Td className="font-mono text-xs">&ge; 0.3</Td>
              <Td className="font-mono text-xs">&ge; 0.1</Td>
            </tr>
            <tr>
              <Td>Categorical (2-group)</Td>
              <Td><Eq tex="|\delta|" /></Td>
              <Td className="font-mono text-xs">&ge; 0.3</Td>
              <Td className="font-mono text-xs">&ge; 0.15</Td>
            </tr>
            <tr>
              <Td>Categorical (k-group)</Td>
              <Td><Eq tex="\eta^2" /> or <Eq tex="\eta^2_p" /></Td>
              <Td className="font-mono text-xs">&ge; 0.06</Td>
              <Td className="font-mono text-xs">&ge; 0.01</Td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* 16. Confounding Adjustment Framework                              */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="confounding" number={16} title="Confounding Adjustment Framework" />
      <p>
        All association analyses (survival, correlation, categorical) are run under two
        covariate adjustment models:
      </p>
      <CovariateTable />
      <p>
        By reporting results under both models, users can assess the robustness of
        associations to confounding. An effect that attenuates substantially from the
        unadjusted to the adjusted model suggests confounding, while a stable effect provides
        stronger evidence of a direct morphology-outcome relationship.
      </p>

      <SubHeading title="TSS handling" />
      <p>
        Tissue source site (TSS) is handled differently depending on the analysis type.
        For survival (Cox PH), TSS enters as a stratification variable: each site gets its
        own baseline hazard function without consuming degrees of freedom. For correlations
        and categorical analyses, TSS is grouped into the five most frequent sites per cancer
        type, with remaining sites collapsed to &quot;Other&quot;, to limit the number of dummy
        variables in the residualization.
      </p>

      <SubHeading title="Covariate encoding" />
      <p>
        Continuous covariates (age) enter models as-is. Categorical covariates
        (sex, AJCC pathological stage) are one-hot encoded with <Code>drop_first=True</Code> to
        avoid multicollinearity. TSS is either stratified (survival) or top-5 grouped
        then one-hot encoded (correlations).
      </p>

      <SubHeading title="Missing data handling" />
      <p>
        Complete case analysis is used: observations with missing values in any covariate
        are excluded from the adjusted models. The sample size for each model is reported
        to allow assessment of the impact of missing data on statistical power.
      </p>

      <SampleSizeTable />

      {/* --------------------------------------------------------------- */}
      {/* 17. Software and Reproducibility                                  */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="software" number={17} title="Software and Reproducibility" />
      <p>
        All analyses are implemented in Python and orchestrated by a Snakemake workflow that
        defines a directed acyclic graph (DAG) of computational dependencies. Key libraries
        include:
      </p>
      <table className="mt-3 text-sm border border-zinc-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Library</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Version</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Purpose</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          <tr><td className="px-4 py-2 font-mono text-xs">Python</td><td className="px-4 py-2 font-mono text-xs">3.11</td><td className="px-4 py-2 text-zinc-600">Runtime</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">lifelines</td><td className="px-4 py-2 font-mono text-xs">0.29.0</td><td className="px-4 py-2 text-zinc-600">Cox regression, Kaplan-Meier estimation</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">scipy</td><td className="px-4 py-2 font-mono text-xs">1.12.0</td><td className="px-4 py-2 text-zinc-600">Mann-Whitney U, Kruskal-Wallis, permutation tests</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">scikit-learn</td><td className="px-4 py-2 font-mono text-xs">1.4.0</td><td className="px-4 py-2 text-zinc-600">K-means clustering, silhouette scores</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">umap-learn</td><td className="px-4 py-2 font-mono text-xs">0.5.5</td><td className="px-4 py-2 text-zinc-600">UMAP embedding</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">statsmodels</td><td className="px-4 py-2 font-mono text-xs">0.14.1</td><td className="px-4 py-2 text-zinc-600">OLS regression (Freedman-Lane residualisation)</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">numpy</td><td className="px-4 py-2 font-mono text-xs">1.26.4</td><td className="px-4 py-2 text-zinc-600">Numerical computation</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">pandas</td><td className="px-4 py-2 font-mono text-xs">2.2.0</td><td className="px-4 py-2 text-zinc-600">Data handling</td></tr>
          <tr><td className="px-4 py-2 font-mono text-xs">snakemake</td><td className="px-4 py-2 font-mono text-xs">8.4.0</td><td className="px-4 py-2 text-zinc-600">Workflow orchestration</td></tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-zinc-500">
        Exact library versions are pinned in <Code>uv.lock</Code> for full reproducibility.
        Versions listed above reflect the production pipeline run.
      </p>
      <p className="mt-3">
        All random processes (permutation tests, bootstrap resampling, K-means initialisation)
        use explicit random seeds for reproducibility. The pipeline supports a dry-run mode
        that subsets to 3 cancer types, 10 features, and 500 samples for rapid validation of
        statistical outputs before full production runs.
      </p>

      {/* --------------------------------------------------------------- */}
      {/* 18. References                                                    */}
      {/* --------------------------------------------------------------- */}
      <SectionHeading id="references" number={18} title="References" />
      <ol className="list-decimal pl-6 space-y-2 text-sm">
        <li>
          Cox, D.R. (1972).{' '}
          <a href="https://doi.org/10.1111/j.2517-6161.1972.tb00899.x" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Regression models and life-tables</a>.{' '}
          <em>Journal of the Royal Statistical Society: Series B</em>, 34(2), 187&ndash;220.
        </li>
        <li>
          Kaplan, E.L. & Meier, P. (1958).{' '}
          <a href="https://doi.org/10.1080/01621459.1958.10501452" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Nonparametric estimation from incomplete observations</a>.{' '}
          <em>Journal of the American Statistical Association</em>, 53(282), 457&ndash;481.
        </li>
        <li>
          Irwin, J.O. (1949).{' '}
          <a href="https://doi.org/10.1017/S0022172400014443" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">The standard error of an estimate of expectation of life, with special reference to expectation of tumourless life in experiments with mice</a>.{' '}
          <em>Journal of Hygiene</em>, 47(2), 188.
        </li>
        <li>
          Royston, P. & Parmar, M.K. (2013).{' '}
          <a href="https://doi.org/10.1186/1471-2288-13-152" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Restricted mean survival time: an alternative to the hazard ratio for the design and analysis of randomized trials with a time-to-event outcome</a>.{' '}
          <em>BMC Medical Research Methodology</em>, 13, 152.
        </li>
        <li>
          Schoenfeld, D. (1982).{' '}
          <a href="https://doi.org/10.1093/biomet/69.1.239" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Partial residuals for the proportional hazards regression model</a>.{' '}
          <em>Biometrika</em>, 69(1), 239&ndash;241.
        </li>
        <li>
          Freedman, D. & Lane, D. (1983).{' '}
          <a href="https://doi.org/10.1080/07350015.1983.10509354" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">A nonstochastic interpretation of reported significance levels</a>.{' '}
          <em>Journal of Business & Economic Statistics</em>, 1(4), 292&ndash;298.
        </li>
        <li>
          Benjamini, Y. & Hochberg, Y. (1995).{' '}
          <a href="https://doi.org/10.1111/j.2517-6161.1995.tb02031.x" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Controlling the false discovery rate: a practical and powerful approach to multiple testing</a>.{' '}
          <em>Journal of the Royal Statistical Society: Series B</em>, 57(1), 289&ndash;300.
        </li>
        <li>
          Subramanian, A. et al. (2005).{' '}
          <a href="https://doi.org/10.1073/pnas.0506580102" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Gene set enrichment analysis: a knowledge-based approach for interpreting genome-wide expression profiles</a>.{' '}
          <em>Proceedings of the National Academy of Sciences</em>, 102(43), 15545&ndash;15550.
        </li>
        <li>
          McInnes, L., Healy, J. & Melville, J. (2018).{' '}
          <a href="https://arxiv.org/abs/1802.03426" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">UMAP: Uniform Manifold Approximation and Projection for dimension reduction</a>.{' '}
          <em>arXiv preprint</em>, arXiv:1802.03426.
        </li>
        <li>
          Cliff, N. (1993).{' '}
          <a href="https://doi.org/10.1037/0033-2909.114.3.494" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dominance statistics: ordinal analyses to answer ordinal questions</a>.{' '}
          <em>Psychological Bulletin</em>, 114(3), 494&ndash;509.
        </li>
        <li>
          Spearman, C. (1904).{' '}
          <a href="https://doi.org/10.2307/1412159" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">The proof and measurement of association between two things</a>.{' '}
          <em>The American Journal of Psychology</em>, 15(1), 72&ndash;101.
        </li>
        <li>
          Fisher, R.A. (1921).{' '}
          <a href="https://doi.org/10.2307/3001608" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">On the &ldquo;probable error&rdquo; of a coefficient of correlation deduced from a small sample</a>.{' '}
          <em>Metron</em>, 1, 3&ndash;32.
        </li>
        <li>
          Kruskal, W.H. & Wallis, W.A. (1952).{' '}
          <a href="https://doi.org/10.1080/01621459.1952.10483441" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Use of ranks in one-criterion variance analysis</a>.{' '}
          <em>Journal of the American Statistical Association</em>, 47(260), 583&ndash;621.
        </li>
        <li>
          Mann, H.B. & Whitney, D.R. (1947).{' '}
          <a href="https://doi.org/10.1214/aoms/1177730491" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">On a test of whether one of two random variables is stochastically larger than the other</a>.{' '}
          <em>Annals of Mathematical Statistics</em>, 18(1), 50&ndash;60.
        </li>
        <li>
          Phipson, B. & Smyth, G.K. (2010).{' '}
          <a href="https://www.degruyterbrill.com/document/doi/10.2202/1544-6115.1585/html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Permutation P-values should never be zero: calculating exact P-values when permutations are randomly drawn</a>.{' '}
          <em>Statistical Applications in Genetics and Molecular Biology</em>, 9(1), Article 39.
        </li>
        <li>
          Mölder, F. et al. (2021).{' '}
          <a href="https://doi.org/10.12688/f1000research.29032.2" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sustainable data analysis with Snakemake</a>.{' '}
          <em>F1000Research</em>, 10, 33.
        </li>
        <li>
          Davidson-Pilon, C. (2019).{' '}
          <a href="https://doi.org/10.21105/joss.01317" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">lifelines: survival analysis in Python</a>.{' '}
          <em>Journal of Open Source Software</em>, 4(40), 1317.
        </li>
        <li>
          Liberzon, A. et al. (2015).{' '}
          <a href="https://doi.org/10.1016/j.cels.2015.12.004" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">The Molecular Signatures Database Hallmark Gene Set Collection</a>.{' '}
          <em>Cell Systems</em>, 1(6), 417&ndash;425.
        </li>
        <li>
          Thorsson, V. et al. (2018).{' '}
          <a href="https://doi.org/10.1016/j.immuni.2018.03.023" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">The Immune Landscape of Cancer</a>.{' '}
          <em>Immunity</em>, 48(4), 812&ndash;830.e14.
        </li>
        <li>
          Adjadj, B. et al. (2025).{' '}
          <a href="https://arxiv.org/abs/2508.09926" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Towards comprehensive cellular characterisation of H&E slides</a>.{' '}
          <em>arXiv preprint</em>, arXiv:2508.09926.
        </li>
        <li>
          Amgad, M. et al. (2019).{' '}
          <a href="https://doi.org/10.1093/bioinformatics/btz083" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Structured crowdsourcing enables convolutional segmentation of histology images</a>.{' '}
          <em>Bioinformatics</em>, 35(18), 3461&ndash;3467.
        </li>
        <li>
          Filiot, A. et al. (2023).{' '}
          <a href="https://doi.org/10.1101/2023.07.21.23292757" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Scaling Self-Supervised Learning for Histopathology with Masked Image Modeling</a>.{' '}
          <em>medRxiv preprint</em>, doi:10.1101/2023.07.21.23292757.
        </li>
        <li>
          Liu, J. et al. (2018).{' '}
          <a href="https://doi.org/10.1016/j.cell.2018.02.052" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">An Integrated TCGA Pan-Cancer Clinical Data Resource to drive high-quality survival outcome analytics</a>.{' '}
          <em>Cell</em>, 173(2), 400&ndash;416.e11.
        </li>
        <li>
          Ellrott, K. et al. (2018).{' '}
          <a href="https://doi.org/10.1016/j.cels.2018.03.002" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Scalable open science approach for mutation calling of tumor exomes using multiple genomic pipelines</a>.{' '}
          <em>Cell Systems</em>, 6(3), 271&ndash;281.e7.
        </li>
        <li>
          Newman, A.M. et al. (2015).{' '}
          <a href="https://doi.org/10.1038/nmeth.3337" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Robust enumeration of cell subsets from tissue expression profiles</a>.{' '}
          <em>Nature Methods</em>, 12(5), 453&ndash;457.
        </li>
        <li>
          Aran, D., Hu, Z. & Butte, A.J. (2017).{' '}
          <a href="https://doi.org/10.1186/s13059-017-1349-1" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">xCell: digitally portraying the tissue cellular heterogeneity landscape</a>.{' '}
          <em>Genome Biology</em>, 18, 220.
        </li>
        <li>
          Carter, S.L. et al. (2012).{' '}
          <a href="https://doi.org/10.1038/nbt.2203" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Absolute quantification of somatic DNA alterations in human cancer</a>.{' '}
          <em>Nature Biotechnology</em>, 30(5), 413&ndash;421.
        </li>
        <li>
          Hörst, F. et al. (2024).{' '}
          <a href="https://doi.org/10.1016/j.media.2024.103143" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">CellViT: Vision Transformers for precise cell segmentation and classification</a>.{' '}
          <em>Medical Image Analysis</em>, 94, 103143.
        </li>
        <li>
          Saltz, J. et al. (2018).{' '}
          <a href="https://doi.org/10.1016/j.celrep.2018.03.086" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Spatial organization and molecular correlation of tumor-infiltrating lymphocytes using deep learning on pathology images</a>.{' '}
          <em>Cell Reports</em>, 23(1), 181&ndash;193.e7.
        </li>
        <li>
          Salgado, R. et al. (2015).{' '}
          <a href="https://doi.org/10.1093/annonc/mdu450" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">The evaluation of tumor-infiltrating lymphocytes (TILs) in breast cancer: recommendations by an International TILs Working Group 2014</a>.{' '}
          <em>Annals of Oncology</em>, 26(2), 259&ndash;271.
        </li>
        <li>
          Keren, L. et al. (2018).{' '}
          <a href="https://doi.org/10.1016/j.cell.2018.08.039" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">A structured tumor-immune microenvironment in triple negative breast cancer revealed by multiplexed ion beam imaging</a>.{' '}
          <em>Cell</em>, 174(6), 1373&ndash;1387.e19.
        </li>
        <li>
          Maurer, C.R., Qi, R. & Raghavan, V. (2003).{' '}
          <a href="https://doi.org/10.1109/TPAMI.2003.1177156" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">A linear time algorithm for computing exact Euclidean distance transforms of binary images in arbitrary dimensions</a>.{' '}
          <em>IEEE Transactions on Pattern Analysis and Machine Intelligence</em>, 25(2), 265&ndash;270.
        </li>
      </ol>
    </div>
  );
}
