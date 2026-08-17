import { type ErrorInfo, type ReactNode, Component } from 'react';
import { Paper, Stack, Typography } from '@mui/material';

import { PageContainer } from '@vestara/ui';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Workspace render error', error, info);
  }

  override render() {
    if (this.state.error !== undefined) {
      return (
        <PageContainer title="Workspace error" description="The authoring shell encountered an unexpected error.">
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={1}>
              <Typography variant="h6">Render failure</Typography>
              <Typography variant="body2" color="text.secondary">
                {this.state.error.message}
              </Typography>
            </Stack>
          </Paper>
        </PageContainer>
      );
    }

    return this.props.children;
  }
}

