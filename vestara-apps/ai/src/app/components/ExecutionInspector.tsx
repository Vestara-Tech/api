import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { ActivityRoomExecutionRecordShape, ActivityRoomSnapshotShape } from '../../api/aiApi';
import { ExecutionStatusPill } from './ExecutionStatusPill';

interface ExecutionInspectorProps {
  readonly snapshot: ActivityRoomSnapshotShape | null;
  readonly currentAgentId: string;
  readonly currentAgentName: string;
  readonly running: boolean;
  readonly runId: string | null;
  readonly loading: boolean;
  readonly onRefresh: () => void;
  readonly drafts: readonly ActivityRoomExecutionRecordShape[];
}

export function ExecutionInspector({
  snapshot,
  currentAgentId,
  currentAgentName,
  running,
  runId,
  loading,
  onRefresh,
  drafts,
}: ExecutionInspectorProps) {
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Execution inspector
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Current agent, counts, and execution state.
          </Typography>
        </Box>
        <Button size="small" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {snapshot ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Snapshot generated {new Date(snapshot.generatedAt).toLocaleString()}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <ExecutionStatusPill label="Selected agent" value={currentAgentName} tone={running ? 'warning' : 'info'} detail={currentAgentId} />
          <ExecutionStatusPill label="Run" value={runId ?? 'idle'} tone={running ? 'warning' : 'neutral'} detail={running ? 'Current agent run is active.' : 'No active run.'} />
          <ExecutionStatusPill
            label="Agents"
            value={String(snapshot?.counts.agents ?? 0)}
            tone={snapshot ? 'info' : 'neutral'}
            detail={`${snapshot?.counts.activeAgentRuns ?? 0} active agent runs`}
          />
          <ExecutionStatusPill
            label="Workflows"
            value={String(snapshot?.counts.workflowRuns ?? 0)}
            tone={snapshot && snapshot.counts.activeWorkflowRuns > 0 ? 'warning' : 'neutral'}
            detail={`${snapshot?.counts.activeWorkflowRuns ?? 0} active workflow runs`}
          />
          <ExecutionStatusPill
            label="Approvals"
            value={String(snapshot?.counts.pendingApprovals ?? 0)}
            tone={(snapshot?.counts.pendingApprovals ?? 0) > 0 ? 'warning' : 'success'}
            detail={`${snapshot?.counts.approvals ?? 0} recorded approvals`}
          />
        </Stack>

        {snapshot ? (
          <>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Active agents
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {snapshot.agents.map((agent) => (
                  <Chip
                    key={agent.id}
                    label={`${agent.name} · ${agent.latestRunStatus ?? 'idle'}`}
                    variant={agent.id === currentAgentId ? 'filled' : 'outlined'}
                    size="small"
                    color={agent.latestRunStatus === 'failed' ? 'error' : agent.latestRunStatus === 'completed' ? 'success' : 'default'}
                  />
                ))}
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Workflow definitions
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {snapshot.workflowDefinitions.map((workflow) => (
                  <Chip key={workflow.id} label={`${workflow.name} · v${workflow.version}`} variant="outlined" size="small" />
                ))}
              </Stack>
            </Box>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No execution snapshot is available yet.
          </Typography>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Draft executions
          </Typography>
          <Stack spacing={1}>
            {drafts.slice(0, 3).map((draft) => (
              <Box key={draft.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 0.5, alignItems: 'center' }}>
                  <Chip label={draft.status} size="small" color={draft.status === 'planning' ? 'warning' : 'default'} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {draft.request.goal}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {draft.request.agentName ?? draft.request.agentId} · {draft.eventCount} events · updated {new Date(draft.updatedAt).toLocaleString()}
                </Typography>
              </Box>
            ))}
            {drafts.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No durable execution drafts yet.
              </Typography>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
