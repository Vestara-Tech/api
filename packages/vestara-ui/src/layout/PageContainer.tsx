import type { ReactNode } from 'react';
import { Box, Container, Stack, Typography, type ContainerProps, type SxProps, type Theme } from '@mui/material';

import { mergeSx } from '../utils/mergeSx.js';

export interface PageContainerProps extends Omit<ContainerProps, 'children' | 'title'> {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly sx?: SxProps<Theme>;
}

export function PageContainer({
  title,
  description,
  actions,
  children,
  maxWidth = 'xl',
  sx,
  ...props
}: PageContainerProps) {
  return (
    <Container maxWidth={maxWidth} {...props} sx={mergeSx({ py: 3 }, sx)}>
      {(title !== undefined || description !== undefined || actions !== undefined) ? (
        <Box sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              {title ? (
                <Typography variant="h5" noWrap sx={{ fontWeight: 800 }}>
                  {title}
                </Typography>
              ) : null}
              {description ? (
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              ) : null}
            </Box>
            {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
          </Stack>
        </Box>
      ) : null}
      {children}
    </Container>
  );
}
