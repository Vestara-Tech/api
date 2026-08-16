import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { marketplaceApi, type PackageDetail } from '../api/marketplaceApi';
import { marketplaceV2Api, type CapabilityResolution, type ContributionEntry } from '../api/marketplaceV2Api';
import { CapabilityView, DependenciesView, PermissionReview } from '../components/permissions/PermissionReview';
import { InstallDialog } from '../components/permissions/InstallDialog';

export function PackageDetailsPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [contribution, setContribution] = useState<ContributionEntry | null>(null);
  const [resolution, setResolution] = useState<CapabilityResolution | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  useEffect(() => {
    if (!packageId) return;
    void marketplaceApi.package(packageId).then(setPkg).catch(() => undefined);
    void marketplaceV2Api.contributions().then((entries) => {
      const found = entries.find((entry) => entry.packageId === packageId);
      setContribution(found ?? null);
      if (found) {
        void marketplaceV2Api.resolve(found.manifest).then(setResolution).catch(() => undefined);
      }
    }).catch(() => undefined);
  }, [packageId]);

  if (!pkg) return <Box sx={{ p: 3 }}><Typography sx={{ color: 'text.secondary' }}>Loading package…</Typography></Box>;

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 1, bgcolor: 'primary.dark', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{pkg.name[0]}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{pkg.name}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Chip size="small" label={pkg.kind} color="info" variant="outlined" />
            <Chip size="small" label={`v${pkg.version}`} variant="outlined" />
            <Chip size="small" label={pkg.publisher.verified ? 'Verified' : 'Unverified'} color={pkg.publisher.verified ? 'success' : 'default'} />
            {pkg.rating !== undefined ? (
              <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                <Typography variant="caption">{pkg.rating}</Typography>
              </Stack>
            ) : null}
            {pkg.installs !== undefined ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{pkg.installs.toLocaleString()} installs</Typography> : null}
          </Stack>
        </Box>
        <Button variant="contained" onClick={() => setInstallOpen(true)}>Install</Button>
      </Stack>

      {pkg.description ? <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>{pkg.description}</Typography> : null}

      {contribution !== null ? (
        <Box sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
            Marketplace v2 manifest
          </Typography>
          <Stack spacing={0.5}>
            {contribution.manifest.provides.map((p) => (
              <Stack key={`${p.kind}:${p.id}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip size="small" label={p.kind} color="info" variant="outlined" />
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{p.id}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{p.name}</Typography>
              </Stack>
            ))}
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              {contribution.manifest.requires.map((r, index) => (
                <Chip key={index} size="small" label={`requires ${r.module}${r.capability ? `.${r.capability}` : ''}`} variant="outlined" />
              ))}
              {contribution.manifest.requires.length === 0 ? <Chip size="small" label="no required modules" variant="outlined" /> : null}
            </Stack>
          </Stack>
          {resolution !== null ? (
            <Alert severity={resolution.ok ? 'success' : 'warning'} sx={{ mt: 1 }}>
              {resolution.ok
                ? 'Capability resolution: all requirements satisfied.'
                : `Missing required capabilities: ${resolution.missingRequired.join(', ')}.`}
            </Alert>
          ) : null}
        </Box>
      ) : null}

      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mt: 3 }}>
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <CapabilityView pkg={pkg} />
          <DependenciesView pkg={pkg} />
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
              Compatibility
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              API {pkg.compatibility.apiRange ?? 'any'} · Platform {pkg.compatibility.platformRange ?? 'any'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Source {pkg.provenance.source} · published {pkg.provenance.publishedAt.slice(0, 10)}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ width: 380 }}>
          <PermissionReview pkg={pkg} />
        </Box>
      </Stack>

      <InstallDialog pkg={pkg} open={installOpen} onClose={() => setInstallOpen(false)} onInstalled={() => undefined} />
    </Box>
  );
}
