import type { ErrorInfo, ReactNode } from 'react';
import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';

import { PageContainer } from '@vestara/ui';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | undefined;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: undefined };

  override componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.setState({ error });
  }

  override render() {
    if (this.state.error !== undefined) {
      return (
        <PageContainer title="Something went wrong">
          <Stack spacing={2}>
            <Alert severity="error">{this.state.error.message}</Alert>
            <Button variant="contained" onClick={() => this.setState({ error: undefined })}>
              Dismiss
            </Button>
          </Stack>
        </PageContainer>
      );
    }

    return this.props.children;
  }
}
