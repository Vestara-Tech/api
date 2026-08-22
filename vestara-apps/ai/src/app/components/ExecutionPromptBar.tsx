import { Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface ExecutionAgentOption {
  readonly id: string;
  readonly name: string;
}

interface ExecutionPromptBarProps {
  readonly goal: string;
  readonly running: boolean;
  readonly onGoalChange: (goal: string) => void;
  readonly onRun: () => void;
  readonly agentId?: string;
  readonly agents?: readonly ExecutionAgentOption[];
  readonly onAgentChange?: (agentId: string) => void;
  readonly suggestions?: readonly string[];
}

const DEFAULT_SUGGESTIONS = ['Build the Theme Builder', 'Generate a TypeScript script', 'Fix this API endpoint'];

export function ExecutionPromptBar({
  goal,
  running,
  onGoalChange,
  onRun,
  agentId,
  agents,
  onAgentChange,
  suggestions = DEFAULT_SUGGESTIONS,
}: ExecutionPromptBarProps) {
  const showAgentSelector = agents !== undefined && agents.length > 0 && agentId !== undefined && onAgentChange !== undefined;
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        {showAgentSelector ? (
          <TextField
            select
            size="small"
            label="Agent"
            value={agentId}
            onChange={(e) => onAgentChange(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {agents!.map((agent) => (
              <MenuItem key={agent.id} value={agent.id}>
                {agent.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          size="small"
          fullWidth
          label="Objective"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRun();
          }}
        />
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onRun} disabled={running || !goal.trim()}>
          {running ? 'Running…' : 'Run'}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary', mr: 0.5 }}>
          Try:
        </Typography>
        {suggestions.map((suggestion) => (
          <Chip key={suggestion} label={suggestion} size="small" variant="outlined" onClick={() => onGoalChange(suggestion)} />
        ))}
      </Stack>
    </Stack>
  );
}
