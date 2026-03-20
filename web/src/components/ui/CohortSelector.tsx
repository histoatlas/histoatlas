import { useCallback, useMemo } from 'react';
import { useCohorts } from '../../hooks/useCohorts';
import { CANCER_TYPE_COLORS } from '../../lib/colors';

interface CohortSelectorProps {
  dataset?: string;
  /** Currently active cohort (from URL) */
  currentCohort: string;
  /** Build the href for a given cohort. Controls where the dropdown navigates. */
  buildHref: (cohort: string) => string;
}

export function CohortSelector({ dataset = 'tcga', currentCohort, buildHref }: CohortSelectorProps) {
  const { data: cohorts } = useCohorts(dataset);

  const sortedCohorts = useMemo(() => {
    if (!cohorts) return [];
    return cohorts
      .filter((c) => c.id !== 'PANCAN')
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [cohorts]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = e.target.value;
      if (selected === currentCohort) return;
      window.location.href = buildHref(selected);
    },
    [currentCohort, buildHref],
  );

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {currentCohort !== 'PANCAN' && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: CANCER_TYPE_COLORS[currentCohort] ?? '#808080' }}
        />
      )}
      <select
        value={currentCohort}
        onChange={handleChange}
        aria-label="Select cohort"
        className="text-sm font-medium text-zinc-900 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 cursor-pointer hover:border-zinc-300 transition-colors"
      >
        <option value="PANCAN">All cancer types (PANCAN)</option>
        {sortedCohorts.length === 0 && currentCohort !== 'PANCAN' && (
          <option value={currentCohort}>{currentCohort}</option>
        )}
        {sortedCohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id}
          </option>
        ))}
      </select>
    </div>
  );
}
