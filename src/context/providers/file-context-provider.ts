import type { FileService } from '../../file/service/file-service.js';
import type { ContextCollectionRequest, ContextItem } from '../domain/contracts.js';
import type { ContextProvider } from './context-provider.js';

/**
 * CTX-017 — File context provider. Supplies file contents/summaries as context
 * candidates. The authorization filter in the collector decides whether the
 * principal may actually see them — context can access a file ≠ agent can see
 * it.
 */
export class FileContextProvider implements ContextProvider {
  readonly id = 'file';
  readonly kinds = ['file', 'code'] as const;
  readonly scope = 'workspace';

  constructor(
    private readonly file: FileService,
    private readonly workspaceId: string,
    private readonly paths: readonly string[],
  ) {}

  async collect(request: ContextCollectionRequest): Promise<readonly ContextItem[]> {
    const items: ContextItem[] = [];
    for (const path of this.paths) {
      try {
        const result = await this.file.read(this.workspaceId, path);
        items.push({
          id: `file:${this.workspaceId}:${path}`,
          source: path.endsWith('.ts') || path.endsWith('.tsx') ? 'code' : 'file',
          sourceId: path,
          title: path,
          content: result.content,
          priority: 40,
          required: false,
          sensitive: false,
          metadata: { scope: 'workspace', workspaceId: this.workspaceId },
        });
      } catch {
        // Skip unreadable files.
      }
    }
    return items;
  }
}
