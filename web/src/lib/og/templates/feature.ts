import { ALL_FEATURES } from '../../../data/featureGlossary';
import { COHORT_FULL_NAMES } from '../../../data/cohortNames';
import { ogLayout } from './shared';

const featureByName = new Map(ALL_FEATURES.map((f) => [f.name, f]));

export function featureTemplate(cohort: string, featureName: string) {
  const feature = featureByName.get(featureName);
  const displayName = feature?.displayName ?? featureName;
  const section = feature?.section ?? 'Histomics';
  const cohortName = COHORT_FULL_NAMES[cohort] ?? cohort;

  return ogLayout({
    title: displayName,
    subtitle: `${cohortName} Cohort`,
    badge: { text: section, bg: '#eff6ff', fg: '#1d4ed8' },
  });
}
