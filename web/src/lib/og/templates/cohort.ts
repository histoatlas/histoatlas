import { COHORT_FULL_NAMES } from '../../../data/cohortNames';
import { ogLayout } from './shared';

const PAGE_LABELS: Record<string, string> = {
  atlas: 'Atlas',
  associations: 'Associations',
  histomics: 'Histomics',
  cluster: 'Clusters',
  slide: 'Slides',
};

export function cohortTemplate(cohort: string, page: string) {
  const cohortName = COHORT_FULL_NAMES[cohort] ?? cohort;
  const pageLabel = PAGE_LABELS[page] ?? page;

  return ogLayout({
    title: cohortName,
    subtitle: pageLabel,
  });
}
