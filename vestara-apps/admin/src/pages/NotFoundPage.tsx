import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { PageContainer } from '@vestara/ui';

export function NotFoundPage() {
  return (
    <PageContainer title="Page not found" description="The requested route does not exist in the current Admin shell.">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Return to the dashboard or use the command palette to navigate to an available section.
        </Typography>
        <Button component={RouterLink} to="/admin/dashboard" variant="contained">
          Go to dashboard
        </Button>
      </Stack>
    </PageContainer>
  );
}
