export function formatInteger(value?: number | null): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function compactList(values: readonly string[], limit = 6): string {
  const shown = values.slice(0, limit);
  const suffix = values.length > limit ? ` +${values.length - limit}` : '';
  return shown.length > 0 ? `${shown.join(' · ')}${suffix}` : '—';
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value?: string | null): string {
  if (value === undefined || value === null || value.length === 0) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

export function formatUnknownValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}
