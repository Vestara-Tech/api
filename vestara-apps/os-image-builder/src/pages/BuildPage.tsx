import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useImageBuilder } from '../context/ImageBuilderContext';
import { useBuild, useBuildPlan } from '../hooks/useImage';
import { IMAGE_TARGETS } from '../types/domain';

const stageLabel: Record<string, string> = {
  'resolve-profile': 'Resolve Profile',
  validate: 'Validate',
  'resolve-packages': 'Resolve Packages',
  bootstrap: 'Bootstrap Debian',
  'install-kernel': 'Install Kernel',
  'install-runtime': 'Install Vestara Runtime',
  'install-apps': 'Install Applications',
  'configure-systemd': 'Configure systemd',
  'configure-login': 'Configure Login',
  'configure-grub': 'Configure GRUB',
  'install-plymouth': 'Install Plymouth',
  'configure-ab': 'Configure A/B',
  'build-recovery': 'Build Recovery',
  'configure-firstboot': 'Configure First Boot',
  'generate-initramfs': 'Generate initramfs',
  'install-bootloader': 'Install Bootloader',
  sanitize: 'Sanitize',
  verify: 'Verify Filesystem',
  'generate-sbom': 'Generate SBOM',
  'generate-evidence': 'Generate Evidence',
  seal: 'Seal Evidence',
  export: 'Export Image',
};

export function BuildPage() {
  const { profile } = useImageBuilder();
  const build = useBuild();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const target = 'raw';
  const { data: plan } = useBuildPlan(profile?.id ?? '', target);
  const stages = useMemo(() => plan?.items ?? [], [plan]);

  if (!profile) return null;

  const result = build.data;
  const completed = result?.state.completedStages ?? [];
  const current = result?.state.currentStage ?? null;
  const running = build.isPending;
  const status = result?.state.status ?? 'draft';

  const percent = stages.length ? Math.round((completed.length / stages.length) * 100) : 0;

  const handleBuild = async () => {
    setConfirmOpen(false);
    await build.mutateAsync({ profileId: profile.id, target });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Build — {profile.id}@{profile.version}
        </Typography>
        <Chip
          label={running ? 'RUNNING' : status === 'completed' ? 'COMPLETED' : status.toUpperCase()}
          color={running ? 'info' : status === 'completed' ? 'success' : 'default'}
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Target: {IMAGE_TARGETS.find((t) => t.value === target)?.label} · {stages.length} stages
      </Typography>

      {running || (status === 'completed' && completed.length > 0) ? (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between',  mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {percent}%
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {completed.length} / {stages.length} stages
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={percent} />
        </Box>
      ) : null}

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', mb: 2 }}>
        {stages.map((item) => {
          const done = completed.includes(item.stage);
          const isCurrent = current === item.stage;
          return (
            <Stack
              key={item.stage}
              direction="row"
              spacing={1}
              sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', ':last-child': { borderBottom: 'none' }, cursor: 'pointer', alignItems: 'center' }}
              onClick={() => setSelectedStage(item.stage)}
            >
              {done ? (
                <CheckCircleIcon fontSize="small" color="success" />
              ) : isCurrent ? (
                <BuildCircleIcon fontSize="small" color="info" />
              ) : (
                <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              )}
              <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 220 }}>
                {stageLabel[item.stage] ?? item.stage}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, fontSize: 13 }}>
                {item.description}
              </Typography>
              {isCurrent ? <Chip size="small" label="●" color="info" /> : null}
            </Stack>
          );
          })}
        {stages.length === 0 ? (
          <Typography sx={{ p: 2, color: 'text.secondary' }}>Compiling plan…</Typography>
        ) : null}
      </Box>

      {result ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2, mb: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Evidence</Typography>
          <Stack spacing={0.5}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Artifact</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{result.evidence.artifactPath}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Plan hash</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{result.evidence.planHash.slice(0, 16)}…</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Evidence hash</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{result.evidence.evidenceHash.slice(0, 16)}…</Typography>
            </Stack>
          </Stack>
        </Box>
      ) : null}

      {build.isError ? <Alert severity="error">{(build.error as Error).message}</Alert> : null}

      <Button
        variant="contained"
        startIcon={<BuildCircleIcon />}
        onClick={() => setConfirmOpen(true)}
        disabled={running || stages.length === 0}
      >
        {running ? 'Building…' : 'Start Build'}
      </Button>

      <Dialog open={selectedStage !== null} onClose={() => setSelectedStage(null)}>
        <DialogTitle>Stage details</DialogTitle>
        <DialogContent>
          {(() => {
            const item = stages.find((s) => s.stage === selectedStage);
            if (!item) return null;
            return (
              <Box>
                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                  {stageLabel[item.stage] ?? item.stage}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  {item.description}
                </Typography>
                {item.generated.length > 0 ? (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 600 }}>
                      Generated artifacts
                    </Typography>
                    {item.generated.map((g) => (
                      <Typography key={g} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {g}
                      </Typography>
                    ))}
                  </>
                ) : null}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedStage(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Start governed build?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Builds are governed and require approval. {profile.id}@v{profile.version} will run all
            {stages.length} stages and seal deterministic evidence.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleBuild()}>
            Approve & Build
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
