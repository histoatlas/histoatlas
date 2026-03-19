import type { ClinicalData } from '../../types';
import { Icon } from '../ui/Icon';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Skeleton } from '../ui/Skeleton';

interface ClinicalContextProps {
  clinical: ClinicalData | null | undefined;
  isLoading: boolean;
}

const IMMUNE_SUBTYPE_LABELS: Record<string, string> = {
  C1: 'Wound healing',
  C2: 'IFN-γ dominant',
  C3: 'Inflammatory',
  C4: 'Lymphocyte depleted',
  C5: 'Immunologically quiet',
  C6: 'TGF-β dominant',
};

const STAGE_COLORS: Record<string, string> = {
  I: 'bg-emerald-100 text-emerald-700',
  II: 'bg-yellow-100 text-yellow-700',
  III: 'bg-orange-100 text-orange-700',
  IV: 'bg-red-100 text-red-700',
};

function parseStageLevel(stage: string): string | null {
  const match = stage.match(/(?:STAGE\s+)(I{1,3}V?|IV)/i);
  if (match) return match[1].replace(/[ABC]\d?$/i, '');
  return null;
}

function formatStage(stage: string): string {
  return stage.replace(/^STAGE\s+/i, 'Stage ');
}

function StageBadge({ stage }: { stage: string }) {
  const level = parseStageLevel(stage);
  const colorClass = level ? STAGE_COLORS[level] ?? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-100 text-zinc-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {formatStage(stage)}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-700">{children}</dd>
    </div>
  );
}

export function ClinicalContext({ clinical, isLoading }: ClinicalContextProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!clinical) return null;

  const ageSex = [
    clinical.age != null ? `${clinical.age} y/o` : null,
    clinical.sex,
  ].filter(Boolean).join(' ');

  const immuneLabel = clinical.immuneSubtype
    ? IMMUNE_SUBTYPE_LABELS[clinical.immuneSubtype]
    : null;

  const survivalText = clinical.osMonths != null ? `${clinical.osMonths} mo` : null;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Icon name="user" size={18} className="text-zinc-400" />
        Clinical Context
        <InfoTooltip text="Patient clinical metadata: demographics, staging, molecular subtype, immune classification, survival, and key somatic mutations." />
      </h2>
      <dl className="space-y-3 text-sm">
        <Field label="Age / Sex">
          {ageSex || '—'}
        </Field>

        <Field label="Stage">
          {clinical.stage ? <StageBadge stage={clinical.stage} /> : '—'}
        </Field>

        <Field label="Subtype">
          {clinical.subtype ?? '—'}
        </Field>

        <Field label="Immune Subtype">
          {clinical.immuneSubtype ? (
            <span>
              <span className="font-medium">{clinical.immuneSubtype}</span>
              {immuneLabel && <span className="text-zinc-500"> — {immuneLabel}</span>}
            </span>
          ) : '—'}
        </Field>

        {clinical.stage && (
          <Field label="Stage System">
            <span className="flex items-center gap-1 text-zinc-500 text-xs">
              AJCC
              <InfoTooltip text="American Joint Committee on Cancer staging system based on tumor size (T), lymph node involvement (N), and distant metastasis (M)." />
            </span>
          </Field>
        )}

        <Field label="Overall Survival">
          {survivalText ?? '—'}
        </Field>

        <div className="flex justify-between items-start">
          <dt className="text-zinc-500 pt-0.5">Key Mutations</dt>
          <dd>
            {clinical.mutations.length > 0 ? (
              <div className="flex flex-wrap gap-1 justify-end">
                {clinical.mutations.map((gene) => (
                  <span
                    key={gene}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-xs font-mono font-medium text-zinc-700"
                  >
                    {gene}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-zinc-400 text-xs">None detected</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
