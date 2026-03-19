import { ogLayout } from './shared';

export function defaultTemplate() {
  return ogLayout({
    title: 'HistoAtlas',
    subtitle: 'Interactive atlas of tumor tissue morphology across TCGA and CPTAC cancer cohorts',
  });
}
