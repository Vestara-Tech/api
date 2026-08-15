import type { ArtifactSet } from '../artifacts/artifact-set.js';

export type DiffOperation = 'create' | 'update' | 'unchanged' | 'remove';

export interface FileDiff {
  readonly path: string;
  readonly operation: DiffOperation;
  readonly previousContentHash?: string;
  readonly newContentHash: string;
  readonly addedLines: number;
  readonly removedLines: number;
}

export interface GenerationPreview {
  readonly generatorId: string;
  readonly generatorVersion: string;
  readonly artifacts: ArtifactSet;
  readonly diff: readonly FileDiff[];
  readonly totalFiles: number;
  readonly additions: number;
  readonly removals: number;
  readonly changes: number;
  readonly previewHash: string;
}

/**
 * Read port for the target directory. Keeps the preview/apply pipeline free of
 * direct filesystem imports at the domain level.
 */
export interface TargetDirectoryReader {
  read(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.split('\n').length;
}

export interface BuildPreviewInput {
  readonly generatorId: string;
  readonly generatorVersion: string;
  readonly artifacts: ArtifactSet;
  readonly reader: TargetDirectoryReader;
  readonly previewHash: string;
}

/** Diff an artifact set against a target directory (GEN-007). */
export async function buildPreview(input: BuildPreviewInput): Promise<GenerationPreview> {
  const diff: FileDiff[] = [];
  let additions = 0;
  let removals = 0;
  let changes = 0;

  const files = [...input.artifacts.files()].sort();

  for (const path of files) {
    const artifact = input.artifacts.get(path)!;
    const existing = await input.reader.read(path);
    const newLines = countLines(artifact.content);
    if (existing === null) {
      diff.push({
        path,
        operation: 'create',
        newContentHash: artifact.contentHash,
        addedLines: newLines,
        removedLines: 0,
      });
      additions += 1;
    } else if (existing === artifact.content) {
      diff.push({
        path,
        operation: 'unchanged',
        newContentHash: artifact.contentHash,
        addedLines: 0,
        removedLines: 0,
      });
    } else {
      const oldLines = countLines(existing);
      diff.push({
        path,
        operation: 'update',
        newContentHash: artifact.contentHash,
        addedLines: Math.max(newLines - oldLines, 0),
        removedLines: Math.max(oldLines - newLines, 0),
      });
      changes += 1;
    }
  }

  return {
    generatorId: input.generatorId,
    generatorVersion: input.generatorVersion,
    artifacts: input.artifacts,
    diff,
    totalFiles: diff.length,
    additions,
    removals,
    changes,
    previewHash: input.previewHash,
  };
}
