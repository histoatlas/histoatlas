import type {
  SurvivalAssociation,
  CorrelationAssociation,
  CategoricalAssociation,
} from './index';

export const WarningType = {
  SmallN: 'small_n',
  Imbalance: 'imbalance',
  PhFail: 'ph_fail',
  WideCi: 'wide_ci',
  LowEvents: 'low_events',
  MultipleTesting: 'multiple_testing',
} as const;
export type WarningType = (typeof WarningType)[keyof typeof WarningType];

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface StatWarning {
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  detail?: string;
}

export interface StatSummary {
  effect: number | null;
  effectLabel: string;
  ci: [number | null, number | null];
  p: number | null;
  pAdj: number | null;
  correctionFamily: string;
  nTests: number | null;
  ciMethod: string | null;
  n: number;
  nEvents: number | null;
  model: string | null;
  warnings: StatWarning[];
}

export function survivalToStatSummary(a: SurvivalAssociation): StatSummary {
  const warnings: StatWarning[] = [];

  if (a.nEvents < 10) {
    warnings.push({
      type: WarningType.LowEvents,
      severity: 'warning',
      message: `Only ${a.nEvents} events observed`,
      detail: 'Survival estimates may be unreliable with fewer than 10 events.',
    });
  }
  if (a.phFlag === 'fail') {
    warnings.push({
      type: WarningType.PhFail,
      severity: 'warning',
      message: 'Proportional hazards assumption violated',
      detail: 'The Cox PH test indicates non-proportional hazards. Hazard ratio may not be constant over time.',
    });
  }
  if (a.ciWidthCategory === 'wide') {
    warnings.push({
      type: WarningType.WideCi,
      severity: 'info',
      message: 'Wide confidence interval',
      detail: 'The CI spans a large range, suggesting imprecise estimation.',
    });
  }
  if (a.nSamples < 50) {
    warnings.push({
      type: WarningType.SmallN,
      severity: 'warning',
      message: `Small sample size (n=${a.nSamples})`,
    });
  }

  return {
    effect: a.hazardRatio,
    effectLabel: 'Hazard Ratio',
    ci: [a.hrCiLower, a.hrCiUpper],
    p: a.pValue,
    pAdj: a.pValueAdj,
    correctionFamily: 'BH',
    nTests: null,
    ciMethod: 'Wald',
    n: a.nSamples,
    nEvents: a.nEvents,
    model: null,
    warnings,
  };
}

export function correlationToStatSummary(a: CorrelationAssociation): StatSummary {
  const warnings: StatWarning[] = [];

  if (a.nSamples < 30) {
    warnings.push({
      type: WarningType.SmallN,
      severity: 'warning',
      message: `Small sample size (n=${a.nSamples})`,
    });
  }
  if (a.ciWidthCategory === 'wide') {
    warnings.push({
      type: WarningType.WideCi,
      severity: 'info',
      message: 'Wide confidence interval',
    });
  }

  return {
    effect: a.spearmanRho,
    effectLabel: 'Spearman rho',
    ci: [a.spearmanCiLower, a.spearmanCiUpper],
    p: a.spearmanP ?? null,
    pAdj: a.spearmanPAdj,
    correctionFamily: 'BH',
    nTests: null,
    ciMethod: 'bootstrap percentile',
    n: a.nSamples,
    nEvents: null,
    model: null,
    warnings,
  };
}

export function categoricalToStatSummary(a: CategoricalAssociation): StatSummary {
  const warnings: StatWarning[] = [];

  if (a.nSamples < 30) {
    warnings.push({
      type: WarningType.SmallN,
      severity: 'warning',
      message: `Small sample size (n=${a.nSamples})`,
    });
  }

  const minGroupSize = Math.min(...Object.values(a.groupSizes));
  if (minGroupSize < 10) {
    warnings.push({
      type: WarningType.Imbalance,
      severity: 'warning',
      message: `Smallest group has only ${minGroupSize} samples`,
      detail: 'Small group sizes may reduce statistical power.',
    });
  }

  return {
    effect: a.effectSize,
    effectLabel: a.effectSizeName,
    ci: [a.effectCiLower, a.effectCiUpper],
    p: a.pValue,
    pAdj: a.pValueAdj,
    correctionFamily: 'BH',
    nTests: null,
    ciMethod: 'bootstrap percentile',
    n: a.nSamples,
    nEvents: null,
    model: a.testType,
    warnings,
  };
}
