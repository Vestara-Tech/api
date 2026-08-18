import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { aiApi, type ActivityRoomExecutionRecordShape, type ActivityRoomSnapshotShape, type VerificationReportShape } from '../../api/aiApi';

interface ActivityRoomContextCardProps {
  readonly goal?: string;
}

function verificationTone(report: VerificationReportShape | ActivityRoomSnapshotShape['verification'] | null): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (!report) return 'default';
  if (report.result === 'pass') return 'success';
  if (report.result === 'fail') return 'error';
  return 'warning';
}

export function ActivityRoomContextCard({ goal }: ActivityRoomContextCardProps) {
  const [snapshot, setSnapshot] = useState<ActivityRoomSnapshotShape | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReportShape | null>(null);
  const [drafts, setDrafts] = useState<readonly ActivityRoomExecutionRecordShape[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snapshotResult, verificationResult, executionResult] = await Promise.allSettled([
        aiApi.activityRoomSnapshot(),
        aiApi.verificationLatest(),
        aiApi.activityRoomExecutions(),
      ]);
      setSnapshot(snapshotResult.status === 'fulfilled' ? snapshotResult.value : null);
      setVerificationReport(verificationResult.status === 'fulfilled' ? verificationResult.value : null);
      setDrafts(executionResult.status === 'fulfilled' ? executionResult.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const verification = verificationReport ?? snapshot?.verification ?? null;
  const activityRoomHref = goal ? `/ai/activity?goal=${encodeURIComponent(goal)}` : '/ai/activity';

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Activity Room
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Live execution context for chat and governed runs.
          </Typography>
        </Box>
        <Button component={RouterLink} to={activityRoomHref} variant="outlined" size="small">
          Open Activity Room
        </Button>
      </Stack>

      {goal ? (
        <Box sx={{ p: 1.25, mb: 1.5, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
            Goal handoff
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
            {goal}
          </Typography>
        </Box>
      ) : null}

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 1.5 }}>
        <Chip label={`${snapshot?.counts.agents ?? 0} agents`} size="small" variant="outlined" />
        <Chip label={`${snapshot?.counts.activeAgentRuns ?? 0} active runs`} size="small" variant="outlined" />
        <Chip label={`${snapshot?.counts.pendingApprovals ?? 0} approvals`} size="small" variant="outlined" />
        <Chip label={verification ? verification.result.toUpperCase() : 'UNKNOWN'} size="small" color={verificationTone(verification)} />
        {loading ? <Chip label="Refreshing…" size="small" color="info" variant="outlined" /> : null}
      </Stack>

      <Divider sx={{ mb: 1.5 }} />

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Verification
          </Typography>
          {verification ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip label={`Level ${verification.level}`} size="small" variant="outlined" />
                <Chip label={verification.graphValid ? 'Graph valid' : 'Graph invalid'} size="small" variant="outlined" color={verification.graphValid ? 'success' : 'error'} />
                <Chip label={`${verification.selectedTests}/${verification.executedTests} tests`} size="small" variant="outlined" />
                <Chip label={`${verification.cached} cached`} size="small" variant="outlined" />
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Scope: {verification.scope}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Duration: {Math.round(verification.durationMs / 1000)}s
              </Typography>
              {verification.evidence ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  Evidence: {verification.evidence}
                </Typography>
              ) : null}
              {verification.fingerprint ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                  Fingerprint: {verification.fingerprint}
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No verification report is available yet.
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Recent drafts
          </Typography>
          <Stack spacing={1}>
            {drafts.slice(0, 3).map((draft) => (
              <Box key={draft.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 0.5, alignItems: 'center' }}>
                  <Chip label={draft.status} size="small" variant="outlined" />
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
