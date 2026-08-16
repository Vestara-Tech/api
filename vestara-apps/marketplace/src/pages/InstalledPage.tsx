import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import { marketplaceApi, type InstalledView } from '../api/marketplaceApi';
import { marketplaceV2Api, type UpdateImpact } from '../api/marketplaceV2Api';

export function InstalledPage() {
  const [installed, setInstalled] = useState<readonly InstalledView[]>([]);
  const [impact, setImpact] = useState<UpdateImpact | null>(null);
  const [impactPackage, setImpactPackage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    void marketplaceApi.installed().then(setInstalled).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, op: 'enable' | 'disable' | 'update' | 'uninstall'): Promise<void> => {
    setMessage(null);
    try {
      if (op === 'enable') await marketplaceApi.enable(id);
      else if (op === 'disable') await marketplaceApi.disable(id);
      else if (op === 'update') {
        const result = await marketplaceApi.update(id);
        setMessage(`Updated ${id} ${result.from} → ${result.to} (${result.status}).`);
      } else {
        await marketplaceApi.uninstall(id);
        setMessage(`Uninstalled ${id}.`);
      }
    } catch (error) {
      setMessage(`Operation failed: ${(error as Error).message}`);
    }
    load();
  };

  const runImpact = async (id: string, currentVersion: string): Promise<void> => {
    setMessage(null);
    setImpactPackage(id);
    setImpact(null);
    try {
      const latestVersion = await marketplaceV2Api
        .versions(id)
        .then((list) => list.map((v) => v.version).sort((a, b) => b.localeCompare(a))[0]);
      if (!latestVersion || latestVersion === currentVersion) {
        setMessage(`${id} is already on the latest recorded version (${currentVersion}).`);
        setImpactPackage(null);
        return;
      }
      const analysis = await marketplaceV2Api.impact({ packageId: id, currentVersion, toVersion: latestVersion, channel: 'stable' });
      setImpact(analysis);
    } catch (error) {
      setMessage(`Impact analysis failed: ${(error as Error).message}`);
      setImpactPackage(null);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <DashboardCustomizeIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Installed</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Control center for installed packages — enable, disable, update (with impact analysis), uninstall.
      </Typography>

      {message !== null ? <Alert severity={message.startsWith('Operation failed') || message.startsWith('Impact analysis failed') ? 'error' : 'success'} sx={{ mb: 2 }}>{message}</Alert> : null}

      {impact !== null && impactPackage !== null ? (
        <Alert severity={impact.breaking ? 'error' : 'info'} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2">
              {impact.packageId} {impact.fromVersion} → {impact.toVersion}
            </Typography>
            <Chip size="small" label={impact.breaking ? 'BREAKING' : 'non-breaking'} color={impact.breaking ? 'error' : 'success'} />
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="contained" color={impact.breaking ? 'warning' : 'primary'} onClick={() => void act(impactPackage, 'update')}>
              Update anyway
            </Button>
            <Button size="small" onClick={() => setImpact(null)}>Dismiss</Button>
          </Stack>
          {impact.breaking ? (
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              {impact.reverseDependencies.filter((r) => !r.stillSatisfied).map((r) => (
                <li key={r.dependent} style={{ fontSize: 12 }}>
                  <strong>{r.dependent}</strong> requires {r.versionRange} — will break.
                </li>
              ))}
              {impact.capabilitiesRemoved.length > 0 ? (
                <li style={{ fontSize: 12 }}>Removes capabilities: {impact.capabilitiesRemoved.join(', ')}.</li>
              ) : null}
            </Box>
          ) : null}
        </Alert>
      ) : null}

      <Stack spacing={1}>
        {installed.map((item) => (
          <Box key={item.packageId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Link to={`/marketplace/packages/${item.packageId}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontFamily: 'monospace' }}>
                {item.packageId}
              </Link>
              <Chip size="small" label={`v${item.version}`} variant="outlined" />
              <Chip size="small" label={item.enabled ? 'Enabled' : 'Disabled'} color={item.enabled ? 'success' : 'default'} />
              <Chip size="small" label={item.status} variant="outlined" />
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => void act(item.packageId, item.enabled ? 'disable' : 'enable')}>
                {item.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button size="small" onClick={() => void runImpact(item.packageId, item.version)} disabled={impactPackage === item.packageId}>
                Check update
              </Button>
              <Button size="small" color="error" onClick={() => void act(item.packageId, 'uninstall')}>Uninstall</Button>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              installed {item.installedAt.slice(0, 19).replace('T', ' ')}
              {item.knownGoodVersion ? ` · known-good ${item.knownGoodVersion}` : ''}
            </Typography>
          </Box>
        ))}
        {installed.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nothing installed yet.</Typography> : null}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" size="small" onClick={load}>Refresh</Button>
      </Stack>
    </Box>
  );
}
