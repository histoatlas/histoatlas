export function formatP(p: number | null | undefined): string {
  if (p == null) return 'N/A';
  if (p < 0.0001) return '<0.0001';
  if (p < 0.001) return '<0.001';
  return p.toPrecision(3);
}

export function formatNum(n: number | null, decimals = 2): string {
  if (n == null) return 'N/A';
  return n.toFixed(decimals);
}

export function formatCI(lower: number | null, upper: number | null, decimals = 2): string {
  return `[${formatNum(lower, decimals)}, ${formatNum(upper, decimals)}]`;
}

export function formatEffect(value: number | null, label: string, decimals = 2): string {
  if (value == null) return `${label}: N/A`;
  return `${label}: ${value.toFixed(decimals)}`;
}

export function formatHR(hr: number | null | undefined): string {
  if (hr == null) return 'N/A';
  return hr.toFixed(2);
}

export function formatOrdinal(n: number): string {
  const rounded = Math.round(n);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  const mod10 = rounded % 10;
  if (mod10 === 1) return `${rounded}st`;
  if (mod10 === 2) return `${rounded}nd`;
  if (mod10 === 3) return `${rounded}rd`;
  return `${rounded}th`;
}
