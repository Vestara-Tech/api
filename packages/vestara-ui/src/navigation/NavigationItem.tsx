import type { ReactNode } from 'react';
import type { ListItemButtonProps } from '@mui/material/ListItemButton';
import { Box, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';

import { mergeSx } from '../utils/mergeSx.js';

export interface NavigationItemDefinition {
  readonly id: string;
  readonly label: ReactNode;
  readonly href?: string;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly badge?: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
}

export interface NavigationItemProps extends Omit<ListItemButtonProps, 'children'> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly badge?: ReactNode;
  readonly icon?: ReactNode;
  readonly compact?: boolean;
}

export function NavigationItem({
  label,
  description,
  badge,
  icon,
  compact = false,
  sx,
  ...props
}: NavigationItemProps) {
  return (
    <ListItemButton
      {...props}
      sx={mergeSx(
        {
          gap: 1,
          minHeight: compact ? 40 : 44,
          px: compact ? 1 : 1.5,
          py: compact ? 0.75 : 1,
          borderRadius: 1.5,
          alignItems: 'center',
          '&.Mui-selected': {
            bgcolor: 'action.selected',
            '&:hover': { bgcolor: 'action.selected' },
          },
        },
        sx,
      )}
    >
      {icon ? (
        <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
          {icon}
        </ListItemIcon>
      ) : null}
      <ListItemText
        primary={
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
        }
        secondary={
          compact || description === undefined ? null : (
            <Typography variant="caption" color="text.secondary" noWrap>
              {description}
            </Typography>
          )
        }
        sx={{ my: 0 }}
      />
      {badge ? <Box sx={{ ml: 'auto' }}>{badge}</Box> : null}
    </ListItemButton>
  );
}
