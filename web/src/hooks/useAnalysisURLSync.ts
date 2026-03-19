import { useEffect, useRef } from 'react';
import { useAnalysisStore } from '../stores/analysisStore';
import { useEvidenceStore } from '../stores/evidenceStore';
import { useQueryParamState } from './useQueryParamState';
import type { AssociationTarget } from '../types';

/**
 * Bidirectional sync between analysis/evidence stores and URL params.
 * Use inside associations-like client islands when store-backed URL state is needed.
 */
export function useAnalysisURLSync() {
  const isInitialized = useRef(false);

  const [urlModel, setUrlModel] = useQueryParamState('model', 'unadjusted');
  const [urlTarget, setUrlTarget] = useQueryParamState('target', 'survival');
  const [urlFeature, setUrlFeature] = useQueryParamState('feature', '');

  const { model, target, setContext } = useAnalysisStore();
  const { selectedEntityId, selectEntity, clearEntity } = useEvidenceStore();

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const validTargets: AssociationTarget[] = ['survival', 'correlations', 'categorical'];
    const parsedTarget = validTargets.includes(urlTarget as AssociationTarget)
      ? (urlTarget as AssociationTarget)
      : 'survival';

    setContext({
      model: urlModel,
      target: parsedTarget,
    });

    if (urlFeature) {
      selectEntity(urlFeature, 'feature');
    }
  }, [urlModel, urlTarget, urlFeature, setContext, selectEntity]);

  useEffect(() => {
    if (!isInitialized.current) return;

    setUrlModel(model !== 'unadjusted' ? model : null);
    setUrlTarget(target !== 'survival' ? target : null);
    setUrlFeature(selectedEntityId || null);
  }, [model, target, selectedEntityId, setUrlModel, setUrlTarget, setUrlFeature]);

  return { clearEntity };
}
