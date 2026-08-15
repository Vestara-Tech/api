import { Chip, MenuItem, Stack, TextField } from '@mui/material';

export interface ModelOption {
  readonly value: string;
  readonly label: string;
}

export interface ModelSelectorProps {
  readonly options: readonly ModelOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** ModelSelector — a simple model picker bound to the AI model catalog. */
export function ModelSelector({ options, value, onChange }: ModelSelectorProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <TextField
        select
        size="small"
        label="Model"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ minWidth: 220 }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <Chip size="small" label={`${options.length} available`} variant="outlined" />
    </Stack>
  );
}
