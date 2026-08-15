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
import { SystemV2Service } from '../system/service/system-v2-service.js';
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
import type { MarketplacePlatform } from './marketplace.js';
import type { GenerationPlanePlatform } from './generation-plane.js';
import type { BuilderPlanePlatform } from './builder-plane.js';
import type { DiagnosticsPlatform } from './diagnostics.js';
import type { LogPlatform } from './log.js';
import type { DatabasePlatform } from './database.js';
import type { TestPlatform } from './test.js';
import type { BrowserPlatform } from './browser.js';
import type { TaskPlatform } from './task.js';
import type { MilestonePlatform } from './milestone.js';
import { buildConfigurationService, buildExpandedConfiguration } from './configuration.js';
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
import { buildMarketplacePlatform } from './marketplace.js';
import { buildGenerationPlanePlatform } from './generation-plane.js';
import { buildBuilderPlanePlatform } from './builder-plane.js';
import { buildDiagnosticsPlatform } from './diagnostics.js';
import { buildLogPlatform } from './log.js';
import { buildDatabasePlatform } from './database.js';
import { buildTestPlatform } from './test.js';
import { buildBrowserPlatform } from './browser.js';
import { buildTaskPlatform } from './task.js';
import { buildMilestonePlatform } from './milestone.js';
import { registerSystemCapability } from './capabilities.js';
import { buildComponentPlatform } from './component.js';
import { registerComponentCapability } from './component-capability.js';
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
import { registerMarketplaceCapability } from './marketplace-capability.js';
import { registerDiagnosticsCapability } from './diagnostics-capability.js';
import { registerLogCapability } from './log-capability.js';
import { registerDatabaseCapability } from './database-capability.js';
import { registerTestCapability } from './test-capability.js';
import { registerBrowserCapability } from './browser-capability.js';
import { registerTaskCapability } from './task-capability.js';
import { registerMilestoneCapability } from './milestone-capability.js';
import { Container } from './container.js';
import { ShutdownCoordinator } from './shutdown.js';

export interface SystemStatus {
  readonly service: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
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
  readonly marketplace: MarketplacePlatform;
  readonly generationPlane: GenerationPlanePlatform;
  readonly builderPlane: BuilderPlanePlatform;
  readonly diagnostics: DiagnosticsPlatform;
  readonly log: LogPlatform;
  readonly database: DatabasePlatform;
  readonly test: TestPlatform;
  readonly browser: BrowserPlatform;
  readonly task: TaskPlatform;
  readonly milestone: MilestonePlatform;
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

  // ── Expanded Configuration (CONFIG-009..016) ──────────────
  const configExpanded = buildExpandedConfiguration(configuration);

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
  const systemV2 = new SystemV2Service();

  // ── Boot presentation (SYS-015..025) ───────────────────────
  const bootPresentation = buildBootPresentationService();

  // ── GRUB configuration (SYS-019..022) ──────────────────────
  const grubConfiguration = buildGrubConfigurationService();

  // ── Startup (DESK-001..008) ────────────────────────────────
  const startup = buildStartupCoordinator(events);

  // ── Login (LOGIN-001..014) ─────────────────────────────────
  const loginPlatform = buildLoginPlatform();

  // ── OS Image Builder (IMG-001..026) ────────────────────────
  const { service: imageBuilder, platformV2: imagePlatformV2, execution: imageExecution } = buildImageBuilderService(events);

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

  // ── Marketplace (MKT-001..) ────────────────────────────────
  const marketplace = buildMarketplacePlatform();

  // ── Generation Plane (GEN-X) ───────────────────────────────
  const generationPlane = buildGenerationPlanePlatform({
    permission: {
      canGenerate: async () => true,
      canApply: async (_p, capability) => !capability.includes('apply'),
    },
  });

  // ── Builder Plane (BLD-X) ─────────────────────────────────
  const builderPlane = buildBuilderPlanePlatform();

  // ── Diagnostics (DIAG-001..) ──────────────────────────────
  const diagnostics = buildDiagnosticsPlatform({ image: imageBuilder });

  // ── Log Module (LOG-001..) ────────────────────────────────
  const log = buildLogPlatform();

  // ── Database Module (DB-001..) ────────────────────────────
  const database = buildDatabasePlatform();

  // ── Test Module (TEST-001..) ──────────────────────────────
  const test = buildTestPlatform();

  // ── Browser Module (BRW-001..) ────────────────────────────
  const browser = buildBrowserPlatform();

  // ── Task Module (TASK-001..) ──────────────────────────────
  const task = buildTaskPlatform();

  // ── Milestone Module (MS-001..) ───────────────────────────
  const milestone = buildMilestonePlatform({ tasks: task.service });

  // ── Component Module (COMP-001..013) ──────────────────────
  const component = buildComponentPlatform({ resolveCapability: (cap) => capabilities.has(cap.split('.')[0] ?? cap) });

  registerSystemCapability(capabilities, config);
  registerBuilderCapability(capabilities, config);
  registerAuthCapability(capabilities, config);
  registerConfigCapability(capabilities, config);
  registerGeneratorCapability(capabilities, config);
  registerComponentCapability(capabilities, config);
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
  registerMarketplaceCapability(capabilities, config);
  registerDiagnosticsCapability(capabilities, config);
  registerLogCapability(capabilities, config);
  registerDatabaseCapability(capabilities, config);
  registerTestCapability(capabilities, config);
  registerBrowserCapability(capabilities, config);
  registerTaskCapability(capabilities, config);
  registerMilestoneCapability(capabilities, config);

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
  container.register('config.expanded', configExpanded.expanded);
  container.register('config.contributions', configExpanded.contributions);
  container.register('generator.registry', generatorRegistry);
  container.register('generator.service', generatorService);
  container.register('onboarding', onboarding);
  container.register('system', system);
  container.register('system.v2', systemV2);
  container.register('bootPresentation', bootPresentation);
  container.register('grubConfiguration', grubConfiguration);
  container.register('startup', startup);
  container.register('loginBroker', loginPlatform.broker);
  container.register('login.sessions', loginPlatform.sessions);
  container.register('login.rateLimit', loginPlatform.rateLimit);
  container.register('imageBuilder', imageBuilder);
  container.register('image.platformV2', imagePlatformV2);
  container.register('image.execution', imageExecution);
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
  container.register('marketplace', marketplace.catalog);
  container.register('marketplace.catalog', marketplace.catalog);
  container.register('marketplace.registry', marketplace.registry);
  container.register('marketplace.installer', marketplace.installer);
  container.register('marketplace.lifecycle', marketplace.lifecycle);
  container.register('marketplace.dependencies', marketplace.dependencies);
  container.register('marketplace.compatibility', marketplace.compatibility);
  container.register('marketplace.permissions', marketplace.permissions);
  container.register('generation.plane', generationPlane.plane);
  container.register('generation.registry', generationPlane.registry);
  container.register('builder.plane.registry', builderPlane.registry);
  container.register('builder.plane.store', builderPlane.store);
  container.register('builder.plane.lifecycle', builderPlane.lifecycle);
  container.register('diagnostics.registry', diagnostics.registry);
  container.register('diagnostics.executor', diagnostics.executor);
  container.register('log.service', log.service);
  container.register('log.store', log.store);
  container.register('database', database.service);
  container.register('database.store', database.store);
  container.register('database.adapters', database.adapters);
  container.register('test.service', test.service);
  container.register('test.registry', test.registry);
  container.register('browser.service', browser.service);
  container.register('browser.runtimes', browser.runtimes);
  container.register('browser.sessions', browser.sessions);
  container.register('browser.evidence', browser.evidence);
  container.register('task.service', task.service);
  container.register('task.store', task.store);
  container.register('milestone.service', milestone.service);
  container.register('milestone.store', milestone.store);
  container.register('component.registry', component.registry);
  container.register('component.service', component.service);

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
    marketplace,
    generationPlane,
    builderPlane,
    diagnostics,
    log,
    database,
    test,
    browser,
    task,
    milestone,
    shutdown,
    systemStatus(): SystemStatus {
      return {
        service: config.service,
        apiVersion: config.apiVersion,
        contractVersion: config.contractVersion,
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
