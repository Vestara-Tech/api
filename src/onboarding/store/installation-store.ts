import type { InstallationState } from '../domain/state.js';

export interface InstallationStore {
  get(): Promise<InstallationState | null>;
  save(state: InstallationState): Promise<InstallationState>;
}

export class InMemoryInstallationStore implements InstallationStore {
  private state: InstallationState | null = null;

  async get(): Promise<InstallationState | null> {
    return this.state;
  }

  async save(state: InstallationState): Promise<InstallationState> {
    this.state = state;
    return state;
  }
}
