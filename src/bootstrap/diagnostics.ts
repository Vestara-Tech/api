import type { ImageBuildService } from '../image/service/image-build-service.js';
import { DiagnosticRegistry } from '../diagnostics/registry.js';
import { DiagnosticExecutor } from '../diagnostics/executor.js';
import { systemDiagnostics } from '../diagnostics/contributions/system.js';
import { imageBuilderDiagnostics } from '../diagnostics/contributions/image-builder.js';

export interface DiagnosticsPlatformOptions {
  readonly image: ImageBuildService;
  readonly env?: Readonly<Record<string, unknown>>;
}

export interface DiagnosticsPlatform {
  readonly registry: DiagnosticRegistry;
  readonly executor: DiagnosticExecutor;
}

/** DIAG — Composition root. Registers System + Image Builder diagnostics. */
export function buildDiagnosticsPlatform(options: DiagnosticsPlatformOptions): DiagnosticsPlatform {
  const registry = new DiagnosticRegistry();
  registry.register(systemDiagnostics);
  registry.register(imageBuilderDiagnostics(options.image));
  const executor = new DiagnosticExecutor(registry, options.env ?? {});
  return { registry, executor };
}
