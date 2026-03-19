import { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { CohortSelector } from '../components/ui/CohortSelector';
import { HistomicsTable } from '../components/histomics/HistomicsTable';

interface HistomicsTableIslandProps {
  dataset?: string;
  cohort?: string;
}

export function HistomicsTableIsland({ dataset = 'tcga', cohort = 'PANCAN' }: HistomicsTableIslandProps) {
  const buildHref = useCallback((c: string) => `/${dataset}/${c}/histomics/`, [dataset]);

  const [cohortSlot, setCohortSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setCohortSlot(document.getElementById('cohort-selector-slot'));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Portal: CohortSelector into SSR header */}
      {cohortSlot && createPortal(
        <CohortSelector dataset={dataset} currentCohort={cohort} buildHref={buildHref} />,
        cohortSlot,
      )}

      {/* Content zone */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <HistomicsTable dataset={dataset} cohort={cohort} />
      </main>
    </QueryClientProvider>
  );
}
