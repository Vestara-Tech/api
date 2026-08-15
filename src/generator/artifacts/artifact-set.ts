import { hashOf } from '../domain/hash.js';

export type ArtifactEncoding = 'utf8' | 'base64' | 'binary';

export interface Artifact {
  readonly path: string;
  readonly content: string;
  readonly encoding: ArtifactEncoding;
  readonly contentHash: string;
  readonly kind?: string;
  readonly generatedAt: string;
}

export interface CreateArtifactInput {
  readonly path: string;
  readonly content: string;
  readonly encoding?: ArtifactEncoding;
  readonly kind?: string;
}

export function createArtifact(input: CreateArtifactInput): Artifact {
  const encoding = input.encoding ?? 'utf8';
  return {
    path: input.path,
    content: input.content,
    encoding,
    contentHash: hashOf({ content: input.content, encoding }),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    generatedAt: new Date().toISOString(),
  };
}

/** Provenance + manifest metadata for an artifact set. */
export interface ArtifactManifest {
  readonly artifactCount: number;
  readonly outputHash: string;
  readonly files: readonly string[];
}

/**
 * A set of generated artifacts. Generators never write to the filesystem
 * directly; they produce an ArtifactSet that an apply port consumes later.
 */
export class ArtifactSet {
  private readonly byPath = new Map<string, Artifact>();

  constructor(private readonly generatorId: string, private readonly generatorVersion: string) {}

  add(input: CreateArtifactInput): Artifact {
    const artifact = createArtifact(input);
    if (this.byPath.has(artifact.path)) {
      throw new Error(`Duplicate artifact path "${artifact.path}"`);
    }
    this.byPath.set(artifact.path, artifact);
    return artifact;
  }

  get(path: string): Artifact | null {
    return this.byPath.get(path) ?? null;
  }

  has(path: string): boolean {
    return this.byPath.has(path);
  }

  size(): number {
    return this.byPath.size;
  }

  files(): readonly string[] {
    return [...this.byPath.keys()].sort();
  }

  all(): readonly Artifact[] {
    return [...this.byPath.values()];
  }

  /** Deterministic hash across all artifacts (sorted by path). */
  outputHash(): string {
    const sorted = [...this.byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    return hashOf({
      generatorId: this.generatorId,
      generatorVersion: this.generatorVersion,
      artifacts: sorted.map((a) => ({ path: a.path, contentHash: a.contentHash, encoding: a.encoding })),
    });
  }

  manifest(): ArtifactManifest {
    return {
      artifactCount: this.byPath.size,
      outputHash: this.outputHash(),
      files: this.files(),
    };
  }
}
