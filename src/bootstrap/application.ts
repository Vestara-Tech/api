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
import type { GrubConfigurationService } from '../system/grub/service/grub-configuration-service.js';
import type { StartupCoordinator } from '../startup/service/startup-coordinator.js';
import type { LoginBroker } from '../login/service/login-broker.js';
import type { ImageBuildService } from '../image/service/image-build-service.js';
import type { AiService } from '../ai/runtime/ai-runtime.js';
import type { AgentPlatform } from './agent-platform.js';
import type { WorkflowPlatform } from './workflow.js';
import type { FilePlatform } from './file.js';
import type { ContextPlatform } from './context.js';
import type { PermissionPlatform } from './permission.js';
import type { CarPlatform } from './car.js';
import { buildConfigurationService } from './configuration.js';
import { buildGeneratorPlatform } from './generator.js';
import { buildOnboardingService } from './onboarding.js';
import { buildBootPresentationService } from './boot-presentation.js';
import { buildGrubConfigurationService } from './grub-configuration.js';
import { buildStartupCoordinator } from './startup.js';
import { buildLoginPlatform } from './login.js';
import { buildImageBuilderService } from './image-builder.js';
import { buildAiService } from './ai.js';
import { buildAgentPlatform } from './agent-platform.js';
import { buildWorkflowPlatform } from './workflow.js';
import { buildFilePlatform } from './file.js';
import { buildContextPlatform } from './context.js';
import { buildPermissionPlatform } from './permission.js';
import { buildCarPlatform } from './car.js';
import { registerSystemCapability } from './capabilities.js';
import { registerBuilderCapability } from './builder-capability.js';
import { registerAuthCapability } from './auth-capability.js';
import { registerConfigCapability } from './config-capability.js';
import { registerGeneratorCapability } from './generator-capability.js';
import { registerOnboardingCapability } from './onboarding-capability.js';
import { registerSystemModuleCapability } from './system-capability.js';
import { registerStartupCapability } from './startup-capability.js';
import { registerLoginCapability } from './login-capability.js';
import { registerImageCapability } from './image-capability.js';
import { registerAiCapability } from './ai-capability.js';
import { registerAgentCapability } from './agent-capability.js';
import { registerWorkflowCapability } from './workflow-capability.js';
import { registerFileCapability } from './file-capability.js';
import { registerContextCapability } from './context-capability.js';
import { registerPermissionCapability } from './permission-capability.js';
import { registerCarCapability } from './car-capability.js';
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
  readonly grubConfiguration: GrubConfigurationService;
  readonly startup: StartupCoordinator;
  readonly login: LoginBroker;
  readonly imageBuilder: ImageBuildService;
  readonly ai: AiService;
  readonly agents: AgentPlatform;
  readonly workflow: WorkflowPlatform;
  readonly file: FilePlatform;
  readonly context: ContextPlatform;
  readonly permission: PermissionPlatform;
  readonly car: CarPlatform;
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

  // ── GRUB configuration (SYS-019..022) ──────────────────────
  const grubConfiguration = buildGrubConfigurationService();

  // ── Startup (DESK-001..008) ────────────────────────────────
  const startup = buildStartupCoordinator(events);

  // ── Login (LOGIN-001..014) ─────────────────────────────────
  const loginPlatform = buildLoginPlatform();

  // ── OS Image Builder (IMG-001..026) ────────────────────────
  const imageBuilder = buildImageBuilderService();

  // ── AI Platform (AI-001..006) ─────────────────────────────
  const { service: ai, registry: aiProviders, catalog: aiCatalog, router: aiRouter } = buildAiService();

  // ── File Module (FILE-001..) ──────────────────────────────
  const file = buildFilePlatform();

  // ── Agent Platform (AGENT + TOOL + SKILL) ─────────────────
  const agents = buildAgentPlatform({ ai, builder, generatorRegistry, generation: generatorService, file: file.service });

  // ── Workflow Module (WF-001..015) ─────────────────────────
  const workflow = buildWorkflowPlatform({ agents: agents.runtime, tools: agents.toolRuntime });

  // ── Context Module (CTX-001..) ────────────────────────────
  const context = buildContextPlatform({ agents: agents.agents, workflow: workflow.runtime });

  // ── Permission Module (PERM-001..) ────────────────────────
  const permission = buildPermissionPlatform({
    roles: [
      { id: 'engineering.developer', name: 'Developer', permissions: ['file.read', 'file.write', 'file.search', 'agent.run', 'workflow.execute', 'generator.plan', 'generator.run'] },
      { id: 'engineering.reviewer', name: 'Reviewer', permissions: ['file.read', 'file.search', 'workflow.read'] },
      { id: 'engineering.observer', name: 'Observer', permissions: ['file.read', 'workflow.read'] },
    ],
  });

  // ── Coding Agent Runtime (CAR-001..) ──────────────────────
  const car = buildCarPlatform({ agents: agents.runtime, tools: agents.toolRuntime, approvals: agents.approvals });

  registerSystemCapability(capabilities, config);
  registerBuilderCapability(capabilities, config);
  registerAuthCapability(capabilities, config);
  registerConfigCapability(capabilities, config);
  registerGeneratorCapability(capabilities, config);
  registerOnboardingCapability(capabilities, config);
  registerSystemModuleCapability(capabilities, config);
  registerStartupCapability(capabilities, config);
  registerLoginCapability(capabilities, config);
  registerImageCapability(capabilities, config);
  registerAiCapability(capabilities, config);
  registerAgentCapability(capabilities, config);
  registerWorkflowCapability(capabilities, config);
  registerFileCapability(capabilities, config);
  registerContextCapability(capabilities, config);
  registerPermissionCapability(capabilities, config);
  registerCarCapability(capabilities, config);

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
  container.register('grubConfiguration', grubConfiguration);
  container.register('startup', startup);
  container.register('loginBroker', loginPlatform.broker);
  container.register('login.sessions', loginPlatform.sessions);
  container.register('login.rateLimit', loginPlatform.rateLimit);
  container.register('imageBuilder', imageBuilder);
  container.register('ai', ai);
  container.register('ai.providers', aiProviders);
  container.register('ai.catalog', aiCatalog);
  container.register('ai.router', aiRouter);
  container.register('agents', agents.runtime);
  container.register('agent.registry', agents.agents);
  container.register('agent.runs', agents.runs);
  container.register('agent.approvals', agents.approvals);
  container.register('tools', agents.tools);
  container.register('tool.runtime', agents.toolRuntime);
  container.register('skills', agents.skills);
  container.register('workflow', workflow.service);
  container.register('workflow.registry', workflow.registry);
  container.register('workflow.runtime', workflow.runtime);
  container.register('file', file.service);
  container.register('context', context.service);
  container.register('context.registry', context.registry);
  container.register('permission', permission.service);
  container.register('permission.registry', permission.registry);
  container.register('permission.grants', permission.grants);
  container.register('car', car.selector);
  container.register('car.registry', car.registry);
  container.register('car.gateway', car.gateway);

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
    grubConfiguration,
    startup,
    login: loginPlatform.broker,
    imageBuilder,
    ai,
    agents,
    workflow,
    file,
    context,
    permission,
    car,
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
