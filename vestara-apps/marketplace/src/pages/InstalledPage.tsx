import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { marketplaceApi, type InstalledView } from '../api/marketplaceApi';

export function InstalledPage() {
  const [installed, setInstalled] = useState<readonly InstalledView[]>([]);

  const load = useCallback(() => {
    void marketplaceApi.installed().then(setInstalled).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, op: 'enable' | 'disable' | 'update' | 'uninstall'): Promise<void> => {
    if (op === 'enable') await marketplaceApi.enable(id);
    else if (op === 'disable') await marketplaceApi.disable(id);
    else if (op === 'update') await marketplaceApi.update(id);
    else await marketplaceApi.uninstall(id);
    load();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Installed</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Operational view of installed packages — enable, disable, update, uninstall.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={load}>Refresh</Button>
      </Stack>

      <Stack spacing={1}>
        {installed.map((item) => (
          <Box key={item.packageId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{item.packageId}</Typography>
              <Chip size="small" label={`v${item.version}`} variant="outlined" />
              <Chip size="small" label={item.enabled ? 'Enabled' : 'Disabled'} color={item.enabled ? 'success' : 'default'} />
              <Chip size="small" label={item.status} variant="outlined" />
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => void act(item.packageId, item.enabled ? 'disable' : 'enable')}>
                {item.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button size="small" onClick={() => void act(item.packageId, 'update')}>Update</Button>
              <Button size="small" color="error" onClick={() => void act(item.packageId, 'uninstall')}>Uninstall</Button>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              installed {item.installedAt.slice(0, 19).replace('T', ' ')}
            </Typography>
          </Box>
        ))}
        {installed.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nothing installed yet.</Typography> : null}
      </Stack>
    </Box>
  );
}
