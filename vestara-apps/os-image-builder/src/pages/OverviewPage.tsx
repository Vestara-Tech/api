import { Box, Chip, Stack, Typography } from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';
import { useBuildPlan } from '../hooks/useImage';
import { applicationsSizeMb, catalogEntry, IMAGE_TARGETS } from '../types/domain';

export function OverviewPage() {
  const { profile } = useImageBuilder();
  const { data: plan } = useBuildPlan(profile?.id ?? '', 'raw');

  if (!profile) return null;

  const apps = profile.applications.applications;
  const footprintMb = applicationsSizeMb(apps);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {profile.id}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          v{profile.version} · {profile.architecture} · {profile.base.distribution} {profile.base.release}
        </Typography>
      </Stack>

      <Box sx={{ mt: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
          Summary
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip label={`${apps.length} applications`} size="small" />
          <Chip label={`${footprintMb} MB app footprint`} size="small" />
          <Chip label={`${profile.packages.extraPackages.length} extra packages`} size="small" />
          <Chip label={profile.boot.grub.enabled ? 'GRUB on' : 'GRUB off'} size="small" variant="outlined" />
          <Chip label={profile.boot.plymouth.enabled ? 'Plymouth on' : 'Plymouth off'} size="small" variant="outlined" />
          <Chip label={profile.system.abSlots ? 'A/B slots' : 'Single slot'} size="small" variant="outlined" />
          <Chip label={profile.system.recovery ? 'Recovery' : 'No recovery'} size="small" variant="outlined" />
        </Stack>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
          Build Plan ({plan?.items.length ?? 0} stages)
        </Typography>
        {plan ? (
          <Stack spacing={0.5}>
            {plan.items.map((item) => (
              <Stack key={item.stage} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 200 }}>
                  {item.stage}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {item.description}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Compile a plan from the Build page.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
