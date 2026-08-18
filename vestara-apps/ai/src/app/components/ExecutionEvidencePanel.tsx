import { Box, Chip, Stack, Typography } from '@mui/material';
import type { VerificationReportShape } from '../../api/aiApi';

interface ExecutionEvidencePanelProps {
  readonly verification: VerificationReportShape | null;
  readonly snapshotVerification?: {
    readonly level: string;
    readonly result: 'pass' | 'fail' | 'indeterminate';
    readonly scope: string;
    readonly graphValid: boolean;
    readonly selectedTests: number;
    readonly executedTests: number;
    readonly cached: number;
    readonly durationMs: number;
    readonly evidence: string | null;
    readonly fingerprint?: string | null;
  } | null;
}

function toneForResult(result: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const value = result.toLowerCase();
  if (value === 'pass') return 'success';
  if (value === 'fail') return 'error';
  if (value === 'indeterminate') return 'warning';
  return 'info';
}

export function ExecutionEvidencePanel({ verification, snapshotVerification }: ExecutionEvidencePanelProps) {
  const active = verification ?? snapshotVerification ?? null;

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
        Execution evidence
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        VCTRL verification and the evidence record used by the Activity Room verifier.
      </Typography>

      {active ? (
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={active.result.toUpperCase()} size="small" color={toneForResult(active.result)} />
            <Chip label={`Level ${active.level}`} size="small" variant="outlined" />
            <Chip label={active.graphValid ? 'Graph valid' : 'Graph invalid'} size="small" variant="outlined" color={active.graphValid ? 'success' : 'error'} />
            {verification ? (
              <Chip label={verification.verified ? 'Verified' : 'Unverified'} size="small" variant="outlined" color={verification.verified ? 'success' : 'warning'} />
            ) : null}
            <Chip label={`${active.selectedTests}/${active.executedTests} tests`} size="small" variant="outlined" />
            <Chip label={`${active.cached} cached`} size="small" variant="outlined" />
            {verification ? <Chip label={`${verification.graphIssues.length} graph issues`} size="small" variant="outlined" /> : null}
          </Stack>

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Scope: {active.scope}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Duration: {Math.round(active.durationMs / 1000)}s
          </Typography>

          <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
              Evidence
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {active.evidence ?? 'none'}
            </Typography>
            {active.fingerprint ? (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.75, wordBreak: 'break-all' }}>
                Fingerprint: {active.fingerprint}
              </Typography>
            ) : null}
          </Box>

          {verification && verification.reportPath ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
              Report: {verification.reportPath}
            </Typography>
          ) : null}

          {verification && verification.graphIssues.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Graph issues
              </Typography>
              <Stack spacing={0.75}>
                {verification.graphIssues.map((issue, index) => (
                  <Box key={`${issue.code}:${index}`} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 0.5, alignItems: 'center' }}>
                      <Chip label={issue.severity} size="small" color={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {issue.code}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {issue.message}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : verification ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No graph issues recorded.
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No verification report is available yet.
        </Typography>
      )}
    </Box>
  );
}
