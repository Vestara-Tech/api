import type { ReactNode } from 'react';
import { Box, Divider, Stack, Typography, type SxProps, type Theme } from '@mui/material';

import { mergeSx } from '../utils/mergeSx.js';

export type KeyValueListLayout = 'stack' | 'grid';

export interface KeyValueItem {
  readonly label: ReactNode;
  readonly value: ReactNode;
}

export interface KeyValueListProps {
  readonly items: readonly KeyValueItem[];
  readonly layout?: KeyValueListLayout;
  readonly labelWidth?: number | string;
  readonly showDividers?: boolean;
  readonly sx?: SxProps<Theme>;
}

function resolveLabelWidth(labelWidth: number | string | undefined): string {
  if (labelWidth === undefined) return '180px';
  return typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth;
}

export function KeyValueList({
  items,
  layout = 'stack',
  labelWidth = 180,
  showDividers = layout === 'stack',
  sx,
}: KeyValueListProps) {
  if (items.length === 0) return null;

  if (layout === 'grid') {
    return (
      <Stack spacing={1} sx={sx}>
        {items.map((item, index) => (
          <Box
            key={index}
            sx={{
              display: 'grid',
              gridTemplateColumns: `${resolveLabelWidth(labelWidth)} minmax(0, 1fr)`,
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={0.75} sx={sx}>
      {items.map((item, index) => (
        <Box key={index} sx={{ display: 'grid', gap: 0.5 }}>
          {showDividers && index > 0 ? <Divider /> : null}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            {item.label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
