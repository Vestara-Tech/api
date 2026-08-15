import { Box, Stack, Typography } from '@mui/material';
import type { ImageProfile } from '../../api/contracts';
import type { BootStage } from '../../pages/BootPage';

const PREVIEW_STYLE = {
  width: 420,
  height: 236,
  borderRadius: 6,
  border: '1px solid #2a2d37',
  overflow: 'hidden',
  fontFamily: 'monospace',
};

export function BootPreview({ stage, profile }: { stage: BootStage; profile: ImageProfile }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Preview — {stage}
      </Typography>
      {stage === 'firmware' ? <FirmwarePreview /> : null}
      {stage === 'grub' ? <GrubPreview profile={profile} /> : null}
      {stage === 'plymouth' ? <PlymouthPreview profile={profile} /> : null}
      {stage === 'startup' ? <StartupPreview /> : null}
      {stage === 'login' ? <LoginPreview /> : null}
    </Box>
  );
}

function Frame({ children, bg = '#0b0d12', fg = '#e4e7ec' }: { children: React.ReactNode; bg?: string; fg?: string }) {
  return (
    <Box
      sx={{
        ...PREVIEW_STYLE,
        bgcolor: bg,
        color: fg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        textAlign: 'center', }}
    >
      {children}
    </Box>
  );
}

function Brand() {
  return (
    <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: 6 }}>
      VESTARA
    </Typography>
  );
}

function FirmwarePreview() {
  return (
    <Frame>
      <Typography sx={{ fontSize: 11, color: '#8a8f98' }}>Firmware splash (hardware-dependent)</Typography>
      <Typography sx={{ fontSize: 12 }}>BIOS / UEFI</Typography>
    </Frame>
  );
}

function GrubPreview({ profile }: { profile: ImageProfile }) {
  const theme = profile.boot.grub.theme ?? 'vestara-dark';
  const dark = theme === 'vestara-dark' || theme === 'minimal';
  return (
    <Frame bg={dark ? '#0b0d12' : '#e8e6e0'} fg={dark ? '#e4e7ec' : '#1a1c22'}>
      <Brand />
      <Box sx={{ mt: 1, fontSize: 14, textAlign: 'left', width: '60%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ color: dark ? '#8ab4ff' : '#1a5cff' }}>▸</span> Vestara OS
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.7, mt: 0.5 }}>
          <span style={{ width: 14 }} /> Recovery
        </Box>
      </Box>
      <Typography sx={{ fontSize: 11, opacity: 0.6, mt: 1 }}>
        {profile.boot.grub.timeout}s · press ESC for menu
      </Typography>
    </Frame>
  );
}

function PlymouthPreview({ profile }: { profile: ImageProfile }) {
  return (
    <Frame>
      <Brand />
      <Typography sx={{ fontSize: 12, color: '#8a8f98' }}>
        Plymouth theme · {profile.boot.plymouth.theme}
      </Typography>
    </Frame>
  );
}

function StartupPreview() {
  return (
    <Frame>
      <Brand />
      <Typography sx={{ fontSize: 12, color: '#8a8f98' }}>Starting system…</Typography>
    </Frame>
  );
}

function LoginPreview() {
  return (
    <Frame>
      <Brand />
      <Box sx={{ mt: 1, width: 200, textAlign: 'left' }}>
        <Box sx={{ fontSize: 12, opacity: 0.7, mb: 0.5 }}>Username</Box>
        <Box sx={{ border: '1px solid #3a3d47', borderRadius: 4, px: 1.5, py: 0.5, fontSize: 13 }}>vestara</Box>
      </Box>
    </Frame>
  );
}
