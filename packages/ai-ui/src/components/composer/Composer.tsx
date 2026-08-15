import { useState, type KeyboardEvent } from 'react';
import { Box, Button, Stack, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export interface ComposerProps {
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly onSend: (text: string) => void;
}

/** Composer — the shared message input used by AI Chat and Test Agent. */
export function Composer({ disabled, placeholder = 'Message…', onSend }: ComposerProps) {
  const [value, setValue] = useState('');

  const submit = (): void => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
      <TextField
        fullWidth
        multiline
        minRows={1}
        maxRows={6}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button variant="contained" onClick={submit} disabled={disabled || !value.trim()} startIcon={<SendIcon />}>
        Send
      </Button>
    </Stack>
  );
}
