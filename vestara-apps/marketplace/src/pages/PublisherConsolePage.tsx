import { useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { usePublish, usePublished, usePublishers, useRegisterPublisher } from '../hooks/useMarketplaceV2';

export function PublisherConsolePage() {
  const { data: publishers } = usePublishers();
  const { data: published } = usePublished();
  const register = useRegisterPublisher();
  const publish = usePublish();

  const [publisherId, setPublisherId] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [trustLevel, setTrustLevel] = useState('trusted');
  const [publishInput, setPublishInput] = useState({
    packageId: '',
    version: '1.0.0',
    kind: 'ai.agent',
    publisherId: '',
    buildId: '',
    securityScanId: '',
    compatibilityHash: '',
    channel: 'stable',
  });
  const [result, setResult] = useState<string | null>(null);

  const registerNow = async (): Promise<void> => {
    setResult(null);
    if (!publisherId || !publisherName) {
      setResult('Publisher ID and name are required.');
      return;
    }
    try {
      await register.mutateAsync({ publisherId, name: publisherName, trustLevel, verified: trustLevel !== 'untrusted' });
      setResult(`Registered publisher ${publisherName}.`);
    } catch (error) {
      setResult(`Failed: ${(error as Error).message}`);
    }
  };

  const publishNow = async (): Promise<void> => {
    setResult(null);
    const missing = (Object.entries(publishInput) as [string, string][])
      .filter(([key, value]) => value.length === 0 && key !== 'securityScanId' && key !== 'compatibilityHash')
      .map(([key]) => key);
    if (missing.length > 0) {
      setResult(`Missing: ${missing.join(', ')}.`);
      return;
    }
    try {
      const outcome = await publish.mutateAsync(publishInput);
      setResult(outcome.ok ? `Published ${publishInput.packageId}@${publishInput.version} (signature ${outcome.published?.signature}).` : `Rejected: ${outcome.reason}`);
    } catch (error) {
      setResult(`Failed: ${(error as Error).message}`);
    }
  };

  const setPublishField = (key: keyof typeof publishInput, value: string): void => {
    setPublishInput((input) => ({ ...input, [key]: value }));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <StorefrontIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Publisher Console</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Register publishers with trust levels, publish signed packages, and inspect the release log.
      </Typography>

      {result !== null ? <Alert severity={result.startsWith('Failed') || result.startsWith('Missing') || result.startsWith('Rejected') ? 'error' : 'success'} sx={{ mb: 2 }}>{result}</Alert> : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Register publisher</Typography>
          <Stack spacing={1.5}>
            <TextField label="Publisher ID" value={publisherId} onChange={(e) => setPublisherId(e.target.value)} />
            <TextField label="Name" value={publisherName} onChange={(e) => setPublisherName(e.target.value)} />
            <Stack direction="row" spacing={1}>
              {['untrusted', 'trusted', 'verified', 'first-party'].map((level) => (
                <Chip
                  key={level}
                  size="small"
                  label={level}
                  color={trustLevel === level ? 'primary' : 'default'}
                  variant={trustLevel === level ? 'filled' : 'outlined'}
                  onClick={() => setTrustLevel(level)}
                  clickable
                />
              ))}
            </Stack>
            <Button variant="contained" onClick={() => void registerNow()} disabled={register.isPending}>Register</Button>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Publish package</Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField label="Package ID" value={publishInput.packageId} onChange={(e) => setPublishField('packageId', e.target.value)} sx={{ flex: 1 }} />
              <TextField label="Version" value={publishInput.version} onChange={(e) => setPublishField('version', e.target.value)} sx={{ width: 100 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Kind" value={publishInput.kind} onChange={(e) => setPublishField('kind', e.target.value)} sx={{ flex: 1 }} />
              <TextField label="Publisher ID" value={publishInput.publisherId} onChange={(e) => setPublishField('publisherId', e.target.value)} sx={{ flex: 1 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Build ID" value={publishInput.buildId} onChange={(e) => setPublishField('buildId', e.target.value)} sx={{ flex: 1 }} />
              <TextField label="Channel" value={publishInput.channel} onChange={(e) => setPublishField('channel', e.target.value)} sx={{ width: 130 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Security scan ID" value={publishInput.securityScanId} onChange={(e) => setPublishField('securityScanId', e.target.value)} sx={{ flex: 1 }} />
              <TextField label="Compat hash" value={publishInput.compatibilityHash} onChange={(e) => setPublishField('compatibilityHash', e.target.value)} sx={{ flex: 1 }} />
            </Stack>
            <Button variant="contained" onClick={() => void publishNow()} disabled={publish.isPending}>Publish</Button>
          </Stack>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Publishers ({publishers?.length ?? 0})</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Trust</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {publishers?.map((p) => (
                <TableRow key={p.publisherId}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{p.publisherId}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.trustLevel} color={p.verified ? 'success' : 'default'} variant={p.verified ? 'filled' : 'outlined'} />
                  </TableCell>
                </TableRow>
              ))}
              {publishers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>No publishers registered.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Published ({published?.length ?? 0})</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Trust</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {published?.map((p) => (
                <TableRow key={`${p.packageId}@${p.version}`}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{p.packageId}</TableCell>
                  <TableCell>{p.version}</TableCell>
                  <TableCell><Chip size="small" label={p.channel} variant="outlined" /></TableCell>
                  <TableCell><Chip size="small" label={p.trustLevel} variant="outlined" /></TableCell>
                </TableRow>
              ))}
              {published?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>Nothing published yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Box>
  );
}
