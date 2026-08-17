const bytesFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatBytes(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** exponent;
  return `${bytesFormatter.format(scaled)} ${units[exponent]}`;
}

export function formatInteger(value: number | undefined): string {
  return value === undefined ? '—' : new Intl.NumberFormat('en-US').format(value);
}

export function formatDateTime(value: string | undefined): string {
  if (value === undefined) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDurationMs(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value < 1000) return `${value} ms`;

  const totalSeconds = Math.floor(value / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatPercentage(numerator: number | undefined, denominator: number | undefined): string {
  if (numerator === undefined || denominator === undefined || denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function compactList(values: readonly string[] | undefined, fallback = '—'): string {
  if (values === undefined || values.length === 0) return fallback;
  return values.join(', ');
}

