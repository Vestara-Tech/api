import { MetricCard as SharedMetricCard, type MetricCardProps as SharedMetricCardProps } from '@vestara/ui';

export type MetricCardProps = Omit<SharedMetricCardProps, 'variant'>;

export function MetricCard({ label, value, detail, tone = 'neutral', sx }: MetricCardProps) {
  return <SharedMetricCard label={label} value={value} detail={detail} tone={tone} variant="badge" {...(sx === undefined ? {} : { sx })} />;
}
