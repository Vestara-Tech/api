import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ArtifactPart, GenerationPart } from '../../model/message';

export function ArtifactView({ artifact }: { artifact: ArtifactPart }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip size="small" label="📦 artifact" color="primary" variant="outlined" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{artifact.name}</Typography>
      </Stack>
      {artifact.path ? <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block', mt: 0.5 }}>{artifact.path}</Typography> : null}
      {artifact.summary ? <Typography variant="body2" sx={{ mt: 0.5 }}>{artifact.summary}</Typography> : null}
    </Box>
  );
}

export function GenerationView({ generation }: { generation: GenerationPart }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip size="small" label="⚙ generator" variant="outlined" />
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{generation.generatorId}</Typography>
        <Chip size="small" label={generation.status} color={generation.status === 'applied' ? 'success' : 'default'} />
      </Stack>
      {generation.summary ? <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{generation.summary}</Typography> : null}
    </Box>
  );
}
