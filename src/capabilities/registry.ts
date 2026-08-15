export interface VestaraCapability {
  readonly id: string;
  readonly namespace: string;
  readonly version: string;
  readonly permissions: readonly string[];
  readonly operations: readonly string[];
}

export interface CapabilityRegistration extends VestaraCapability {
  readonly enabled: boolean;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityRegistration>();

  register(capability: VestaraCapability): void {
    this.capabilities.set(capability.namespace, { ...capability, enabled: true });
  }

  unregister(namespace: string): boolean {
    return this.capabilities.delete(namespace);
  }

  enable(namespace: string): boolean {
    const existing = this.capabilities.get(namespace);
    if (!existing) return false;
    this.capabilities.set(namespace, { ...existing, enabled: true });
    return true;
  }

  disable(namespace: string): boolean {
    const existing = this.capabilities.get(namespace);
    if (!existing) return false;
    this.capabilities.set(namespace, { ...existing, enabled: false });
    return true;
  }

  get(namespace: string): CapabilityRegistration | undefined {
    return this.capabilities.get(namespace);
  }

  has(namespace: string): boolean {
    return this.capabilities.has(namespace);
  }

  list(): readonly CapabilityRegistration[] {
    return [...this.capabilities.values()].sort((a, b) => a.namespace.localeCompare(b.namespace));
  }

  listEnabled(): readonly CapabilityRegistration[] {
    return this.list().filter((c) => c.enabled);
  }
}
