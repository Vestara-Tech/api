import type { CapabilityRegistry } from '../capabilities/registry.js';
import { CapabilityRegistry as CapabilityRegistryImpl } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';
import { CommandBus } from '../core/commands.js';
import { EventBus } from '../core/events.js';
import { OperationStore } from '../core/operations.js';
import { QueryBus } from '../core/queries.js';
import { ApiDefinitionService } from '../builder/service/api-definition-service.js';
import { ContractCompiler } from '../builder/compiler/index.js';
import { CompatibilityAnalyzer } from '../builder/domain/compatibility.js';
import { DefinitionValidator } from '../builder/domain/validator.js';
import { InMemoryDraftStore } from '../builder/store/in-memory.js';
import { registerSystemCapability } from './capabilities.js';
import { registerBuilderCapability } from './builder-capability.js';
import { Container } from './container.js';
import { ShutdownCoordinator } from './shutdown.js';

export interface SystemStatus {
  readonly service: string;
  readonly apiVersion: string;
  readonly uptimeMs: number;
  readonly startedAt: string;
  readonly capabilities: string[];
}

export interface Application {
  readonly config: AppConfig;
  readonly container: Container;
  readonly commands: CommandBus;
  readonly queries: QueryBus;
  readonly events: EventBus;
  readonly operations: OperationStore;
  readonly capabilities: CapabilityRegistry;
  readonly builder: ApiDefinitionService;
  readonly shutdown: ShutdownCoordinator;
  systemStatus(): SystemStatus;
  close(): Promise<void>;
}

export function createApplication(config: AppConfig): Application {
  const container = new Container();
  const commands = new CommandBus();
  const queries = new QueryBus();
  const events = new EventBus();
  const operations = new OperationStore();
  const capabilities = new CapabilityRegistryImpl();
  const shutdown = new ShutdownCoordinator();

  const builder = new ApiDefinitionService({
    store: new InMemoryDraftStore(),
    compiler: new ContractCompiler(),
    validator: new DefinitionValidator(),
    analyzer: new CompatibilityAnalyzer(),
    operations,
    events,
  });

  registerSystemCapability(capabilities, config);
  registerBuilderCapability(capabilities, config);

  container.register('commands', commands);
  container.register('queries', queries);
  container.register('events', events);
  container.register('operations', operations);
  container.register('capabilities', capabilities);
  container.register('builder', builder);

  const startedAt = Date.now();

  const application: Application = {
    config,
    container,
    commands,
    queries,
    events,
    operations,
    capabilities,
    builder,
    shutdown,
    systemStatus(): SystemStatus {
      return {
        service: config.service,
        apiVersion: config.apiVersion,
        uptimeMs: Date.now() - startedAt,
        startedAt: new Date(startedAt).toISOString(),
        capabilities: capabilities.listEnabled().map((c) => c.namespace),
      };
    },
    async close() {
      await shutdown.shutdown('application-close');
    },
  };

  return application;
}
