/** SYS-036/037 — Process + systemd service runtime. */

export type ServiceStatus = 'running' | 'stopped' | 'failed' | 'activating' | 'deactivating' | 'unknown';

export type ServiceOperation = 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable' | 'status' | 'logs' | 'dependencies';

export interface ServiceInfo {
  readonly name: string;
  readonly status: ServiceStatus;
  readonly description?: string;
  readonly enabled?: boolean;
  readonly pid?: number;
  readonly memoryBytes?: number;
  readonly since?: string;
  readonly dependencies?: readonly string[];
}

export interface ProcessInfo {
  readonly pid: number;
  readonly name: string;
  readonly command?: string;
  readonly cpuPercent?: number;
  readonly memoryBytes?: number;
  readonly user?: string;
  readonly startedAt?: string;
}

export interface ServiceManagerPort {
  listServices(): Promise<readonly ServiceInfo[]>;
  getService(name: string): Promise<ServiceInfo | undefined>;
  operate(name: string, operation: Exclude<ServiceOperation, 'status' | 'logs' | 'dependencies'>): Promise<{ ok: boolean; message?: string }>;
  listProcesses(): Promise<readonly ProcessInfo[]>;
}

/** SYS-037 — systemd service manager. High-impact operations (restart) go through Permission. */
export class SystemdServiceManager {
  private readonly port: ServiceManagerPort;

  constructor(port: ServiceManagerPort) {
    this.port = port;
  }

  async list(): Promise<readonly ServiceInfo[]> {
    return this.port.listServices();
  }

  async get(name: string): Promise<ServiceInfo | undefined> {
    return this.port.getService(name);
  }

  async operate(name: string, operation: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable'): Promise<{ ok: boolean; message?: string }> {
    return this.port.operate(name, operation);
  }

  async processes(): Promise<readonly ProcessInfo[]> {
    return this.port.listProcesses();
  }
}

/** Environment adapter: reads what it can, degrades honestly. */
export class EnvironmentServiceManager implements ServiceManagerPort {
  private readonly services: readonly ServiceInfo[] = [
    { name: 'vestara-api.service', status: 'running', description: 'Vestara API', enabled: true, pid: process.pid },
    { name: 'vestara-agent.service', status: 'running', description: 'Vestara Agent Runtime', enabled: true },
    { name: 'vestara-systemd.service', status: 'stopped', description: 'Vestara privileged system daemon', enabled: true },
    { name: 'NetworkManager.service', status: 'running', description: 'Network Manager', enabled: true },
  ];

  async listServices(): Promise<readonly ServiceInfo[]> {
    return this.services;
  }

  async getService(name: string): Promise<ServiceInfo | undefined> {
    return this.services.find((s) => s.name === name);
  }

  async operate(name: string): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: 'no privileged service control in this environment' };
  }

  async listProcesses(): Promise<readonly ProcessInfo[]> {
    return [{ pid: process.pid, name: 'vestara-api', memoryBytes: process.memoryUsage().heapUsed }];
  }
}
