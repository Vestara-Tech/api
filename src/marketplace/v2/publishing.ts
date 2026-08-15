import type { PublisherIdentity, TrustLevel, VestaraPackageKind } from './contracts.js';

export interface PublisherStorePort {
  save(publisher: PublisherIdentity): void;
  get(id: string): PublisherIdentity | undefined;
  list(): readonly PublisherIdentity[];
}

export class InMemoryPublisherStore implements PublisherStorePort {
  private readonly publishers = new Map<string, PublisherIdentity>();

  save(publisher: PublisherIdentity): void {
    this.publishers.set(publisher.publisherId, publisher);
  }

  get(id: string): PublisherIdentity | undefined {
    return this.publishers.get(id);
  }

  list(): readonly PublisherIdentity[] {
    return [...this.publishers.values()];
  }
}

export interface PublishRequestV2 {
  readonly packageId: string;
  readonly version: string;
  readonly kind: VestaraPackageKind;
  readonly publisherId: string;
  readonly buildId: string;
  readonly securityScanId: string;
  readonly compatibilityHash: string;
  readonly channel: 'stable' | 'beta' | 'development';
}

export interface PublishedPackage {
  readonly packageId: string;
  readonly version: string;
  readonly publisherId: string;
  readonly trustLevel: TrustLevel;
  readonly channel: string;
  readonly signature: string;
  readonly evidenceHash: string;
  readonly publishedAt: string;
}

export interface PublishResultV2 {
  readonly ok: boolean;
  readonly published?: PublishedPackage;
  readonly reason?: string;
}

/** MKT2-016/017 — Publishing plane. Publisher -> build -> security scan -> evidence -> sign -> publish. */
export class MarketplacePublisherService {
  private readonly publishers: PublisherStorePort;
  private readonly published: PublishedPackage[] = [];

  constructor(publishers: PublisherStorePort = new InMemoryPublisherStore()) {
    this.publishers = publishers;
  }

  registerPublisher(publisher: PublisherIdentity): void {
    this.publishers.save(publisher);
  }

  publish(request: PublishRequestV2, signerKeyId: string): PublishResultV2 {
    const publisher = this.publishers.get(request.publisherId);
    if (!publisher) return { ok: false, reason: `Unknown publisher "${request.publisherId}"` };

    const payload = `${request.packageId}@${request.version}:${request.buildId}:${request.securityScanId}`;
    const signature = `sig-${hash(payload + signerKeyId)}`;
    const evidenceHash = hash(`${payload}:${request.compatibilityHash}:${signature}`);
    const published: PublishedPackage = {
      packageId: request.packageId,
      version: request.version,
      publisherId: request.publisherId,
      trustLevel: publisher.trustLevel,
      channel: request.channel,
      signature,
      evidenceHash,
      publishedAt: new Date().toISOString(),
    };
    this.published.push(published);
    return { ok: true, published };
  }

  listPublished(): readonly PublishedPackage[] {
    return [...this.published].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
}

function hash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
