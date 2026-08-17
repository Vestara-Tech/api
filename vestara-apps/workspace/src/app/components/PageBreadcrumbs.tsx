import { PageBreadcrumbs as SharedPageBreadcrumbs, type PageBreadcrumbItem, type PageBreadcrumbsProps as SharedPageBreadcrumbsProps } from '@vestara/ui';

export type BreadcrumbItem = PageBreadcrumbItem;

export interface PageBreadcrumbsProps extends Omit<SharedPageBreadcrumbsProps, 'gutterBottom'> {
  readonly items: readonly BreadcrumbItem[];
}

export function PageBreadcrumbs({ items, ...props }: PageBreadcrumbsProps) {
  return <SharedPageBreadcrumbs items={items} gutterBottom {...props} />;
}
