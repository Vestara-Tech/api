import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { aiApi, type ActivityExecutionSummaryShape, type ActivityHistoryQueryShape } from '../../api/aiApi';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  'idle',
  'planning',
  'running',
  'awaiting-approval',
  'verifying',
  'completed',
  'failed',
  'cancelled',
] as const;

const COMPLEXITY_OPTIONS = ['simple', 'standard', 'complex'] as const;

const VERIFICATION_OPTIONS = ['pass', 'fail', 'indeterminate', 'pending'] as const;

function toneForStatus(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'running':
    case 'verifying':
    case 'planning':
      return 'info';
    case 'awaiting-approval':
      return 'warning';
    default:
      return 'neutral';
  }
}

function statusChipColor(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  return toneToChipColor[toneForStatus(status)];
}

function toneForConclusion(conclusion: string): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  switch (conclusion) {
    case 'pass':
      return 'success';
    case 'fail':
      return 'error';
    case 'indeterminate':
      return 'warning';
    default:
      return 'neutral';
  }
}

function conclusionChipColor(conclusion: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  return toneToChipColor[toneForConclusion(conclusion)];
}

const toneToChipColor: Record<'neutral' | 'info' | 'success' | 'warning' | 'error', 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

function toFilterChips<T extends string>(values: readonly T[], selected: readonly T[], onToggle: (value: T) => void) {
  return values.map((value) => {
    const active = selected.includes(value);
    return (
      <Chip
        key={value}
        label={value}
        size="small"
        variant={active ? 'filled' : 'outlined'}
        color={active ? 'primary' : 'default'}
        clickable
        onClick={() => onToggle(value)}
      />
    );
  });
}

interface ExecutionBrowserProps {
  readonly onSelect?: (executionId: string) => void;
}

export function ExecutionBrowser({ onSelect }: ExecutionBrowserProps) {
  const [items, setItems] = useState<readonly ActivityExecutionSummaryShape[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<readonly string[]>([]);
  const [complexity, setComplexity] = useState<readonly ('simple' | 'standard' | 'complex')[]>([]);
  const [verification, setVerification] = useState<readonly ('pass' | 'fail' | 'indeterminate' | 'pending')[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const requestIdRef = useRef(0);

  const buildQuery = useCallback(
    (cursor?: string): ActivityHistoryQueryShape => {
      const query: ActivityHistoryQueryShape = {
        limit: PAGE_SIZE,
        sort,
        ...(search.trim() ? { goal: search.trim() } : {}),
        ...(status.length > 0 ? { status } : {}),
        ...(complexity.length > 0 ? { complexity } : {}),
        ...(verification.length > 0 ? { verification } : {}),
        ...(workflowId.trim() ? { workflowId: workflowId.trim() } : {}),
        ...(from ? { from: new Date(from).toISOString() } : {}),
        ...(to ? { to: new Date(to).toISOString() } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
      };
      return query;
    },
    [search, status, complexity, verification, workflowId, from, to, sort],
  );

  const runQuery = useCallback(
    async (cursor: string | undefined, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const page = await aiApi.activityHistoryBrowse(buildQuery(cursor));
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => (replace || cursor === undefined ? page.items : [...prev, ...page.items]));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : 'Failed to load execution history');
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    void runQuery(undefined, true);
  }, [runQuery]);

  const resetAndQuery = useCallback(() => {
    void runQuery(undefined, true);
  }, [runQuery]);

  const toggleStatus = useCallback((value: string) => {
    setStatus((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const toggleComplexity = useCallback((value: 'simple' | 'standard' | 'complex') => {
    setComplexity((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const toggleVerification = useCallback((value: 'pass' | 'fail' | 'indeterminate' | 'pending') => {
    setVerification((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  return (
    <Stack
      component="section"
      aria-label="Execution history"
      sx={{
        width: { lg: 340 },
        minWidth: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        maxHeight: 720,
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      <Box sx={{ p: 1.5, pb: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Execution browser
          </Typography>
          <Button size="small" onClick={resetAndQuery} disabled={loading}>
            Refresh
          </Button>
        </Stack>
        <TextField
          size="small"
          fullWidth
          placeholder="Search by goal"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mb: 1 }}
        />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
            Sort
          </Typography>
          {(['newest', 'oldest'] as const).map((value) => (
            <Chip
              key={value}
              label={value}
              size="small"
              variant={sort === value ? 'filled' : 'outlined'}
              color={sort === value ? 'primary' : 'default'}
              clickable
              onClick={() => setSort(value)}
            />
          ))}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Status
        </Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {toFilterChips(STATUS_OPTIONS, status, toggleStatus)}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Complexity
        </Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {toFilterChips(COMPLEXITY_OPTIONS, complexity, toggleComplexity)}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Verification
        </Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {toFilterChips(VERIFICATION_OPTIONS, verification, toggleVerification)}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
          <TextField
            size="small"
            label="Workflow"
            value={workflowId}
            onChange={(event) => setWorkflowId(event.target.value)}
            sx={{ flex: 1 }}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField size="small" label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {error ? <Typography sx={{ color: 'error.main', px: 1, py: 0.5 }}>{error}</Typography> : null}
        {!loading && !error && items.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', px: 1, py: 1 }}>No executions found.</Typography>
        ) : null}
        <Stack spacing={0.5}>
          {items.map((item) => (
            <Box
              key={item.executionId}
              onClick={() => onSelect?.(item.executionId)}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 1,
                cursor: onSelect ? 'pointer' : 'default',
                '&:hover': onSelect ? { borderColor: 'primary.main' } : undefined,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, wordBreak: 'break-word' }}>
                {item.goal}
              </Typography>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={item.status} size="small" color={statusChipColor(item.status)} variant="outlined" />
                <Chip label={`verify: ${item.verification.conclusion}`} size="small" color={conclusionChipColor(item.verification.conclusion)} variant="outlined" />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {item.complexity} · {item.changedFileCount} files
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {item.participants.length} participants
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
        {loading ? <Typography sx={{ color: 'text.secondary', px: 1, py: 1 }}>Loading…</Typography> : null}
        {hasMore && !loading ? (
          <Box sx={{ p: 1 }}>
            <Button size="small" fullWidth variant="outlined" onClick={() => void runQuery(nextCursor, false)}>
              Load more
            </Button>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
}