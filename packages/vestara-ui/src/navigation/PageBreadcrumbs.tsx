import type { ReactNode } from 'react';
import { Breadcrumbs, Link, Typography, type SxProps, type Theme } from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { mergeSx } from '../utils/mergeSx.js';

export interface PageBreadcrumbItem {
  readonly label: ReactNode;
  readonly href?: string;
}

export interface PageBreadcrumbsProps {
  readonly items: readonly PageBreadcrumbItem[];
  readonly ariaLabel?: string;
  readonly gutterBottom?: boolean;
  readonly sx?: SxProps<Theme>;
}

export function PageBreadcrumbs({
  items,
  ariaLabel = 'breadcrumb',
  gutterBottom = false,
  sx,
}: PageBreadcrumbsProps) {
  return (
    <Breadcrumbs
      aria-label={ariaLabel}
      sx={mergeSx(gutterBottom ? { mb: 2 } : undefined, sx)}
    >
      {items.map((item, index) =>
        item.href !== undefined && index < items.length - 1 ? (
          <Link
            key={`${String(item.label)}-${index}`}
            component={RouterLink}
            to={item.href}
            underline="hover"
            color="inherit"
          >
            {item.label}
          </Link>
        ) : (
          <Typography
            key={`${String(item.label)}-${index}`}
            color={index === items.length - 1 ? 'text.primary' : 'text.secondary'}
          >
            {item.label}
          </Typography>
        ),
      )}
    </Breadcrumbs>
  );
}
