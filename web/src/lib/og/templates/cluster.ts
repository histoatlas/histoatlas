import { COHORT_FULL_NAMES } from '../../../data/cohortNames';
import { ogLayout } from './shared';

export function clusterTemplate(cohort: string, clusterId: string) {
  const cohortName = COHORT_FULL_NAMES[cohort] ?? cohort;

  return ogLayout({
    title: `Cluster ${clusterId}`,
    subtitle: `${cohortName} Cohort`,
  });
}
