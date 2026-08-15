import { forbidden } from '../../core/errors.js';
import type { FileOperation, FileWorkspace } from './contracts.js';

/**
 * FILE — Workspace path sandbox. Resolves include/exclude patterns and the
 * workspace root BEFORE an operation reaches a provider. An agent never
 * receives arbitrary host filesystem access.
 */
export class WorkspaceSandbox {
  private readonly workspace: FileWorkspace;

  constructor(workspace: FileWorkspace) {
    this.workspace = workspace;
  }

  resolve(path: string): string {
    if (path.startsWith('workspace://')) {
      const suffix = path.slice('workspace://'.length);
      const [wsId, ...rest] = suffix.split('/');
      if (wsId !== this.workspace.id) {
        throw forbidden(`Path references another workspace "${wsId}"`);
      }
      return `workspace://${this.workspace.id}/${rest.join('/')}`;
    }
    if (path.startsWith(this.workspace.root)) return path;
    if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
      throw forbidden(`Path "${path}" escapes workspace "${this.workspace.id}"`);
    }
    return `${this.workspace.root}${path.replace(/^\//, '')}`;
  }

  isAllowed(path: string): boolean {
    const workspacePath = this.resolve(path);
    const relative = workspacePath.slice(this.workspace.root.length);
    if (this.workspace.exclude?.some((p) => matchesPattern(relative, p))) return false;
    if (this.workspace.include && this.workspace.include.length > 0) {
      return this.workspace.include.some((p) => matchesPattern(relative, p));
    }
    return true;
  }

  assertAllowed(path: string): string {
    const resolved = this.resolve(path);
    if (!this.isAllowed(resolved)) {
      throw forbidden(`Path "${path}" is excluded by workspace "${this.workspace.id}" policy`);
    }
    return resolved;
  }

  assertAllowedOperation(operation: FileOperation): void {
    this.assertAllowed(operation.path);
    if (operation.destination !== undefined) this.assertAllowed(operation.destination);
  }
}

/** Glob-lite matcher: supports `**`, `*`, and literal segments. */
export function matchesPattern(path: string, pattern: string): boolean {
  const regex = pattern
    .split('/')
    .map((segment) => {
      if (segment === '**') return '.*';
      return segment
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
    })
    .join('/');
  return new RegExp(`^${regex}$`).test(path) || new RegExp(`^${regex}/.*$`).test(path);
}
