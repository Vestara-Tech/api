import { useMemo } from 'react';

import { AdminApiClient } from '../../api/client.js';

export function useAdminApiClient(apiBaseUrl = '/api'): AdminApiClient {
  return useMemo(() => new AdminApiClient(apiBaseUrl), [apiBaseUrl]);
}

