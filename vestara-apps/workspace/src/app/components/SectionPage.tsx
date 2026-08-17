import { Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { PageContainer } from '@vestara/ui';

import { PageBreadcrumbs, type BreadcrumbItem } from './PageBreadcrumbs.js';

export interface SectionPageProps {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly note?: string;
  readonly children?: ReactNode;
}

export function SectionPage({ title, description, breadcrumbs, note, children }: SectionPageProps) {
  return (
    <PageContainer title={title} description={description}>
      <Stack spacing={2}>
        <PageBreadcrumbs items={breadcrumbs} />
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {note ?? 'This section is part of the Vestara Workspace authoring shell.'}
            </Typography>
            {children}
          </Stack>
        </Paper>
      </Stack>
    </PageContainer>
  );
}

