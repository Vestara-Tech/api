import type { StatusTone } from '@vestara/ui';

export function toneForStatus(value: string | undefined): StatusTone {
  const normalized = value?.toLowerCase() ?? '';

  if (normalized.includes('error') || normalized.includes('fail') || normalized.includes('critical')) return 'critical';
  if (normalized.includes('warn') || normalized.includes('degrad') || normalized.includes('pending')) return 'warning';
  if (normalized.includes('info')) return 'info';
  if (normalized.includes('ready') || normalized.includes('healthy') || normalized.includes('active') || normalized.includes('pass') || normalized.includes('ok')) {
    return 'healthy';
  }

  return 'neutral';
}

