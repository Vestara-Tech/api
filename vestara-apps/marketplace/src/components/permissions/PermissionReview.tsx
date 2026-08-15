import { Box, Chip, Stack, Typography } from '@mui/material';
import type { PackageDetail } from '../../api/marketplaceApi';

const RISK_COLOR: Record<string, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

function riskOf(permissionId: string): string {
  if (permissionId.includes('read')) return 'low';
  if (permissionId.includes('process') || permissionId.includes('execute') || permissionId.includes('workflow')) return 'high';
  if (permissionId.includes('shell.root')) return 'critical';
  return 'medium';
}

/** PermissionReview — shows exactly what installing grants authority to. */
export function PermissionReview({ pkg }: { pkg: PackageDetail }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Permissions
      </Typography>
      <Stack spacing={0.5}>
        {pkg.permissions.map((permission) => {
          const risk = permission.approval === 'explicit' ? 'high' : riskOf(permission.id);
          return (
            <Stack key={permission.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>{permission.id}</Typography>
              <Chip size="small" label={risk} color={RISK_COLOR[risk] ?? 'default'} />
              {permission.required ? <Chip size="small" label="required" variant="outlined" /> : null}
              {permission.approval === 'explicit' || risk === 'high' || risk === 'critical' ? (
                <Chip size="small" label="Approval required" color="warning" />
              ) : null}
            </Stack>
          );
        })}
        {pkg.permissions.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>No permissions requested.</Typography> : null}
      </Stack>
    </Box>
  );
}

/** CapabilityView — what functionality the package contributes. */
export function CapabilityView({ pkg }: { pkg: PackageDetail }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Capabilities
      </Typography>
      <Stack spacing={0.5}>
        {pkg.capabilities.map((cap) => (
          <Stack key={cap.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip size="small" label="✓" color="success" />
            <Typography variant="body2">{cap.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{cap.id}</Typography>
          </Stack>
        ))}
        {pkg.capabilities.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>No capabilities declared.</Typography> : null}
      </Stack>
    </Box>
  );
}

export function DependenciesView({ pkg }: { pkg: PackageDetail }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Dependencies
      </Typography>
      <Stack spacing={0.5}>
        {pkg.dependencies.map((dep) => (
          <Stack key={dep.packageId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{dep.packageId}</Typography>
            <Chip size="small" label={dep.versionRange} variant="outlined" />
            {dep.required ? <Chip size="small" label="required" color="primary" /> : null}
          </Stack>
        ))}
        {pkg.dependencies.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>No dependencies.</Typography> : null}
      </Stack>
    </Box>
  );
}
