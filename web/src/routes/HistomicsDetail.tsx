import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useQueryParamState } from '../hooks/useQueryParamState';
import { TabNav } from '../components/ui/TabNav';
import { Icon } from '../components/ui/Icon';
import { CohortSelector } from '../components/ui/CohortSelector';
import { ProvenanceBar } from '../components/ui/ProvenanceBar';
import { OverviewTab } from '../components/histomics/OverviewTab';

const SurvivalTab = lazy(() => import('../components/histomics/SurvivalTab').then(m => ({ default: m.SurvivalTab })));
const MolecularTab = lazy(() => import('../components/histomics/MolecularTab').then(m => ({ default: m.MolecularTab })));
const AlterationsTab = lazy(() => import('../components/histomics/AlterationsTab').then(m => ({ default: m.AlterationsTab })));
const TreatmentTab = lazy(() => import('../components/histomics/TreatmentTab').then(m => ({ default: m.TreatmentTab })));
const CrossCancerTab = lazy(() => import('../components/histomics/CrossCancerTab').then(m => ({ default: m.CrossCancerTab })));

const TAB_IDS = ['overview', 'survival', 'molecular', 'alterations', 'treatment', 'cross-cancer'] as const;
const TAB_DEFS = [
  { id: 'overview', label: 'Overview', icon: <Icon name="layout-grid" size={16} /> },
  { id: 'survival', label: 'Survival', icon: <Icon name="heart-pulse" size={16} /> },
  { id: 'molecular', label: 'Molecular', icon: <Icon name="dna" size={16} /> },
  { id: 'alterations', label: 'Alterations', icon: <Icon name="flask-conical" size={16} /> },
  { id: 'treatment', label: 'Treatment', icon: <Icon name="activity" size={16} /> },
  { id: 'cross-cancer', label: 'Cross-Cancer', icon: <Icon name="globe" size={16} /> },
];
type TabId = (typeof TAB_IDS)[number];

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <div className="h-5 w-48 bg-zinc-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-zinc-100 rounded" />
          <div className="h-4 w-3/4 bg-zinc-100 rounded" />
          <div className="h-52 w-full bg-zinc-100 rounded" />
        </div>
      </div>
    </div>
  );
}

interface HistomicsDetailProps {
  dataset?: string;
  feature?: string;
  cohort?: string;
}

export function HistomicsDetail({ dataset = 'tcga', feature, cohort = 'PANCAN' }: HistomicsDetailProps) {
  const [activeTab, setActiveTab] = useQueryParamState('tab', '');
  const [selectorSlot, setSelectorSlot] = useState<HTMLElement | null>(null);
  const [provenanceSlot, setProvenanceSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSelectorSlot(document.getElementById('cohort-selector-slot'));
    setProvenanceSlot(document.getElementById('provenance-slot'));
  }, []);

  const validTab: TabId = (TAB_IDS as readonly string[]).includes(activeTab)
    ? (activeTab as TabId)
    : 'overview';

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab === 'overview' ? null : tab);
    },
    [setActiveTab],
  );

  const buildHref = useCallback(
    (selected: string) => {
      const tabParam = validTab !== 'overview' ? `?tab=${validTab}` : '';
      return `/${dataset}/${selected}/histomics/${encodeURIComponent(feature ?? '')}/${tabParam}`;
    },
    [dataset, feature, validTab],
  );

  if (!feature) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-zinc-500 text-sm">Missing feature name.</div>
      </div>
    );
  }

  return (
    <>
      {/* Portal cohort selector into the Astro-rendered title row */}
      {selectorSlot && createPortal(
        <CohortSelector dataset={dataset} currentCohort={cohort} buildHref={buildHref} />,
        selectorSlot,
      )}

      {/* White header zone: tab bar (H1 is server-rendered in Astro) */}
      <div className="bg-white border-b border-zinc-200">
        <TabNav tabs={TAB_DEFS} activeTab={validTab} onChange={handleTabChange} />
      </div>

      {/* Content zone */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {validTab === 'overview' && (
          <>
            <div id="feature-card-slot" className="mb-6 empty:hidden" />
            <OverviewTab dataset={dataset} feature={feature} cancerType={cohort} />
          </>
        )}
        {validTab === 'survival' && (
          <Suspense fallback={<TabSkeleton />}>
            <SurvivalTab dataset={dataset} feature={feature} cancerType={cohort} />
          </Suspense>
        )}
        {validTab === 'molecular' && (
          <Suspense fallback={<TabSkeleton />}>
            <MolecularTab dataset={dataset} feature={feature} cancerType={cohort} />
          </Suspense>
        )}
        {validTab === 'alterations' && (
          <Suspense fallback={<TabSkeleton />}>
            <AlterationsTab dataset={dataset} feature={feature} cancerType={cohort} />
          </Suspense>
        )}
        {validTab === 'treatment' && (
          <Suspense fallback={<TabSkeleton />}>
            <TreatmentTab dataset={dataset} feature={feature} cancerType={cohort} />
          </Suspense>
        )}
        {validTab === 'cross-cancer' && (
          <Suspense fallback={<TabSkeleton />}>
            <CrossCancerTab dataset={dataset} feature={feature} />
          </Suspense>
        )}
      </main>

      {/* Portal provenance bar below the Astro-rendered SEO sections */}
      {provenanceSlot && createPortal(<ProvenanceBar />, provenanceSlot)}
    </>
  );
}
