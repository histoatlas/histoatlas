import type { ProvenanceMeta } from '../types/analysis';

export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const escaped = cell.replace(/"/g, '""');
        return cell.includes(',') || cell.includes('"') || cell.includes('\n')
          ? `"${escaped}"`
          : cell;
      }).join(',')
    ),
  ].join('\n');

  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function downloadJSON(filename: string, data: unknown, provenance?: ProvenanceMeta): void {
  const payload = provenance ? { provenance, data } : data;
  const jsonContent = JSON.stringify(payload, null, 2);
  downloadBlob(jsonContent, filename, 'application/json');
}

export function downloadSvg(svgElement: SVGSVGElement, filename: string): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  // Ensure xmlns for standalone SVG
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  downloadBlob(svgString, filename, 'image/svg+xml');
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
