import type { ContextCollectionRequest, ContextItem, ContextScope } from '../domain/contracts.js';

export interface ContextProvider {
  readonly id: string;
  readonly kinds: readonly ContextItem['source'][];
  readonly scope: ContextScope;

  collect(request: ContextCollectionRequest): Promise<readonly ContextItem[]>;
}

export interface ContextProviderRegistration {
  readonly provider: ContextProvider;
}

export interface ContextProviderRegistryOptions {
  readonly providers?: readonly ContextProvider[];
}
