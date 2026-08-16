import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { marketplaceApi } from '../api/marketplaceApi';
import { marketplaceV2Api, type InstallPlan } from '../api/marketplaceV2Api';
import { useDistributions, usePlanDistribution } from '../hooks/useMarketplaceV2';

export function InstallReviewPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const { data: distributions } = useDistributions();
  const { data: plan, isLoading } = usePlanDistribution(distributionId ?? '');
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);

  const distribution = distributions?.find((d) => d.distributionId === distributionId);

  const refreshPending = useCallback(() => {
    void marketplaceApi.installed().then((installed) => {
      const ids = new Set(installed.map((i) => i.packageId));
      const wanted = new Set((plan?.required ?? []).concat(plan?.recommended ?? []));
      setPending([...wanted].filter((id) => !ids.has(id)));
    }).catch(() => undefined);
  }, [plan]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const installAll = async (): Promise<void> => {
    setResult(null);
    for (const packageId of pending) {
      try {
        await marketplaceApi.install(packageId, true);
      } catch (error) {
        setResult(`Failed installing ${packageId}: ${(error as Error).message}`);
        return;
      }
    }
    setResult(`Installed ${pending.length} package${pending.length === 1 ? '' : 's'}.`);
    refreshPending();
  };

  const renderGroup = (title: string, ids: readonly string[], color: 'info' | 'success' | 'default') => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={0.5}>
        {ids.map((id) => (
          <Stack key={id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip size="small" label={color} color={color} variant="outlined" />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{id}</Typography>
            {pending.includes(id) ? <Chip size="small" label="pending install" variant="outlined" /> : <Chip size="small" label="installed" color="success" />}
          </Stack>
        ))}
        {ids.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>None.</Typography> : null}
      </Stack>
    </Box>
  );

  if (!distributionId) return null;
  if (isLoading || !plan) {
    return <Box sx={{ p: 3 }}><Typography sx={{ color: 'text.secondary' }}>Loading install plan…</Typography></Box>;
  }

  const summary: InstallPlan = plan;

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <PlaylistAddCheckIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Installation Review</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Distribution <Typography component="span" sx={{ fontFamily: 'monospace' }}>{distribution?.name ?? distributionId}</Typography>
        {' — '}{summary.total} packages in the plan.
      </Typography>

      {result !== null ? <Alert severity={result.startsWith('Failed') ? 'error' : 'success'} sx={{ mb: 2 }}>{result}</Alert> : null}

      {renderGroup('Required', summary.required, 'info')}
      {renderGroup('Recommended', summary.recommended, 'success')}
      {renderGroup('Optional', summary.optional, 'default')}
      {summary.ai.length > 0 ? renderGroup('AI add-ons', summary.ai, 'default') : null}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="contained" color="primary" onClick={() => void installAll()} disabled={pending.length === 0}>
          Install {pending.length} pending
        </Button>
        <Button variant="outlined" onClick={refreshPending}>Refresh</Button>
      </Stack>
    </Box>
  );
}
