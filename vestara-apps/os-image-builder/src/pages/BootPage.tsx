import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';
import { BootTimeline } from '../components/boot/BootTimeline';
import { GrubEditor } from '../components/boot/GrubEditor';
import { BootPreview } from '../components/boot/BootPreview';

export type BootStage = 'firmware' | 'grub' | 'plymouth' | 'startup' | 'login';

export function BootPage() {
  const { profile } = useImageBuilder();
  const [stage, setStage] = useState<BootStage>('grub');

  if (!profile) return null;

  const stageEnabled: Record<BootStage, boolean> = {
    firmware: true,
    grub: profile.boot.grub.enabled,
    plymouth: profile.boot.plymouth.enabled,
    startup: true,
    login: true,
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Boot Experience
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The boot timeline from firmware to login. Select a stage to configure it and preview the
        resulting experience.
      </Typography>

      <BootTimeline stage={stage} onSelect={setStage} stageEnabled={stageEnabled} />

      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start',  mt: 2 }}>
        <Box sx={{ flex: 1 }}>
          {stage === 'grub' ? <GrubEditor /> : <OtherStageEditor stage={stage} />}
        </Box>
        <Box sx={{ width: 420 }}>
          <BootPreview stage={stage} profile={profile} />
        </Box>
      </Stack>
    </Box>
  );
}

function OtherStageEditor({ stage }: { stage: Exclude<BootStage, 'grub'> }) {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;

  if (stage === 'plymouth') {
    const enabled = profile.boot.plymouth.enabled;
    const theme = profile.boot.plymouth.theme;
    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Typography sx={{ fontWeight: 600, mb: 1 }}>Plymouth</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Chip
            label={enabled ? 'Enabled' : 'Disabled'}
            color={enabled ? 'success' : 'default'}
            onClick={() => void patch((d) => ({ ...d, boot: { ...d.boot, plymouth: { ...d.boot.plymouth, enabled: !d.boot.plymouth.enabled }} }))}
            clickable
          />
        </Stack>
        {enabled ? (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {['vestara', 'fade-in', 'spinfinity'].map((t) => (
              <Chip
                key={t}
                label={t}
                variant={theme === t ? 'filled' : 'outlined'}
                color={theme === t ? 'primary' : 'default'}
                onClick={() => void patch((d) => ({ ...d, boot: { ...d.boot, plymouth: { ...d.boot.plymouth, theme: t }} }))}
                clickable
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Plymouth is disabled — boot proceeds directly to the next stage.
          </Typography>
        )}
      </Box>
    );
  }

  const labels: Record<'firmware' | 'startup' | 'login', { title: string; body: string }> = {
    firmware: {
      title: 'Firmware',
      body: 'Firmware boots the machine and hands off to GRUB. The generic image never bakes an OEM/firmware logo — it stays hardware-dependent and only replaces the logo when supported and approved.',
    },
    startup: {
      title: 'Startup',
      body: 'The Startup coordinator runs after login is selected: booting, initializing services, verifying readiness, then routing to onboarding, login, desktop, diagnostics or recovery.',
    },
    login: {
      title: 'Login',
      body: 'The OS-level login gate (PAM-backed) presents the greeter. The pre-auth boundary keeps builder, generator, config-secrets, marketplace, filesystem and agents unreachable before authentication.',
    },
  };
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
      <Typography sx={{ fontWeight: 600, mb: 1 }}>{labels[stage].title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {labels[stage].body}
      </Typography>
    </Box>
  );
}
