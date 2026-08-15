import { Link } from 'react-router';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import type { PackageView } from '../../api/marketplaceApi';

export function PackageCard({ pkg }: { pkg: PackageView }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea component={Link} to={`/marketplace/packages/${pkg.id}`} sx={{ height: '100%' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center',  mb: 0.5 }}>
            <Chip size="small" label={pkg.kind} color="info" variant="outlined" />
            {pkg.rating !== undefined ? (
              <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                <StarIcon fontSize="inherit" sx={{ color: 'warning.main' }} />
                <Typography variant="caption">{pkg.rating}</Typography>
              </Stack>
            ) : null}
          </Stack>
          <Typography sx={{ fontWeight: 600 }}>{pkg.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{pkg.id}</Typography>
          {pkg.description ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, flex: 1 }}>{pkg.description}</Typography>
          ) : null}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center',  mt: 1 }}>
            <Chip size="small" label={`v${pkg.version}`} variant="outlined" />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{pkg.publisher}</Typography>
            {pkg.installs !== undefined ? <Typography variant="caption" sx={{ color: 'text.disabled' }}>{pkg.installs.toLocaleString()} installs</Typography> : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
