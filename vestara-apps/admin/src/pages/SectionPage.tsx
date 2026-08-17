import type { ReactNode } from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';
import { PageBreadcrumbs, type PageBreadcrumbItem } from '../app/components/PageBreadcrumbs.js';

export interface SectionPageProps {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbs: readonly PageBreadcrumbItem[];
  readonly availability?: ReactNode;
  readonly children?: ReactNode;
}

export function SectionPage({ title, description, breadcrumbs, availability, children }: SectionPageProps) {
  return (
    <PageContainer title={title} description={description}>
      <Stack spacing={2}>
        <PageBreadcrumbs items={breadcrumbs} />
        {availability ? <StatusBadge label={availability} tone="info" sx={{ alignSelf: 'start' }} /> : null}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
              {children ?? (
                <Typography variant="body2" color="text.secondary">
                  This section is scaffolded and will be expanded in the next checkpoint.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
