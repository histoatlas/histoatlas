/**
 * SEO content for gene mutation hub pages.
 *
 * Each entry provides optimized titles, meta descriptions, educational intros,
 * and FAQs for all 8 tracked gene pages.
 */

export type GeneSeoContent = {
  searchKeyword: string;
  hubTitle: string;
  intersectionTitle: (cancer: string) => string;
  hubMetaDescription: string;
  intersectionMetaDescription: (cancer: string, freq: string) => string;
  educationalIntro: string;
  faqs: { question: string; answer: string }[];
};

export const GENE_SEO_CONTENT: Record<string, GeneSeoContent> = {
  tp53: {
    searchKeyword: 'TP53 Mutation',
    hubTitle: 'TP53 Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `TP53 Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'TP53 mutation frequency, survival impact, and morphology associations across 33 cancer types. Data from 11,000+ TCGA whole slide images.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `TP53 mutations in ${cancer} (${freq}% frequency): survival curves, morphology changes & co-occurring mutations. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is TP53?</h2>
      <p>
        <strong>TP53</strong> is a gene that encodes the p53 protein, often called the "guardian of the genome."
        p53 is a transcription factor that responds to DNA damage, oncogene activation, and other cellular
        stresses by triggering cell cycle arrest, DNA repair, or apoptosis (programmed cell death). When TP53
        is mutated, cells lose this critical checkpoint, allowing damaged DNA to accumulate and driving
        tumor progression.
      </p>
      <h3>TP53 Mutations in Cancer</h3>
      <p>
        TP53 is the <strong>most frequently mutated gene in human cancer</strong>, altered in approximately
        50% of all tumors. Mutation frequency varies dramatically by cancer type: over 95% in high-grade
        serous ovarian cancer, ~80% in small cell lung cancer, ~70% in colorectal cancer, but less than
        5% in thyroid carcinoma. Most TP53 mutations are missense mutations in the DNA-binding domain
        (hotspots at codons 175, 245, 248, 249, 273, and 282), which not only abolish tumor-suppressive
        function but can confer dominant-negative or gain-of-function properties.
      </p>
      <h3>Clinical Significance</h3>
      <p>
        TP53 mutation status is prognostic in many cancer types. It is associated with higher tumor
        grade, greater genomic instability, and worse overall survival. In some contexts (e.g., AML,
        myelodysplastic syndromes), TP53 mutations define a distinct clinical entity with very poor
        outcomes. TP53 mutations are also predictive: they confer resistance to certain chemotherapy
        regimens while sensitizing tumors to others.
      </p>
      <h3>Morphological Associations</h3>
      <p>
        TP53-mutant tumors tend to show distinct histological features that are detectable on H&amp;E-stained
        slides. HistoAtlas quantifies these morphological differences computationally across all 33 TCGA
        cancer types: higher mitotic index, increased nuclear pleomorphism, altered immune infiltration
        patterns, and changes in stromal composition. Explore below how TP53 mutations reshape the tumor
        microenvironment in each cancer type.
      </p>
    `,
    faqs: [
      {
        question: 'What is a TP53 mutation?',
        answer:
          'A TP53 mutation is a change in the DNA sequence of the TP53 gene that alters or inactivates the p53 protein. Since p53 normally prevents damaged cells from proliferating, losing p53 function allows cancer cells to grow unchecked. TP53 is the most commonly mutated gene in human cancer.',
      },
      {
        question: 'What cancers have TP53 mutations?',
        answer:
          'TP53 mutations are found across virtually all cancer types but are most frequent in ovarian serous carcinoma (>95%), small cell lung cancer (~80%), colorectal cancer (~60%), and pancreatic cancer (~70%). They are less common in thyroid cancer, kidney cancer, and testicular germ cell tumors.',
      },
      {
        question: 'Is TP53 mutation hereditary?',
        answer:
          'Most TP53 mutations in cancer are somatic (acquired during a person\'s lifetime). However, inherited (germline) TP53 mutations cause Li-Fraumeni syndrome, a rare hereditary condition that dramatically increases the risk of developing multiple types of cancer at a young age.',
      },
      {
        question: 'Does TP53 mutation affect survival?',
        answer:
          'In many cancer types, TP53 mutations are associated with worse overall survival and higher-grade disease. However, the prognostic impact varies by cancer type and the specific type of TP53 alteration. HistoAtlas provides survival curves comparing TP53-mutant vs wild-type tumors across 33 cancer types.',
      },
    ],
  },

  kras: {
    searchKeyword: 'KRAS Mutation',
    hubTitle: 'KRAS Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `KRAS Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'KRAS mutation frequency, survival impact, and morphology associations across 33 cancer types. Data from 11,000+ TCGA slides.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `KRAS mutations in ${cancer} (${freq}% frequency): survival curves, morphology changes & co-occurring mutations. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is KRAS?</h2>
      <p>
        <strong>KRAS</strong> (Kirsten Rat Sarcoma Viral Oncogene Homolog) encodes a small GTPase protein
        that acts as a molecular switch in the RAS/MAPK signaling pathway. When activated by growth factor
        receptors, KRAS triggers a cascade of signals promoting cell growth, proliferation, and survival.
        KRAS mutations lock the protein in its active "on" state, driving continuous cell proliferation
        independent of external growth signals.
      </p>
      <h3>KRAS Mutations in Cancer</h3>
      <p>
        KRAS is one of the most commonly mutated oncogenes, found in approximately <strong>25% of all
        human cancers</strong>. It is particularly prevalent in pancreatic ductal adenocarcinoma (~90%),
        colorectal cancer (~40%), and non-small cell lung cancer (~30%). The most frequent mutations
        occur at codons 12 (G12D, G12V, G12C), 13 (G13D), and 61 (Q61H), each with distinct biochemical
        properties and clinical implications.
      </p>
      <h3>Therapeutic Landscape</h3>
      <p>
        For decades, KRAS was considered "undruggable" due to the protein's smooth surface lacking
        obvious drug-binding pockets. This changed with the development of <strong>KRAS G12C inhibitors</strong>
        (sotorasib, adagrasib), which covalently bind to the mutant cysteine. These represent a
        breakthrough in precision oncology, particularly for lung adenocarcinoma. Research into
        inhibitors for other KRAS mutations (G12D, G12V) is rapidly advancing.
      </p>
      <h3>Morphological Associations</h3>
      <p>
        KRAS-mutant tumors display characteristic morphological features visible on H&amp;E slides:
        mucinous differentiation patterns in colorectal cancer, specific growth patterns in lung
        adenocarcinoma, and altered stromal reactions. HistoAtlas quantifies these morphological
        differences computationally across cancer types, linking KRAS status to tissue-level changes
        in cell composition, density, and spatial organization.
      </p>
    `,
    faqs: [
      {
        question: 'What is a KRAS mutation?',
        answer:
          'A KRAS mutation is a DNA change in the KRAS gene that locks the KRAS protein in its active state, continuously signaling cells to grow and divide. KRAS mutations are found in about 25% of all cancers and are especially common in pancreatic, colorectal, and lung cancers.',
      },
      {
        question: 'Is KRAS mutation hereditary?',
        answer:
          'KRAS mutations in cancer are almost always somatic (acquired, not inherited). However, germline KRAS mutations can cause developmental disorders like Noonan syndrome, which carries a modestly increased cancer risk. Standard cancer-associated KRAS mutations (G12C, G12D, etc.) are not passed from parent to child.',
      },
      {
        question: 'Can KRAS mutations be treated?',
        answer:
          'Yes. KRAS G12C mutations can now be treated with targeted inhibitors (sotorasib, adagrasib), approved for lung cancer and under investigation in other tumor types. Inhibitors for other KRAS mutations (G12D) are in clinical trials. KRAS-mutant tumors are typically resistant to EGFR-targeted therapies.',
      },
    ],
  },

  braf: {
    searchKeyword: 'BRAF Mutation',
    hubTitle: 'BRAF Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `BRAF Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'BRAF mutation frequency, survival impact, and morphology data across 33 cancer types. TCGA-based research platform.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `BRAF mutations in ${cancer} (${freq}% frequency): survival curves, morphology changes & co-occurring mutations. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is BRAF?</h2>
      <p>
        <strong>BRAF</strong> (B-Raf Proto-Oncogene) is a serine/threonine kinase that sits in the
        RAS/RAF/MEK/ERK (MAPK) signaling cascade, directly downstream of RAS. When activated, BRAF
        phosphorylates MEK, which in turn activates ERK to promote cell growth, survival, and
        differentiation. Oncogenic mutations in BRAF constitutively activate this pathway independent
        of upstream RAS signaling.
      </p>
      <h3>BRAF V600E and Beyond</h3>
      <p>
        The <strong>BRAF V600E</strong> mutation accounts for ~90% of all BRAF mutations in cancer.
        It results in a 500-fold increase in kinase activity compared to wild-type BRAF. Other clinically
        relevant mutations include V600K (common in melanoma), class II mutations (K601E, which signals
        as a RAS-independent dimer), and class III mutations (which paradoxically amplify RAS-dependent
        signaling). BRAF mutations are found in ~50% of melanomas, ~60% of thyroid papillary carcinomas,
        ~10% of colorectal cancers, and subsets of lung, ovarian, and brain tumors.
      </p>
      <h3>Targeted Therapy</h3>
      <p>
        BRAF V600E is one of the most successfully drugged oncogenic mutations. <strong>BRAF inhibitors</strong>
        (vemurafenib, dabrafenib) combined with <strong>MEK inhibitors</strong> (trametinib, cobimetinib)
        are standard of care in BRAF V600-mutant melanoma, and encorafenib plus cetuximab is approved for
        BRAF V600E-mutant colorectal cancer. However, resistance invariably develops, driven by MAPK
        pathway reactivation, PI3K/AKT activation, or tumor microenvironment changes.
      </p>
      <h3>Morphological Signatures</h3>
      <p>
        BRAF-mutant tumors often display distinct histological features. In melanoma, BRAF V600E-mutant
        tumors tend to show nesting patterns and greater intraepidermal spread. In colorectal cancer,
        BRAF mutations associate with right-sided location, mucinous histology, and serrated morphology.
        HistoAtlas quantifies these morphological differences across cancer types using computational
        histomics from whole slide images.
      </p>
    `,
    faqs: [
      {
        question: 'What is a BRAF mutation?',
        answer:
          'A BRAF mutation is a change in the BRAF gene that causes the BRAF protein kinase to be constitutively active, continuously stimulating cell growth through the MAPK pathway. The most common BRAF mutation is V600E, found in about 50% of melanomas and subsets of thyroid, colorectal, and other cancers.',
      },
      {
        question: 'What does BRAF V600E positive mean?',
        answer:
          'BRAF V600E positive means the tumor carries a specific mutation where the amino acid valine (V) at position 600 is replaced by glutamic acid (E). This mutation is clinically important because it makes the tumor eligible for targeted therapy with BRAF and MEK inhibitors.',
      },
      {
        question: 'How is BRAF mutation treated?',
        answer:
          'BRAF V600-mutant cancers are treated with BRAF inhibitors (vemurafenib, dabrafenib, encorafenib), usually combined with MEK inhibitors (trametinib, cobimetinib, binimetinib) to prevent resistance. In melanoma, this combination is standard first-line therapy for BRAF-mutant tumors alongside immunotherapy.',
      },
    ],
  },

  egfr: {
    searchKeyword: 'EGFR Mutation',
    hubTitle: 'EGFR Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `EGFR Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'EGFR mutation frequency, survival impact, and morphology data across 33 cancer types. TCGA-based research platform.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `EGFR mutations in ${cancer} (${freq}% frequency): survival curves, morphology changes & co-occurring mutations. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is EGFR?</h2>
      <p>
        <strong>EGFR</strong> (Epidermal Growth Factor Receptor) is a transmembrane tyrosine kinase
        receptor that, when activated by ligands such as EGF and TGF-alpha, triggers intracellular
        signaling cascades including RAS/MAPK, PI3K/AKT, and STAT pathways. These pathways control
        cell proliferation, survival, migration, and differentiation. Oncogenic EGFR mutations cause
        ligand-independent receptor activation, driving uncontrolled tumor growth.
      </p>
      <h3>EGFR Mutations in Lung Cancer</h3>
      <p>
        EGFR mutations are most clinically significant in <strong>non-small cell lung cancer (NSCLC)</strong>,
        where they occur in approximately 15-30% of cases (higher in never-smokers, women, and East Asian
        populations). The two most common activating mutations are <strong>exon 19 deletions</strong> (~45%)
        and the <strong>L858R point mutation</strong> in exon 21 (~40%). Together, these "classical"
        EGFR mutations predict sensitivity to EGFR tyrosine kinase inhibitors (TKIs). The T790M mutation
        is the most common resistance mechanism to first- and second-generation TKIs.
      </p>
      <h3>Precision Medicine</h3>
      <p>
        EGFR testing is mandatory for all advanced NSCLC patients. <strong>Three generations of EGFR TKIs</strong>
        are approved: first-generation (gefitinib, erlotinib), second-generation (afatinib, dacomitinib),
        and third-generation (osimertinib), which also targets T790M resistance mutations. Osimertinib is
        now first-line standard of care for EGFR-mutant advanced NSCLC, with recent data supporting its
        use in adjuvant and neoadjuvant settings.
      </p>
      <h3>Morphological Patterns</h3>
      <p>
        EGFR-mutant lung adenocarcinomas show characteristic histological patterns: lepidic and papillary
        growth patterns are more common, while solid and micropapillary patterns (typically aggressive)
        are less frequent compared to KRAS-mutant tumors. HistoAtlas captures these morphological
        associations quantitatively, linking EGFR mutation status to measurable changes in tumor
        architecture, nuclear morphology, and immune infiltration patterns.
      </p>
    `,
    faqs: [
      {
        question: 'What is an EGFR mutation?',
        answer:
          'An EGFR mutation is a change in the EGFR gene that causes the receptor to be continuously active, driving cell growth without normal regulatory signals. EGFR mutations are most important in lung cancer, where they occur in 15-30% of non-small cell lung cancers and predict response to targeted therapy.',
      },
      {
        question: 'What does EGFR positive mean?',
        answer:
          'EGFR positive (or EGFR mutation positive) means the tumor has an activating mutation in the EGFR gene, typically an exon 19 deletion or L858R mutation. This is significant because EGFR-positive lung cancers respond to EGFR tyrosine kinase inhibitors (TKIs) like osimertinib, offering better outcomes than chemotherapy alone.',
      },
      {
        question: 'How are EGFR mutations treated?',
        answer:
          'EGFR-mutant cancers are primarily treated with tyrosine kinase inhibitors (TKIs). Osimertinib (a third-generation TKI) is the current standard first-line therapy for EGFR-mutant advanced lung cancer. Earlier-generation TKIs (gefitinib, erlotinib, afatinib) are also used. Treatment choice depends on the specific EGFR mutation type.',
      },
    ],
  },
  pik3ca: {
    searchKeyword: 'PIK3CA Mutation',
    hubTitle: 'PIK3CA Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `PIK3CA Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'PIK3CA mutation frequency, survival impact, and morphology data across 33 cancer types. Interactive survival curves and histopathology features. Free research platform.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `PIK3CA mutation in ${cancer}: ${freq}% prevalence. Kaplan-Meier survival curves, hazard ratios, and histopathology features. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is PIK3CA?</h2>
      <p>
        <strong>PIK3CA</strong> (Phosphatidylinositol-4,5-Bisphosphate 3-Kinase Catalytic Subunit Alpha)
        encodes the p110&alpha; catalytic subunit of phosphoinositide 3-kinase (PI3K), a lipid kinase central
        to the PI3K/AKT/mTOR signaling pathway. This pathway regulates cell growth, survival, metabolism,
        and motility. When PIK3CA is mutated, the PI3K enzyme becomes constitutively active, generating
        excessive PIP3 and driving uncontrolled AKT signaling.
      </p>
      <h3>PIK3CA Mutations in Cancer</h3>
      <p>
        PIK3CA is one of the <strong>most frequently mutated oncogenes</strong> across human cancers,
        altered in approximately 12-15% of all tumors. It is most prevalent in breast cancer (~35%,
        especially HR+/HER2- subtype), endometrial cancer (~50%), cervical cancer (~25%), and head and
        neck squamous cell carcinoma (~20%). The vast majority of mutations cluster at three hotspots:
        <strong>E545K</strong> and <strong>E542K</strong> in the helical domain, and <strong>H1047R</strong>
        in the kinase domain. These mutations have distinct biochemical mechanisms but all hyperactivate
        PI3K signaling.
      </p>
      <h3>Targeted Therapy and Clinical Significance</h3>
      <p>
        PIK3CA mutation status is a predictive biomarker for PI3K inhibitor therapy. <strong>Alpelisib</strong>
        (a PI3K&alpha;-specific inhibitor) combined with fulvestrant is approved for PIK3CA-mutant,
        HR-positive, HER2-negative advanced breast cancer. <strong>Inavolisib</strong>, a next-generation
        PI3K&alpha; inhibitor, has shown improved efficacy. PIK3CA mutations generally confer a relatively
        favorable prognosis in breast cancer but may be associated with resistance to certain endocrine
        therapies and anti-HER2 agents.
      </p>
      <h3>Morphological Associations</h3>
      <p>
        PIK3CA-mutant tumors tend to display distinct histological features: in breast cancer, they associate
        with lower-grade, well-differentiated tumors with lobular or tubular morphology. In endometrial cancer,
        PIK3CA mutations correlate with endometrioid histology. HistoAtlas quantifies these morphological
        differences computationally across all 33 TCGA cancer types, linking PIK3CA status to tissue-level
        changes detectable on H&amp;E-stained whole slide images.
      </p>
    `,
    faqs: [
      {
        question: 'What is a PIK3CA mutation?',
        answer:
          'A PIK3CA mutation is a change in the PIK3CA gene that causes the PI3K enzyme to be constitutively active, driving cell growth through the PI3K/AKT/mTOR pathway. PIK3CA is one of the most commonly mutated oncogenes, found in ~35% of breast cancers, ~50% of endometrial cancers, and subsets of many other tumor types.',
      },
      {
        question: 'What is PIK3CA mutation breast cancer?',
        answer:
          'PIK3CA mutations occur in approximately 35% of breast cancers, most commonly in hormone receptor-positive (HR+), HER2-negative subtypes. The three main hotspot mutations (E545K, E542K, H1047R) are targetable with PI3K inhibitors. Alpelisib plus fulvestrant is FDA-approved for PIK3CA-mutant, HR+/HER2- advanced breast cancer.',
      },
      {
        question: 'What is PIK3CA mutation treatment?',
        answer:
          'PIK3CA-mutant cancers can be treated with PI3K inhibitors. Alpelisib (Piqray) is approved for PIK3CA-mutant, HR+/HER2- advanced breast cancer in combination with fulvestrant. Inavolisib is a newer PI3K inhibitor under investigation. PIK3CA testing is now standard for advanced HR+/HER2- breast cancer patients.',
      },
      {
        question: 'What is PIK3CA mutation survival rate?',
        answer:
          'PIK3CA mutation impact on survival varies by cancer type and subtype. In HR+/HER2- breast cancer, PIK3CA mutations are generally associated with a relatively favorable prognosis but may predict resistance to certain therapies. HistoAtlas provides Kaplan-Meier survival curves comparing PIK3CA-mutant vs wild-type tumors across 33 TCGA cancer types.',
      },
    ],
  },

  pten: {
    searchKeyword: 'PTEN Mutation',
    hubTitle: 'PTEN Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `PTEN Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'PTEN mutation frequency, survival impact, and morphology data across 33 cancer types. Interactive survival curves and histopathology features. Free research platform.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `PTEN mutation in ${cancer}: ${freq}% prevalence. Kaplan-Meier survival curves, hazard ratios, and histopathology features. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is PTEN?</h2>
      <p>
        <strong>PTEN</strong> (Phosphatase and Tensin Homolog) is a dual-specificity phosphatase that
        acts as one of the most important tumor suppressors in human biology. Its primary function is to
        dephosphorylate PIP3, directly antagonizing the PI3K/AKT/mTOR signaling pathway. By keeping this
        growth-promoting pathway in check, PTEN serves as a critical brake on cell proliferation, survival,
        and metabolism. When PTEN is lost or inactivated, the PI3K pathway becomes hyperactive.
      </p>
      <h3>PTEN Mutations in Cancer</h3>
      <p>
        PTEN is among the <strong>most commonly deleted or mutated tumor suppressor genes</strong> in
        cancer, with alterations found in approximately 8-10% of all tumors (higher when including
        epigenetic silencing and copy number loss). PTEN mutations are most prevalent in endometrial
        cancer (~65%), glioblastoma (~30-40%), prostate cancer (~20-40%), and melanoma (~10-15%).
        Unlike oncogenes with hotspot mutations, PTEN alterations are scattered throughout the gene
        and include point mutations, deletions, frameshifts, and promoter methylation.
      </p>
      <h3>Clinical Significance and Cowden Syndrome</h3>
      <p>
        Somatic PTEN loss is associated with aggressive disease features and therapeutic resistance in
        many cancer types. Germline PTEN mutations cause <strong>PTEN hamartoma tumor syndromes</strong>,
        most notably <strong>Cowden syndrome</strong>, characterized by multiple hamartomas and a markedly
        increased risk of breast, thyroid, endometrial, and other cancers. PTEN status is increasingly
        used to guide therapy: PTEN loss may predict sensitivity to PI3K/AKT/mTOR pathway inhibitors
        and resistance to certain immunotherapies.
      </p>
      <h3>Morphological Associations</h3>
      <p>
        PTEN-deficient tumors display characteristic histological features. In endometrial cancer,
        PTEN loss associates with endometrioid histology and lower-grade disease. In prostate cancer,
        PTEN deletion correlates with higher Gleason score, larger tumor volume, and cribriform
        morphology. In glioblastoma, PTEN loss is associated with more diffuse infiltrative patterns.
        HistoAtlas quantifies these morphological differences across 33 TCGA cancer types using
        computational analysis of whole slide images.
      </p>
    `,
    faqs: [
      {
        question: 'What is a PTEN mutation?',
        answer:
          'A PTEN mutation is a change in the PTEN gene that inactivates the PTEN phosphatase protein, removing a critical brake on the PI3K/AKT growth-signaling pathway. PTEN is one of the most commonly altered tumor suppressors in cancer, found in ~65% of endometrial cancers, ~30% of glioblastomas, and ~20% of prostate cancers.',
      },
      {
        question: 'Is PTEN mutation hereditary?',
        answer:
          'Most PTEN mutations in cancer are somatic (acquired). However, inherited germline PTEN mutations cause PTEN hamartoma tumor syndromes, including Cowden syndrome, which carries significantly increased risks for breast cancer (85% lifetime risk), thyroid cancer (35%), and endometrial cancer (28%). Genetic testing is recommended for individuals meeting clinical criteria.',
      },
      {
        question: 'What is PTEN mutation Cowden syndrome?',
        answer:
          'Cowden syndrome is a hereditary condition caused by germline PTEN mutations. It is characterized by multiple hamartomas (benign growths) and a dramatically increased lifetime risk of breast, thyroid, endometrial, kidney, and colorectal cancers. Cowden syndrome patients require intensive cancer surveillance starting in their 20s.',
      },
      {
        question: 'Does PTEN mutation affect survival?',
        answer:
          'PTEN loss is generally associated with more aggressive disease and worse outcomes, though the impact varies by cancer type. In prostate cancer, PTEN deletion correlates with higher-grade disease and shorter time to metastasis. In glioblastoma, PTEN status is prognostic. HistoAtlas provides survival curves comparing PTEN-mutant vs wild-type tumors across 33 TCGA cancer types.',
      },
    ],
  },

  idh1: {
    searchKeyword: 'IDH1 Mutation',
    hubTitle: 'IDH1 Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `IDH1 Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'IDH1 mutation frequency, survival impact, and morphology data across 33 cancer types. Interactive survival curves and histopathology features. Free research platform.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `IDH1 mutation in ${cancer}: ${freq}% prevalence. Kaplan-Meier survival curves, hazard ratios, and histopathology features. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is IDH1?</h2>
      <p>
        <strong>IDH1</strong> (Isocitrate Dehydrogenase 1) encodes a metabolic enzyme that catalyzes the
        oxidative decarboxylation of isocitrate to &alpha;-ketoglutarate (&alpha;-KG) in the cytoplasm.
        Oncogenic IDH1 mutations are neomorphic: rather than losing enzyme function, the mutant IDH1
        gains a new activity: converting &alpha;-KG to <strong>2-hydroxyglutarate (2-HG)</strong>, an
        oncometabolite. 2-HG accumulation inhibits &alpha;-KG-dependent dioxygenases, causing widespread
        epigenetic dysregulation through DNA and histone hypermethylation.
      </p>
      <h3>IDH1 Mutations in Brain Tumors</h3>
      <p>
        IDH1 mutations are a <strong>defining molecular feature of lower-grade gliomas</strong> and
        secondary glioblastoma. The R132H mutation accounts for over 90% of IDH1 mutations in gliomas.
        IDH1 mutations are found in approximately <strong>70-80% of grade II-III gliomas</strong>
        (astrocytomas, oligodendrogliomas), ~10% of glioblastomas (mostly secondary), and ~20% of
        intrahepatic cholangiocarcinomas. They are also present in ~15% of acute myeloid leukemias.
        The 2021 WHO Classification of CNS tumors uses IDH mutation status as a primary classifier
        for adult-type diffuse gliomas.
      </p>
      <h3>Prognostic and Therapeutic Implications</h3>
      <p>
        IDH1 mutation is one of the <strong>strongest positive prognostic markers</strong> in gliomas.
        IDH-mutant gliomas have significantly better overall survival compared to IDH-wildtype tumors
        (median OS ~7 years vs ~1.5 years for glioblastoma). <strong>Vorasidenib</strong>, an oral
        dual IDH1/IDH2 inhibitor, was approved in 2024 for IDH-mutant grade 2 gliomas and is the
        first targeted therapy for these tumors. Ivosidenib is approved for IDH1-mutant
        cholangiocarcinoma and AML.
      </p>
      <h3>Morphological Associations</h3>
      <p>
        IDH1-mutant gliomas display distinctive histological features: diffuse infiltrative growth
        with less necrosis and microvascular proliferation than IDH-wildtype glioblastoma. IDH-mutant
        astrocytomas show characteristic nuclear atypia patterns, while oligodendrogliomas exhibit
        the classic "fried egg" morphology. HistoAtlas quantifies these morphological differences
        across cancer types using computational analysis of H&amp;E-stained whole slide images.
      </p>
    `,
    faqs: [
      {
        question: 'What is an IDH1 mutation?',
        answer:
          'An IDH1 mutation is a change in the IDH1 gene that causes the enzyme to produce an abnormal metabolite called 2-hydroxyglutarate (2-HG), which disrupts normal cell development through epigenetic changes. IDH1 mutations are most common in brain tumors (gliomas), where the R132H mutation defines a distinct disease entity with better prognosis.',
      },
      {
        question: 'What is IDH1 mutation in brain tumors?',
        answer:
          'IDH1 mutations are found in 70-80% of lower-grade gliomas (grade II-III) and about 10% of glioblastomas. IDH1-mutant brain tumors are a molecularly distinct category in the WHO Classification, with significantly better prognosis than IDH-wildtype tumors. The R132H mutation accounts for over 90% of IDH1 mutations in gliomas.',
      },
      {
        question: 'What is IDH1 mutation treatment?',
        answer:
          'Vorasidenib, an oral dual IDH1/IDH2 inhibitor, was approved in 2024 for IDH-mutant grade 2 gliomas, the first targeted therapy for these tumors. Ivosidenib is approved for IDH1-mutant cholangiocarcinoma and acute myeloid leukemia. Standard glioma treatments (surgery, radiation, temozolomide) remain the backbone of care.',
      },
      {
        question: 'Does IDH1 mutation affect survival?',
        answer:
          'Yes. IDH1 mutation is one of the strongest positive prognostic markers in gliomas. IDH-mutant lower-grade gliomas have a median survival of ~7 years, compared to ~1.5 years for IDH-wildtype glioblastoma. HistoAtlas provides survival curves comparing IDH1-mutant vs wild-type tumors across 33 TCGA cancer types.',
      },
    ],
  },

  arid1a: {
    searchKeyword: 'ARID1A Mutation',
    hubTitle: 'ARID1A Mutation in Cancer: Frequency, Survival & Morphology Data | HistoAtlas',
    intersectionTitle: (cancer: string) =>
      `ARID1A Mutation in ${cancer}: Survival Impact & Histopathology | HistoAtlas`,
    hubMetaDescription:
      'ARID1A mutation frequency, survival impact, and morphology data across 33 cancer types. Interactive survival curves and histopathology features. Free research platform.',
    intersectionMetaDescription: (cancer: string, freq: string) =>
      `ARID1A mutation in ${cancer}: ${freq}% prevalence. Kaplan-Meier survival curves, hazard ratios, and histopathology features. Free TCGA data.`,
    educationalIntro: `
      <h2>What Is ARID1A?</h2>
      <p>
        <strong>ARID1A</strong> (AT-Rich Interaction Domain 1A) encodes a key subunit of the
        SWI/SNF (BAF) chromatin remodeling complex, one of the most important epigenetic regulators
        in human cells. The SWI/SNF complex uses ATP hydrolysis to reposition nucleosomes, controlling
        access to DNA for transcription, repair, and replication. ARID1A specifically helps target
        the complex to AT-rich DNA sequences near gene promoters and enhancers. When ARID1A is lost,
        chromatin remodeling is disrupted, leading to aberrant gene expression programs.
      </p>
      <h3>ARID1A Mutations in Cancer</h3>
      <p>
        ARID1A is one of the <strong>most frequently mutated chromatin regulators</strong> in cancer,
        with loss-of-function mutations found in approximately 6-8% of all tumors. It is particularly
        prevalent in ovarian clear cell carcinoma (~50%), endometrial cancer (~40%), gastric cancer
        (~25%), bladder cancer (~25%), and cholangiocarcinoma (~15%). Unlike oncogenes with activating
        hotspot mutations, ARID1A mutations are predominantly truncating (nonsense, frameshift) and
        scattered throughout the gene, leading to complete protein loss.
      </p>
      <h3>Emerging Therapeutic Strategies</h3>
      <p>
        ARID1A loss creates <strong>synthetic lethal vulnerabilities</strong> that are being exploited
        therapeutically. ARID1A-deficient tumors depend more heavily on the residual SWI/SNF subunit
        ARID1B, the EZH2 histone methyltransferase, and PARP. EZH2 inhibitors (tazemetostat) show
        selective activity in ARID1A-mutant cancers. ARID1A loss may also enhance immunogenicity
        through increased mutational burden and altered antigen presentation, potentially predicting
        response to immune checkpoint inhibitors.
      </p>
      <h3>Morphological Associations</h3>
      <p>
        ARID1A-mutant tumors display characteristic histological features. In ovarian cancer,
        ARID1A loss defines the clear cell carcinoma subtype with its distinctive glycogen-rich
        cytoplasm. In endometrial cancer, ARID1A loss associates with dedifferentiated morphology.
        In gastric cancer, it correlates with microsatellite instability and lymphocyte-rich stroma.
        HistoAtlas quantifies these morphological patterns across 33 TCGA cancer types using
        computational analysis of whole slide images.
      </p>
    `,
    faqs: [
      {
        question: 'What is an ARID1A mutation?',
        answer:
          'An ARID1A mutation is a loss-of-function change in the ARID1A gene, which encodes a subunit of the SWI/SNF chromatin remodeling complex. When ARID1A is lost, cells cannot properly regulate gene expression through chromatin remodeling. ARID1A mutations are common in ovarian clear cell carcinoma (~50%), endometrial cancer (~40%), and gastric cancer (~25%).',
      },
      {
        question: 'What cancers have ARID1A mutations?',
        answer:
          'ARID1A mutations are most common in ovarian clear cell carcinoma (~50%), endometrial carcinoma (~40%), gastric adenocarcinoma (~25%), bladder cancer (~25%), and cholangiocarcinoma (~15%). ARID1A is one of the most frequently mutated chromatin regulators across all cancer types.',
      },
      {
        question: 'How are ARID1A-mutant cancers treated?',
        answer:
          'ARID1A-mutant cancers are being targeted through synthetic lethality approaches. EZH2 inhibitors (tazemetostat) show selective activity in ARID1A-deficient tumors. ARID1A loss may also enhance response to immune checkpoint inhibitors due to increased tumor immunogenicity. Clinical trials are investigating these strategies across multiple tumor types.',
      },
    ],
  },
};

/** Check if a gene slug has SEO content */
export function hasGeneSeoContent(geneSlug: string): boolean {
  return geneSlug in GENE_SEO_CONTENT;
}
