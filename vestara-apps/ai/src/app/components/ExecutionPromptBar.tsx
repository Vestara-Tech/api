import { Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface ExecutionAgentOption {
  readonly id: string;
  readonly name: string;
}

interface ExecutionPromptBarProps {
  readonly agentId: string;
  readonly goal: string;
  readonly running: boolean;
  readonly agents: readonly ExecutionAgentOption[];
  readonly onAgentChange: (agentId: string) => void;
  readonly onGoalChange: (goal: string) => void;
  readonly onRun: () => void;
  readonly suggestions?: readonly string[];
}

const DEFAULT_SUGGESTIONS = ['Build the Theme Builder', 'Generate a TypeScript script', 'Fix this API endpoint'];

export function ExecutionPromptBar({
  agentId,
  goal,
  running,
  agents,
  onAgentChange,
  onGoalChange,
  onRun,
  suggestions = DEFAULT_SUGGESTIONS,
}: ExecutionPromptBarProps) {
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <TextField
          select
          size="small"
          label="Agent"
          value={agentId}
          onChange={(e) => onAgentChange(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {agents.map((agent) => (
            <MenuItem key={agent.id} value={agent.id}>
              {agent.name}
            </MenuItem>
          ))}
        </TextField>
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
          {running ? 'Running…' : 'Run Agent'}
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
