import { createHash } from 'node:crypto';
import { badRequest } from '../../../core/errors.js';
import { randomId } from '../../../core/identifiers.js';

export interface BootAssetRef {
  readonly assetId: string;
  readonly sha256: string;
  readonly mediaType: string;
}

export interface BootAsset extends BootAssetRef {
  readonly bytes: Uint8Array;
  readonly name: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export type BootAssetMediaType =
  | 'image/png'
  | 'image/svg+xml'
  | 'image/jpeg'
  | 'text/plain'
  | 'font/ttf'
  | 'unknown';

export interface AssetValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface AssetValidationResult {
  readonly ok: boolean;
  readonly issues: readonly AssetValidationIssue[];
}

const SUPPORTED_MEDIA: readonly BootAssetMediaType[] = ['image/png', 'image/svg+xml', 'image/jpeg', 'text/plain', 'font/ttf'];

const FORBIDDEN_PATH_PATTERNS = [
  /^\.\.(\/|$)/,
  /^\//,
  /^[A-Za-z]:[\\/]/,
  /^file:\/\//,
  /(^|\/)\.\.(\/|$)/,
];

/** Reject raw filesystem paths from API clients. Only logical names are allowed. */
export function assertSafeAssetName(name: string): void {
  if (!name || name.length === 0) throw badRequest('asset name is required');
  if (FORBIDDEN_PATH_PATTERNS.some((re) => re.test(name))) {
    throw badRequest(`Invalid asset name (filesystem paths are not accepted): "${name}"`);
  }
  if (/[\0\r\n]/.test(name)) throw badRequest('Invalid asset name');
}

export interface StoreAssetInput {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly mediaType?: string;
}

export interface BootAssetStore {
  store(input: StoreAssetInput): Promise<BootAsset>;
  get(assetId: string): Promise<BootAsset | null>;
  getBySha256(sha256: string): Promise<BootAsset | null>;
  list(): Promise<readonly BootAsset[]>;
}

export class InMemoryBootAssetStore implements BootAssetStore {
  private readonly assets = new Map<string, BootAsset>();
  private readonly bySha = new Map<string, string>(); // sha256 → assetId

  async store(input: StoreAssetInput): Promise<BootAsset> {
    assertSafeAssetName(input.name);
    const sha256 = createHash('sha256').update(Buffer.from(input.bytes)).digest('hex');
    const existing = await this.getBySha256(sha256);
    if (existing) return existing; // content-addressed: dedupe

    const mediaType = input.mediaType ?? guessMediaType(input.name);
    const asset: BootAsset = {
      assetId: randomId('asset'),
      sha256,
      mediaType,
      bytes: input.bytes,
      name: input.name,
      sizeBytes: input.bytes.byteLength,
      createdAt: new Date().toISOString(),
    };
    this.assets.set(asset.assetId, asset);
    this.bySha.set(sha256, asset.assetId);
    return asset;
  }

  async get(assetId: string): Promise<BootAsset | null> {
    return this.assets.get(assetId) ?? null;
  }

  async getBySha256(sha256: string): Promise<BootAsset | null> {
    const id = this.bySha.get(sha256);
    return id !== undefined ? (this.assets.get(id) ?? null) : null;
  }

  async list(): Promise<readonly BootAsset[]> {
    return [...this.assets.values()];
  }
}

export function toRef(asset: BootAsset): BootAssetRef {
  return { assetId: asset.assetId, sha256: asset.sha256, mediaType: asset.mediaType };
}

function guessMediaType(name: string): BootAssetMediaType {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'unknown';
}

/** Validate an asset for a target (plymouth/grub/firmware-logo). */
export function validateAsset(asset: BootAsset, target: 'plymouth' | 'grub' | 'firmware'): AssetValidationResult {
  const issues: AssetValidationIssue[] = [];
  if (asset.sizeBytes > 2_000_000) issues.push({ code: 'too-large', message: 'asset exceeds 2MB', severity: 'error' });
  if (!SUPPORTED_MEDIA.includes(asset.mediaType as BootAssetMediaType)) {
    issues.push({ code: 'unsupported-media', message: `unsupported media type "${asset.mediaType}"`, severity: 'error' });
  }
  if (target === 'firmware' && asset.mediaType !== 'image/png') {
    issues.push({ code: 'firmware-format', message: 'firmware logo must be PNG', severity: 'error' });
  }
  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}
