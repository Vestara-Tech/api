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
import { ScryptPasswordHashing } from '../auth/domain/password.js';
import { IdentityService } from '../auth/service/identity-service.js';
import { AuthenticationService } from '../auth/service/authentication-service.js';
import { AuthorizationService } from '../auth/service/authorization-service.js';
import { InMemoryIdentityStore } from '../auth/store/in-memory-identity.js';
import { InMemoryCredentialStore } from '../auth/store/in-memory-credential.js';
import { InMemorySessionStore } from '../auth/store/in-memory-session.js';
import type { ConfigurationService } from '../configuration/service/configuration-service.js';
import type { GeneratorRegistry } from '../generator/registry/generator-registry.js';
import type { GenerationService } from '../generator/service/generation-service.js';
import type { OnboardingService } from '../onboarding/service/onboarding-service.js';
import type { SystemService } from '../system/service/system-service.js';
import { SystemService as SystemServiceImpl } from '../system/service/system-service.js';
import type { BootPresentationService } from '../system/boot-presentation/service/boot-presentation-service.js';
import { buildConfigurationService } from './configuration.js';
import { buildGeneratorPlatform } from './generator.js';
import { buildOnboardingService } from './onboarding.js';
import { buildBootPresentationService } from './boot-presentation.js';
import { registerSystemCapability } from './capabilities.js';
import { registerBuilderCapability } from './builder-capability.js';
import { registerAuthCapability } from './auth-capability.js';
import { registerConfigCapability } from './config-capability.js';
import { registerGeneratorCapability } from './generator-capability.js';
import { registerOnboardingCapability } from './onboarding-capability.js';
import { registerSystemModuleCapability } from './system-capability.js';
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
  readonly identities: IdentityService;
  readonly authentication: AuthenticationService;
  readonly authorization: AuthorizationService;
  readonly configuration: ConfigurationService;
  readonly generators: GeneratorRegistry;
  readonly generation: GenerationService;
  readonly onboarding: OnboardingService;
  readonly system: SystemService;
  readonly bootPresentation: BootPresentationService;
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

  // ── Authentication (AUTH-001..006) ─────────────────────────────
  const identityStore = new InMemoryIdentityStore();
  const credentialStore = new InMemoryCredentialStore();
  const sessionStore = new InMemorySessionStore();
  const identities = new IdentityService({ store: identityStore });
  const authentication = new AuthenticationService({
    identityStore,
    credentialStore,
    sessionStore,
    passwords: new ScryptPasswordHashing(),
  });
  const authorization = new AuthorizationService();

  // ── Configuration (CONFIG-001..008) ─────────────────────────
  const configuration = buildConfigurationService(config);

  // ── Generator (GEN-001..012) ───────────────────────────────
  const { registry: generatorRegistry, service: generatorService } = buildGeneratorPlatform();

  // ── Onboarding (ONB-001..009) ──────────────────────────────
  const onboarding = buildOnboardingService({
    capabilities,
    configuration,
    generators: generatorRegistry,
    identities,
  });

  // ── System/Firmware (SYS-001..014) ─────────────────────────
  const system = new SystemServiceImpl({ authorization });

  // ── Boot presentation (SYS-015..025) ───────────────────────
  const bootPresentation = buildBootPresentationService();

  registerSystemCapability(capabilities, config);
  registerBuilderCapability(capabilities, config);
  registerAuthCapability(capabilities, config);
  registerConfigCapability(capabilities, config);
  registerGeneratorCapability(capabilities, config);
  registerOnboardingCapability(capabilities, config);
  registerSystemModuleCapability(capabilities, config);

  container.register('commands', commands);
  container.register('queries', queries);
  container.register('events', events);
  container.register('operations', operations);
  container.register('capabilities', capabilities);
  container.register('builder', builder);
  container.register('auth.identities', identities);
  container.register('auth.authentication', authentication);
  container.register('auth.authorization', authorization);
  container.register('auth.identityStore', identityStore);
  container.register('auth.credentialStore', credentialStore);
  container.register('auth.sessionStore', sessionStore);
  container.register('configuration', configuration);
  container.register('generator.registry', generatorRegistry);
  container.register('generator.service', generatorService);
  container.register('onboarding', onboarding);
  container.register('system', system);
  container.register('bootPresentation', bootPresentation);

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
    identities,
    authentication,
    authorization,
    configuration,
    generators: generatorRegistry,
    generation: generatorService,
    onboarding,
    system,
    bootPresentation,
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
