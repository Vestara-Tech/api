import { useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import UpdateIcon from '@mui/icons-material/Update';
import { marketplaceV2Api, type UpdateEvaluation } from '../api/marketplaceV2Api';
import { useVersions } from '../hooks/useMarketplaceV2';

const CHANNELS = ['stable', 'beta', 'development', 'canary'] as const;

export function UpdatesPage() {
  const [packageId, setPackageId] = useState('');
  const { data: versions } = useVersions(packageId);

  const [policyInput, setPolicyInput] = useState({ packageId: '', policy: 'manual', channel: 'stable', blockMajor: false });
  const [evalInput, setEvalInput] = useState({ packageId: '', currentVersion: '1.0.0', latestVersion: '2.0.0', channel: 'stable' });
  const [policyResult, setPolicyResult] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<readonly UpdateEvaluation[]>([]);

  const setPolicy = async (): Promise<void> => {
    setPolicyResult(null);
    if (!policyInput.packageId) {
      setPolicyResult('Package ID required.');
      return;
    }
    try {
      const saved = await marketplaceV2Api.setUpdatePolicy(policyInput);
      setPolicyResult(`Policy for ${saved.packageId}: ${saved.policy} @ ${saved.channel}.`);
    } catch (error) {
      setPolicyResult(`Failed: ${(error as Error).message}`);
    }
  };

  const evaluate = async (): Promise<void> => {
    setPolicyResult(null);
    if (!evalInput.packageId) {
      setPolicyResult('Package ID required.');
      return;
    }
    try {
      const result = await marketplaceV2Api.evaluateUpdate(evalInput);
      setEvaluations((list) => [result, ...list.filter((e) => e.packageId !== result.packageId)]);
    } catch (error) {
      setPolicyResult(`Failed: ${(error as Error).message}`);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <UpdateIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Updates</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Version channels, update policies (auto/prompt/manual/hold) and update evaluations per package.
      </Typography>

      {policyResult !== null ? <Alert severity={policyResult.startsWith('Failed') ? 'error' : 'success'} sx={{ mb: 2 }}>{policyResult}</Alert> : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Set update policy</Typography>
          <Stack spacing={1.5}>
            <TextField label="Package ID" value={policyInput.packageId} onChange={(e) => setPolicyInput((i) => ({ ...i, packageId: e.target.value }))} />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {['auto', 'prompt', 'manual', 'hold'].map((policy) => (
                <Chip
                  key={policy}
                  size="small"
                  label={policy}
                  color={policyInput.policy === policy ? 'primary' : 'default'}
                  variant={policyInput.policy === policy ? 'filled' : 'outlined'}
                  onClick={() => setPolicyInput((i) => ({ ...i, policy }))}
                  clickable
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField label="Channel" value={policyInput.channel} onChange={(e) => setPolicyInput((i) => ({ ...i, channel: e.target.value }))} sx={{ flex: 1 }} />
              <Chip
                size="small"
                label={policyInput.blockMajor ? 'Block major' : 'Allow major'}
                color={policyInput.blockMajor ? 'warning' : 'default'}
                variant={policyInput.blockMajor ? 'filled' : 'outlined'}
                onClick={() => setPolicyInput((i) => ({ ...i, blockMajor: !i.blockMajor }))}
                clickable
              />
            </Stack>
            <Button variant="contained" onClick={() => void setPolicy()}>Save policy</Button>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Evaluate update</Typography>
          <Stack spacing={1.5}>
            <TextField label="Package ID" value={evalInput.packageId} onChange={(e) => setEvalInput((i) => ({ ...i, packageId: e.target.value }))} />
            <Stack direction="row" spacing={1}>
              <TextField label="Current version" value={evalInput.currentVersion} onChange={(e) => setEvalInput((i) => ({ ...i, currentVersion: e.target.value }))} />
              <TextField label="Latest version" value={evalInput.latestVersion} onChange={(e) => setEvalInput((i) => ({ ...i, latestVersion: e.target.value }))} />
              <TextField label="Channel" value={evalInput.channel} onChange={(e) => setEvalInput((i) => ({ ...i, channel: e.target.value }))} sx={{ width: 130 }} />
            </Stack>
            <Button variant="contained" onClick={() => void evaluate()}>Evaluate</Button>
          </Stack>
        </Box>
      </Stack>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Evaluations</Typography>
        {evaluations.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Run an evaluation to see policy decisions.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Current</TableCell>
                <TableCell>Latest</TableCell>
                <TableCell>Policy</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {evaluations.map((e) => (
                <TableRow key={`${e.packageId}:${e.latestVersion}`}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{e.packageId}</TableCell>
                  <TableCell>{e.currentVersion}</TableCell>
                  <TableCell>{e.latestVersion}</TableCell>
                  <TableCell><Chip size="small" label={e.policy} variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip size="small" label={e.action} color={e.action === 'update' ? 'success' : e.action === 'block' ? 'error' : 'default'} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{e.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Versions for a package</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField label="Package ID" value={packageId} onChange={(e) => setPackageId(e.target.value)} sx={{ flex: 1 }} />
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {versions?.map((v) => (
            <Chip key={`${v.packageId}:${v.version}:${v.channel}`} size="small" label={`${v.version} @ ${v.channel}`} variant="outlined" color={CHANNELS.includes(v.channel as never) ? 'info' : 'default'} />
          ))}
          {packageId && versions?.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>No versions recorded for {packageId}.</Typography> : null}
        </Stack>
      </Box>
    </Box>
  );
}
