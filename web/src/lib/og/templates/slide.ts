import { COHORT_FULL_NAMES } from '../../../data/cohortNames';
import { ogLayout } from './shared';

export function slideTemplate(cohort: string, slideId: string) {
  const cohortName = COHORT_FULL_NAMES[cohort] ?? cohort;
  const display = slideId.length > 40 ? slideId.slice(0, 37) + '...' : slideId;

  return ogLayout({
    title: display,
    subtitle: `${cohortName} Cohort`,
  });
}
