import { useState, useRef, useCallback, useEffect } from 'react';
import { SectionCard } from '../ui/SectionCard';
import { Icon } from '../ui/Icon';

const BAND_COLORS = [
  { color: 'rgb(230, 0, 0)', rgb: [230, 0, 0], label: 'Tumor front' },
  { color: 'rgb(200, 80, 80)', rgb: [200, 80, 80], label: 'Tumor core' },
  { color: 'rgb(30, 80, 180)', rgb: [30, 80, 180], label: 'Peritumoral stroma' },
  { color: 'rgb(100, 140, 210)', rgb: [100, 140, 210], label: 'Stroma 50-200 µm' },
  { color: 'rgb(180, 200, 230)', rgb: [180, 200, 230], label: 'Stroma >200 µm' },
  { color: 'rgb(180, 100, 50)', rgb: [180, 100, 50], label: 'Necrosis ring' },
  { color: 'rgb(80, 80, 80)', rgb: [80, 80, 80], label: 'Necrosis' },
  { color: 'rgb(0, 150, 0)', rgb: [0, 150, 0], label: 'Normal epithelium' },
  { color: 'rgb(255, 255, 255)', rgb: [255, 255, 255], label: 'Background' },
] as const;

/** Map mouse coordinates to the image rect inside an object-contain container. */
function getObjectFitRect(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

/** Find the closest BAND_COLORS entry via Euclidean RGB distance. */
function matchColor(r: number, g: number, b: number): (typeof BAND_COLORS)[number] | null {
  let best: (typeof BAND_COLORS)[number] | null = null;
  let bestDist = Infinity;
  for (const band of BAND_COLORS) {
    const dr = r - band.rgb[0];
    const dg = g - band.rgb[1];
    const db = b - band.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = band;
    }
  }
  return best;
}

interface TissueMaskProps {
  slideId: string;
  features?: Record<string, number | null>;
}

export function TissueMask({ slideId, features }: TissueMaskProps) {
  const [hasError, setHasError] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    band: (typeof BAND_COLORS)[number];
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number>(0);

  const src = `/bundles/v1/tiles/${slideId}/mask.png`;

  // Reset error state when slideId changes
  useEffect(() => {
    setHasError(false);
    setTooltip(null);
    ctxRef.current = null;
    canvasRef.current = null;
  }, [slideId]);

  // Load the mask image into an offscreen canvas for pixel sampling
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    canvasRef.current = canvas;
    ctxRef.current = ctx;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    // Throttle to one sample per animation frame
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const img = imgRef.current;
      const ctx = ctxRef.current;
      if (!img || !ctx) return;

      const rect = img.getBoundingClientRect();
      const fitRect = getObjectFitRect(
        rect.width,
        rect.height,
        img.naturalWidth,
        img.naturalHeight,
      );

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Check if inside the actual image area (not the letterbox)
      if (
        mouseX < fitRect.x ||
        mouseX > fitRect.x + fitRect.width ||
        mouseY < fitRect.y ||
        mouseY > fitRect.y + fitRect.height
      ) {
        setTooltip(null);
        return;
      }

      // Map to canvas pixels (clamp to valid range to avoid out-of-bounds reads)
      const canvasX = Math.min(
        img.naturalWidth - 1,
        Math.max(0, Math.floor(((mouseX - fitRect.x) / fitRect.width) * img.naturalWidth)),
      );
      const canvasY = Math.min(
        img.naturalHeight - 1,
        Math.max(0, Math.floor(((mouseY - fitRect.y) / fitRect.height) * img.naturalHeight)),
      );

      const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
      const band = matchColor(pixel[0], pixel[1], pixel[2]);
      if (!band) {
        setTooltip(null);
        return;
      }

      setTooltip({ x: mouseX, y: mouseY, band });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTooltip(null);
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const tumorFraction = features?.['tumor_area_fraction'];
  const stromaFraction = features?.['stroma_area_fraction'];

  return (
    <SectionCard
      title="Tissue Map"
      icon={<Icon name="layers" size={18} className="text-zinc-400" />}
      subtitle={<>Tumor and stroma compartments identified by band-level segmentation. <a href="/methods/#spatial-regions" className="text-blue-600 hover:underline">see Methods §5</a></>}
    >
      {hasError ? (
        <p className="text-sm text-zinc-400 py-8 text-center">
          Mask not available for this slide.
        </p>
      ) : (
        <figure className="flex items-center gap-6">
          <div className="relative flex-1 min-w-0 bg-zinc-50 border border-zinc-100 rounded-md p-3 flex items-center justify-center">
            <img
              ref={imgRef}
              src={src}
              alt={`Tumor and stroma tissue compartment map for slide ${slideId}`}
              loading="lazy"
              decoding="async"
              width={1000}
              height={562}
              className="max-h-80 w-auto object-contain cursor-crosshair"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              onError={() => setHasError(true)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            {tooltip && (
              <div
                className="absolute pointer-events-none z-10 bg-zinc-800 text-white rounded-lg px-3 py-2 text-xs shadow-lg"
                style={{
                  left: tooltip.x + 16,
                  top: tooltip.y - 8,
                  maxWidth: 200,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-500"
                    style={{ backgroundColor: tooltip.band.color }}
                  />
                  <span className="font-semibold">{tooltip.band.label}</span>
                </div>
                {(tumorFraction != null || stromaFraction != null) && (
                  <div className="text-zinc-400 space-y-0.5 mt-1.5 border-t border-zinc-600 pt-1.5">
                    {tumorFraction != null && (
                      <div className="flex justify-between gap-3">
                        <span>Tumor area</span>
                        <span className="font-mono text-zinc-200">{(tumorFraction * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {stromaFraction != null && (
                      <div className="flex justify-between gap-3">
                        <span>Stroma area</span>
                        <span className="font-mono text-zinc-200">{(stromaFraction * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <figcaption className="flex flex-col gap-2 shrink-0">
            {BAND_COLORS.map(({ color, label }) => (
              <span key={label} className="flex items-center gap-2 text-xs text-zinc-600">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-200"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </figcaption>
        </figure>
      )}
    </SectionCard>
  );
}
