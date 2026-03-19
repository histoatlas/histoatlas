import { useAtlasStore } from '../../stores/atlasStore';
import { useAnalysisStore } from '../../stores/analysisStore';

export function SelectionContextBar() {
  const selectedSlideIds = useAtlasStore((s) => s.selectedSlideIds);
  const clearSelection = useAtlasStore((s) => s.clearSelection);
  const { target, model, cancerType } = useAnalysisStore();

  if (selectedSlideIds.length === 0) return null;

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-blue-900">
            {selectedSlideIds.length} slide{selectedSlideIds.length !== 1 ? 's' : ''} selected
          </span>
          {cancerType && (
            <span className="text-blue-600 text-xs">
              {cancerType} · {target} · {model}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
          >
            Analyze Selection
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
