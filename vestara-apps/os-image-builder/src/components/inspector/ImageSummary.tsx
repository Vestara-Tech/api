import { useParams } from 'react-router';
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useBuildPlan, useProfile } from '../../hooks/useImage';
import { applicationsSizeMb, catalogEntry, IMAGE_TARGETS } from '../../types/domain';

export function ImageSummary() {
  const { profileId } = useParams<{ profileId: string }>();
  const { data: profile } = useProfile(profileId ?? '');
  const { data: plan } = useBuildPlan(profileId ?? '', 'raw');

  if (!profile) return null;

  const apps = profile.applications.applications;
  const footprintMb = applicationsSizeMb(apps);

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Target',
      value: (
        <Stack spacing={0.5}>
          {IMAGE_TARGETS.map((t) => (
            <Stack key={t.value} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {t.value === 'raw' ? <CheckCircleIcon fontSize="small" color="success" /> : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
              <Typography variant="body2">{t.label}</Typography>
            </Stack>
          ))}
        </Stack>
      ),
      },
    { label: 'Architecture', value: <Typography variant="body2">{profile.architecture}</Typography> },
    {
      label: 'Estimated size',
      value: <Typography variant="body2">{(footprintMb / 1024).toFixed(1)} GB</Typography> },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Image Summary
      </Typography>

      {rows.map((row) => (
        <Box key={row.label} sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {row.label}
          </Typography>
          {row.value}
        </Box>
      ))}

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Boot Experience
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {[
          { label: 'GRUB', on: profile.boot.grub.enabled },
          { label: 'Plymouth', on: profile.boot.plymouth.enabled },
          { label: 'Startup', on: true },
          { label: 'Login', on: true },
          { label: 'Desktop', on: profile.desktop.session === 'vestara' },
        ].map((b) => (
          <Stack key={b.label} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2">{b.label}</Typography>
            {b.on ? <CheckCircleIcon fontSize="small" color="success" /> : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Applications
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 1 }}>
        {apps.map((id) => {
          const app = catalogEntry(id);
          return (
            <Stack key={id} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontSize: 12 }}>
                {app?.name ?? id}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {app ? `${app.sizeMb} MB` : ''}
              </Typography>
            </Stack>
          );
          })}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {apps.length} applications · {footprintMb} MB
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
        Verification
      </Typography>
      <Stack spacing={0.5}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>Profile</Typography>
          <CheckCircleIcon fontSize="small" color="success" />
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>Dependencies</Typography>
          <CheckCircleIcon fontSize="small" color="success" />
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>Build</Typography>
          <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>Boot test</Typography>
          <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        </Stack>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
        Profile Hash
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', wordBreak: 'break-all' }}>
        {profile.profileHash ? `${profile.profileHash.slice(0, 8)}…${profile.profileHash.slice(-4)}` : '…'}
      </Typography>

      {plan ? (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
            Plan
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip size="small" label={`${plan.items.length} stages`} />
            <Chip size="small" label={`hash ${plan.planHash.slice(0, 8)}`} variant="outlined" />
          </Stack>
        </>
      ) : null}
    </Box>
  );
}
