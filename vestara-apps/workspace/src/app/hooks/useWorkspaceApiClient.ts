import { useMemo } from 'react';

import { WorkspaceApiClient } from '../../api/client.js';

type WorkspaceApiClientFactory = (apiBaseUrl?: string) => WorkspaceApiClient;

function createWorkspaceApiClientFactory(): WorkspaceApiClientFactory {
  return (apiBaseUrl = '/api') => new WorkspaceApiClient(apiBaseUrl);
}

const defaultWorkspaceApiClientFactory = createWorkspaceApiClientFactory();

interface WorkspaceApiClientTestStore {
  workspaceApiClientFactory: WorkspaceApiClientFactory;
}

const globalWorkspaceApiClientStore = globalThis as typeof globalThis & {
  __vestaraWorkspaceApiClientTestStore__?: WorkspaceApiClientTestStore;
};

function getWorkspaceApiClientTestStore(): WorkspaceApiClientTestStore {
  if (globalWorkspaceApiClientStore.__vestaraWorkspaceApiClientTestStore__ === undefined) {
    globalWorkspaceApiClientStore.__vestaraWorkspaceApiClientTestStore__ = {
      workspaceApiClientFactory: defaultWorkspaceApiClientFactory,
    };
  }

  return globalWorkspaceApiClientStore.__vestaraWorkspaceApiClientTestStore__;
}

export function setWorkspaceApiClientFactoryForTests(factory?: WorkspaceApiClientFactory): void {
  getWorkspaceApiClientTestStore().workspaceApiClientFactory = factory ?? defaultWorkspaceApiClientFactory;
}

export function resetWorkspaceApiClientFactoryForTests(): void {
  getWorkspaceApiClientTestStore().workspaceApiClientFactory = defaultWorkspaceApiClientFactory;
}

export function useWorkspaceApiClient(apiBaseUrl = '/api'): WorkspaceApiClient {
  return useMemo(() => getWorkspaceApiClientTestStore().workspaceApiClientFactory(apiBaseUrl), [apiBaseUrl]);
}
