import { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { DeckGL } from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import type { Slide, TooltipData, ViewportState } from '../../types';
import type { RGBAColor } from '../../lib/colors';

interface EmbeddingPlotProps {
  slides: Slide[];
  filteredIds: Set<string>;
  colorScale: (slide: Slide) => RGBAColor;
  hoveredId: string | null;
  selectedSlideIds: string[];
  onHover: (data: TooltipData | null) => void;
  onHoverId: (id: string | null) => void;
  onClick: (slideId: string) => void;
}

const INITIAL_VIEW_STATE: ViewportState & { minZoom: number; maxZoom: number } = {
  zoom: 0,
  target: [0, 0],
  minZoom: -2,
  maxZoom: 10,
};

// Debounce timeout for hover events
const HOVER_DEBOUNCE_MS = 16;

export function EmbeddingPlot({
  slides,
  filteredIds,
  colorScale,
  hoveredId,
  selectedSlideIds,
  onHover,
  onHoverId,
  onClick,
}: EmbeddingPlotProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  const handleResize = useCallback(({ width, height }: { width: number; height: number }) => {
    setContainerSize({ width, height });
  }, []);

  // Compute initial view state to fit all data
  const fittedViewState = useMemo(() => {
    if (slides.length === 0 || !containerSize) return INITIAL_VIEW_STATE;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const slide of slides) {
      if (slide.x < minX) minX = slide.x;
      if (slide.x > maxX) maxX = slide.x;
      if (slide.y < minY) minY = slide.y;
      if (slide.y > maxY) maxY = slide.y;
    }

    // Note: We display y on horizontal axis, x on vertical (axes swapped)
    const centerX = (minY + maxY) / 2;
    const centerY = (minX + maxX) / 2;

    // Calculate optimal zoom to fit data with padding
    const dataWidth = maxY - minY;
    const dataHeight = maxX - minX;
    const padding = 0.85; // 15% margin

    const zoomX = Math.log2((containerSize.width * padding) / dataWidth);
    const zoomY = Math.log2((containerSize.height * padding) / dataHeight);
    const zoom = Math.min(zoomX, zoomY); // Use more constrained axis

    return {
      ...INITIAL_VIEW_STATE,
      target: [centerX, centerY] as [number, number],
      zoom,
    };
  }, [slides, containerSize]);

  // Initialize view state from fitted view state when data and container are ready
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedRef.current && slides.length > 0 && containerSize) {
      setViewState(fittedViewState);
      hasInitializedRef.current = true;
    }
  }, [slides.length, containerSize, fittedViewState]);

  const handleHover = useCallback(
    (info: PickingInfo) => {
      // Clear previous timeout
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current);
      }

      if (!info.picked || !info.object) {
        // Debounce clearing hover to prevent flicker
        hoverTimeoutRef.current = window.setTimeout(() => {
          onHover(null);
          onHoverId(null);
        }, HOVER_DEBOUNCE_MS);
        return;
      }

      const slide = info.object as Slide;
      const resolvedColor = colorScale(slide);
      onHover({
        slide,
        screenX: info.x,
        screenY: info.y,
        color: resolvedColor,
      });
      onHoverId(slide.id);
    },
    [onHover, onHoverId, colorScale]
  );

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.picked && info.object) {
        const slide = info.object as Slide;
        onClick(slide.id);
      }
    },
    [onClick]
  );

  // Create a set for fast lookup
  const selectedSet = useMemo(() => new Set(selectedSlideIds), [selectedSlideIds]);

  // Separate filtered, selected, hovered, and background slides
  const { filteredSlides, backgroundSlides, hoveredSlide, selectedSlides } = useMemo(() => {
    const filtered: Slide[] = [];
    const background: Slide[] = [];
    const selected: Slide[] = [];
    let hovered: Slide | null = null;

    for (const slide of slides) {
      if (slide.id === hoveredId) {
        hovered = slide;
      } else if (selectedSet.has(slide.id) && filteredIds.has(slide.id)) {
        selected.push(slide);
      } else if (filteredIds.has(slide.id)) {
        filtered.push(slide);
      } else {
        background.push(slide);
      }
    }

    return {
      filteredSlides: filtered,
      backgroundSlides: background,
      hoveredSlide: hovered,
      selectedSlides: selected,
    };
  }, [slides, filteredIds, hoveredId, selectedSet]);

  const layers = [
    // Background layer - faded, non-pickable
    new ScatterplotLayer<Slide>({
      id: 'background-scatter',
      data: backgroundSlides,
      getPosition: (d) => [d.y, d.x],
      getRadius: 2,
      getFillColor: [120, 120, 120, 60], // Dim gray, semi-transparent
      pickable: false,
      opacity: 0.3,
      radiusMinPixels: 1,
      radiusMaxPixels: 2,
    }),
    // Foreground layer - colored, pickable
    new ScatterplotLayer<Slide>({
      id: 'foreground-scatter',
      data: filteredSlides,
      getPosition: (d) => [d.y, d.x],
      getRadius: 3,
      getFillColor: colorScale,
      pickable: true,
      opacity: 0.6,
      radiusMinPixels: 1.5,
      radiusMaxPixels: 3,
      updateTriggers: {
        getFillColor: [colorScale],
      },
    }),
    // Selected slides layer - highlighted with stroke
    new ScatterplotLayer<Slide>({
      id: 'selected-scatter',
      data: selectedSlides,
      getPosition: (d) => [d.y, d.x],
      getRadius: 5,
      getFillColor: colorScale,
      getLineColor: [255, 255, 255, 255],
      getLineWidth: 2,
      stroked: true,
      pickable: true,
      opacity: 0.9,
      radiusMinPixels: 3,
      radiusMaxPixels: 5,
      lineWidthMinPixels: 1,
      lineWidthMaxPixels: 3,
      updateTriggers: {
        getFillColor: [colorScale],
      },
    }),
    // Hovered slide layer - larger with white stroke
    hoveredSlide
      ? new ScatterplotLayer<Slide>({
          id: 'hovered-scatter',
          data: [hoveredSlide],
          getPosition: (d) => [d.y, d.x],
          getRadius: 8,
          getFillColor: colorScale,
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 3,
          stroked: true,
          pickable: true,
          opacity: 1.0,
          radiusMinPixels: 4,
          radiusMaxPixels: 8,
          lineWidthMinPixels: 2,
          lineWidthMaxPixels: 4,
          updateTriggers: {
            getFillColor: [colorScale],
          },
        })
      : null,
  ].filter(Boolean);

  const view = new OrthographicView({
    id: 'ortho',
  });

  return (
    <div className="w-full h-full relative" role="img" aria-label={`Interactive UMAP embedding of ${slides.length} histopathology slides colored by morphology cluster, ${filteredIds.size} currently displayed`}>
      <DeckGL
        views={view}
        viewState={viewState}
        onViewStateChange={({ viewState: newState }) =>
          setViewState(newState as typeof viewState)
        }
        onResize={handleResize}
        controller={true}
        layers={layers}
        onHover={handleHover}
        onClick={handleClick}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      />
      {/* UMAP parameter footnote */}
      <div className="absolute bottom-1 left-2 text-[9px] text-zinc-500/70 pointer-events-none select-none">
        UMAP: n_neighbors=15, min_dist=0.1, metric=euclidean, z-scored features
      </div>
    </div>
  );
}
