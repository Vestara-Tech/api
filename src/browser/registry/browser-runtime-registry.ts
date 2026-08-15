import { notFound } from '../../core/errors.js';
import type { BrowserRuntime, BrowserRuntimeId } from '../contracts.js';

/** BRW-002 — Browser runtime registry. Playwright/CDP deterministic; Browser Use agentic. */
export class BrowserRuntimeRegistry {
  private readonly runtimes = new Map<BrowserRuntimeId, BrowserRuntime>();

  register(runtime: BrowserRuntime): void {
    this.runtimes.set(runtime.id, runtime);
  }

  get(id: BrowserRuntimeId): BrowserRuntime {
    const runtime = this.runtimes.get(id);
    if (!runtime) throw notFound(`Browser runtime "${id}" not found`);
    return runtime;
  }

  list(): readonly BrowserRuntime[] {
    return [...this.runtimes.values()];
  }
}
