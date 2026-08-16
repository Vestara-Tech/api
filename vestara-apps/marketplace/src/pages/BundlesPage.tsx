import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { useBundles, useCreateBundle, useCreateDistribution, useDistributions, usePlanDistribution } from '../hooks/useMarketplaceV2';

export function BundlesPage() {
  const { data: bundles } = useBundles();
  const { data: distributions } = useDistributions();
  const createBundle = useCreateBundle();
  const createDistribution = useCreateDistribution();

  const [bundleName, setBundleName] = useState('');
  const [bundlePackages, setBundlePackages] = useState('');
  const [bundleResult, setBundleResult] = useState<string | null>(null);
  const [distName, setDistName] = useState('');
  const [distBundles, setDistBundles] = useState('');
  const [distResult, setDistResult] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string>('');
  const { data: plan } = usePlanDistribution(planId);

  const createBundleNow = async (): Promise<void> => {
    setBundleResult(null);
    const packages = bundlePackages.split(',').map((s) => s.trim()).filter(Boolean).map((packageId) => ({ packageId, required: true }));
    if (packages.length === 0) {
      setBundleResult('Provide at least one package.');
      return;
    }
    try {
      const bundle = await createBundle.mutateAsync({ name: bundleName, packages, recommended: [], optional: [], metadata: {} });
      setBundleResult(`Created bundle ${bundle.bundleId} (${bundle.name}).`);
      setBundleName('');
      setBundlePackages('');
    } catch (error) {
      setBundleResult(`Failed: ${(error as Error).message}`);
    }
  };

  const createDistributionNow = async (): Promise<void> => {
    setDistResult(null);
    const bundleIds = distBundles.split(',').map((s) => s.trim()).filter(Boolean).map((bundleId) => ({ bundleId, required: true }));
    if (bundleIds.length === 0) {
      setDistResult('Provide at least one bundle.');
      return;
    }
    try {
      const distribution = await createDistribution.mutateAsync({
        name: distName,
        bundles: bundleIds,
        packages: [],
        channel: 'stable',
        curatedBy: 'marketplace-ui',
        metadata: {},
      });
      setDistResult(`Created distribution ${distribution.distributionId}.`);
      setDistName('');
      setDistBundles('');
    } catch (error) {
      setDistResult(`Failed: ${(error as Error).message}`);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Inventory2Icon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Bundles & Distributions</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Curate packages into bundles, bundles into distributions, then review the install plan.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Create bundle</Typography>
          <Stack spacing={1.5}>
            <TextField label="Bundle name" value={bundleName} onChange={(e) => setBundleName(e.target.value)} />
            <TextField
              label="Packages (comma-separated packageIds)"
              value={bundlePackages}
              onChange={(e) => setBundlePackages(e.target.value)}
              placeholder="pkg.a, pkg.b"
            />
            <Button variant="contained" onClick={() => void createBundleNow()} disabled={createBundle.isPending}>Create</Button>
            {bundleResult !== null ? <Alert severity={bundleResult.startsWith('Failed') ? 'error' : 'success'}>{bundleResult}</Alert> : null}
          </Stack>
        </Box>
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Create distribution</Typography>
          <Stack spacing={1.5}>
            <TextField label="Distribution name" value={distName} onChange={(e) => setDistName(e.target.value)} />
            <TextField
              label="Bundles (comma-separated bundleIds)"
              value={distBundles}
              onChange={(e) => setDistBundles(e.target.value)}
              placeholder="bndl-..., bndl-..."
            />
            <Button variant="contained" onClick={() => void createDistributionNow()} disabled={createDistribution.isPending}>Create</Button>
            {distResult !== null ? <Alert severity={distResult.startsWith('Failed') ? 'error' : 'success'}>{distResult}</Alert> : null}
          </Stack>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Bundles ({bundles?.length ?? 0})</Typography>
          <Stack spacing={1}>
            {bundles?.map((bundle) => (
              <Box key={bundle.bundleId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
                <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{bundle.bundleId}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{bundle.name}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Chip size="small" label={`${bundle.packages.length} packages`} variant="outlined" />
                  <Chip size="small" label={`${bundle.recommended.length} recommended`} variant="outlined" />
                  {bundle.ai !== undefined && bundle.ai.length > 0 ? <Chip size="small" label={`${bundle.ai.length} AI`} variant="outlined" /> : null}
                </Stack>
              </Box>
            ))}
            {bundles?.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>No bundles yet.</Typography> : null}
          </Stack>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Distributions ({distributions?.length ?? 0})</Typography>
          <Stack spacing={1}>
            {distributions?.map((distribution) => (
              <Box key={distribution.distributionId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
                <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{distribution.distributionId}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{distribution.name}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center' }}>
                  <Chip size="small" label={distribution.channel} variant="outlined" />
                  <Chip size="small" label={`curated by ${distribution.curatedBy}`} variant="outlined" />
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" onClick={() => setPlanId(distribution.distributionId)}>Review plan</Button>
                  <Button size="small" component={Link} to={`/marketplace/install-review/${distribution.distributionId}`}>Install</Button>
                </Stack>
              </Box>
            ))}
            {distributions?.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>No distributions yet.</Typography> : null}
          </Stack>
        </Box>
      </Stack>

      {planId !== '' ? (
        <Box sx={{ mt: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Plan for <Typography component="span" sx={{ fontFamily: 'monospace' }}>{planId}</Typography>
          </Typography>
          {plan === undefined ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading plan…</Typography>
          ) : (
            <Stack spacing={0.5}>
              <Typography variant="body2"><strong>Required:</strong> {plan.required.join(', ') || 'none'}</Typography>
              <Typography variant="body2"><strong>Recommended:</strong> {plan.recommended.join(', ') || 'none'}</Typography>
              <Typography variant="body2"><strong>Optional:</strong> {plan.optional.join(', ') || 'none'}</Typography>
              {plan.ai.length > 0 ? <Typography variant="body2"><strong>AI add-ons:</strong> {plan.ai.join(', ')}</Typography> : null}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{plan.total} packages total.</Typography>
            </Stack>
          )}
        </Box>
      ) : null}
    </Box>
  );
}
