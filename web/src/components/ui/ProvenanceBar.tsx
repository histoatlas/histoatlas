import type { EvidenceRef } from '../../types/analysis';
import { useBundleVersion } from '../../hooks/useBundleVersion';

interface ProvenanceBarProps {
  evidence?: EvidenceRef;
}

export function ProvenanceBar({ evidence }: ProvenanceBarProps) {
  const { data: bundleVersion } = useBundleVersion();

  const version = evidence?.bundleVersion ?? bundleVersion;

  if (!version) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-4 pt-3 border-t border-zinc-100">
      <span>
        Data <span className="font-mono text-zinc-500">{version}</span>
      </span>
      {evidence?.extractionVersion && (
        <>
          <span className="text-zinc-300">&middot;</span>
          <span>
            Pipeline <span className="font-mono text-zinc-500">{evidence.extractionVersion}</span>
          </span>
        </>
      )}
      {evidence?.pipelineCommitHash && (
        <>
          <span className="text-zinc-300">&middot;</span>
          <span>
            Commit <span className="font-mono text-zinc-500">{evidence.pipelineCommitHash.slice(0, 7)}</span>
          </span>
        </>
      )}
      {evidence?.pythonVersion && (
        <>
          <span className="text-zinc-300">&middot;</span>
          <span>
            Python <span className="font-mono text-zinc-500">{evidence.pythonVersion}</span>
          </span>
        </>
      )}
      {evidence?.lastUpdated && (
        <>
          <span className="text-zinc-300">&middot;</span>
          <span>
            Updated <span className="font-mono text-zinc-500">{evidence.lastUpdated}</span>
          </span>
        </>
      )}
    </div>
  );
}
