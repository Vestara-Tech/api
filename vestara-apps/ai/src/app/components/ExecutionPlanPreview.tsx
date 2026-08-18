import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ActivityRoomExecutionPlanShape } from '../../api/aiApi';

interface ExecutionPlanPreviewProps {
  readonly preview: ActivityRoomExecutionPlanShape | null;
  readonly running: boolean;
}

function toneForStatus(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const value = status.toLowerCase();
  if (['completed', 'pass'].includes(value)) return 'success';
  if (['failed', 'error'].includes(value)) return 'error';
  if (['planning', 'requested', 'awaiting-approval', 'queued', 'running', 'blocked', 'reviewing', 'verifying'].includes(value)) return 'warning';
  return 'info';
}

export function ExecutionPlanPreview({ preview, running }: ExecutionPlanPreviewProps) {
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Execution plan preview
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {preview ? preview.summary : 'Enter an objective to preview the governed execution path.'}
          </Typography>
        </Box>
        <Chip label={running ? 'running' : preview?.status ?? 'idle'} size="small" color={toneForStatus(preview?.status ?? (running ? 'running' : 'idle'))} />
      </Stack>

      {preview ? (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip label={preview.intent.kind} size="small" color="info" />
            <Chip label={preview.intent.target} size="small" variant="outlined" />
            <Chip label={`${Math.round(preview.intent.confidence * 100)}% confidence`} size="small" variant="outlined" />
            <Chip label={preview.intent.complexity} size="small" variant="outlined" />
            {preview.capabilities.map((capability) => (
              <Chip key={capability.namespace} label={capability.namespace} size="small" variant="outlined" />
            ))}
          </Stack>

          {preview.intent.ambiguities.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
                Ambiguities
              </Typography>
              <Stack spacing={0.75}>
                {preview.intent.ambiguities.map((ambiguity) => (
                  <Box key={ambiguity.code} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {ambiguity.code}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {ambiguity.message}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Milestones
            </Typography>
            <Stack spacing={1}>
              {preview.milestones.map((milestone) => (
                <Box key={milestone.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {milestone.title}
                  </Typography>
                  <Stack spacing={0.75}>
                    {milestone.steps.map((step) => (
                      <Box key={step.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 0.5, alignItems: 'center' }}>
                          <Chip label={step.role} size="small" variant="outlined" />
                          <Chip label={step.capability} size="small" variant="outlined" />
                          {step.requiresApproval ? <Chip label="approval" size="small" color="warning" /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {step.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {step.operation}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
              Evidence expected
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {preview.evidence.map((item) => (
                <Chip key={item} label={item} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>

          {preview.warnings.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
                Warnings
              </Typography>
              <Stack spacing={0.75}>
                {preview.warnings.map((warning) => (
                  <Box key={warning} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {warning}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}
