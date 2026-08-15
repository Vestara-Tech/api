export type ServiceFactory<T> = (container: Container) => T;

export class Container {
  private readonly services = new Map<string, unknown>();
  private readonly factories = new Map<string, ServiceFactory<unknown>>();

  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  registerFactory<T>(name: string, factory: ServiceFactory<T>): void {
    this.factories.set(name, factory as ServiceFactory<unknown>);
  }

  resolve<T>(name: string): T {
    if (this.services.has(name)) return this.services.get(name) as T;
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`No service registered for "${name}"`);
    const instance = factory(this);
    this.services.set(name, instance);
    return instance as T;
  }

  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }
}
