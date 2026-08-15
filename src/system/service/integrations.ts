/** SYS-058..064 — System integrations (diagnostics, log, config, generator, image). */

import type { SystemSnapshot } from '../inventory/domain.js';

export interface SystemLogSink {
  info(source: string, message: string, attrs?: Readonly<Record<string, unknown>>): void;
  warn(source: string, message: string, attrs?: Readonly<Record<string, unknown>>): void;
  error(source: string, message: string, attrs?: Readonly<Record<string, unknown>>): void;
}

export interface SystemDiagnosticsPort {
  runCheck(moduleId: string): Promise<readonly { checkId: string; status: string; message: string }[]>;
}

export interface SystemGeneratorPort {
  generate(kind: string, input: unknown): Promise<readonly { kind: string; path: string; artifactHash: string }[]>;
}

export interface SystemImagePort {
  planV2(profileId: string, target: string, hardwareId: string): Promise<unknown>;
  preflight(profileId: string, target: string, hardwareId: string): Promise<unknown>;
}

export interface SystemIntegrationOptions {
  readonly log?: SystemLogSink;
  readonly diagnostics?: SystemDiagnosticsPort;
  readonly generator?: SystemGeneratorPort;
  readonly image?: SystemImagePort;
}

export interface SystemHealthStatus {
  readonly api: 'running';
  readonly agentRuntime: 'running';
  readonly systemd: 'running' | 'stopped' | 'unknown';
  readonly bootSlot: string;
  readonly recovery: 'healthy' | 'unknown';
  readonly cpuPercent?: number;
  readonly memoryUsedBytes?: number;
  readonly diskUsedPercent?: number;
  readonly temperatureCelsius?: number;
  readonly measuredAt: string;
}

/**
 * SYS-058..064 — System integrations. System owns raw machine health;
 * Diagnostics interprets it. System logs through the Log module. System
 * settings register through Configuration (desired state). Generator
 * produces system artifacts; the daemon applies them. The Image Builder
 * consumes System contracts via the Image port.
 */
export class SystemIntegrations {
  private readonly log: SystemLogSink | undefined;
  private readonly diagnostics: SystemDiagnosticsPort | undefined;
  private readonly generator: SystemGeneratorPort | undefined;
  private readonly image: SystemImagePort | undefined;

  constructor(options: SystemIntegrationOptions = {}) {
    this.log = options.log;
    this.diagnostics = options.diagnostics;
    this.generator = options.generator;
    this.image = options.image;
  }

  async health(snapshot: SystemSnapshot): Promise<SystemHealthStatus> {
    const status: SystemHealthStatus = {
      api: 'running',
      agentRuntime: 'running',
      systemd: snapshot.boot.status === 'supported' ? 'running' : 'unknown',
      bootSlot: snapshot.boot.slot?.active ?? 'A',
      recovery: snapshot.filesystems.status === 'supported' ? 'healthy' : 'unknown',
      ...(snapshot.cpu.loadAverage1 !== undefined ? { cpuPercent: Math.min(100, Math.round(snapshot.cpu.loadAverage1 * 10)) } : {}),
      ...(snapshot.memory.availableBytes !== undefined ? { memoryUsedBytes: snapshot.memory.totalBytes - snapshot.memory.availableBytes } : {}),
      measuredAt: new Date().toISOString(),
    };
    this.log?.info('system', 'system.health.measured', { ...status });
    return status;
  }

  async runDiagnostics(moduleId: string) {
    if (!this.diagnostics) return [];
    this.log?.info('system', 'system.diagnostics.run', { moduleId });
    return this.diagnostics.runCheck(moduleId);
  }

  async generateArtifacts(kind: string, input: unknown) {
    if (!this.generator) return [];
    this.log?.info('system', 'system.artifacts.generate', { kind });
    return this.generator.generate(kind, input);
  }

  async imagePlan(profileId: string, target: string, hardwareId: string) {
    if (!this.image) return null;
    return this.image.planV2(profileId, target, hardwareId);
  }

  async imagePreflight(profileId: string, target: string, hardwareId: string) {
    if (!this.image) return null;
    return this.image.preflight(profileId, target, hardwareId);
  }

  configured(): { log: boolean; diagnostics: boolean; generator: boolean; image: boolean } {
    return {
      log: this.log !== undefined,
      diagnostics: this.diagnostics !== undefined,
      generator: this.generator !== undefined,
      image: this.image !== undefined,
    };
  }
}
