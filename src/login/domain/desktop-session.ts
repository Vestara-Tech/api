import { hashOf } from '../../generator/domain/hash.js';

export interface DesktopSessionDefinition {
  readonly id: string;
  readonly name: string;
  readonly entry: 'wayland' | 'x11';
  readonly desktopEntryPath: string;
  readonly exec: string;
  readonly startupApp: string;
  readonly desktopApp: string;
  readonly sessionHash: string;
}

export function createDesktopSessionDefinition(input: Omit<DesktopSessionDefinition, 'sessionHash'>): DesktopSessionDefinition {
  return {
    ...input,
    sessionHash: hashOf({ id: input.id, name: input.name, entry: input.entry, exec: input.exec, startupApp: input.startupApp, desktopApp: input.desktopApp }),
  };
}
