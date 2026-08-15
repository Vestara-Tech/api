export interface ShutdownHook {
  readonly name: string;
  close(): Promise<void>;
}

export class ShutdownCoordinator {
  private readonly hooks: ShutdownHook[] = [];
  private shuttingDown = false;

  add(hook: ShutdownHook): void {
    this.hooks.push(hook);
  }

  async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    for (const hook of [...this.hooks].reverse()) {
      try {
        await hook.close();
      } catch (err) {
        console.error(`[shutdown] hook "${hook.name}" failed`, err);
      }
    }
  }
}
