import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';

import type { AdminCommand } from '../navigation/navigation.js';

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly commands: readonly AdminCommand[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      [command.label, command.description, ...command.keywords].some((value) => value.toLowerCase().includes(q)),
    );
  }, [commands, query]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Command palette</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            inputRef={inputRef}
            autoComplete="off"
            autoFocus
            label="Search commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type to navigate"
          />
          <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
            <List disablePadding>
              {filtered.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No commands match your query.
                  </Typography>
                </Box>
              ) : (
                filtered.map((command) => (
                  <ListItemButton
                    key={command.id}
                    onClick={() => {
                      if (!command.available) return;
                      command.onSelect?.();
                      onClose();
                    }}
                    disabled={!command.available}
                  >
                    <ListItemText primary={command.label} secondary={command.description} />
                  </ListItemButton>
                ))
              )}
            </List>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
