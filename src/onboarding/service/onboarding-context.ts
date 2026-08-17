import type { CapabilityRegistry } from '../../capabilities/registry.js';
import type { ConfigurationService } from '../../configuration/service/configuration-service.js';
import type { GeneratorRegistry } from '../../generator/registry/generator-registry.js';
import type { IdentityService } from '../../auth/service/identity-service.js';
import type { MarketplacePlatform } from '../../bootstrap/marketplace.js';
import type { AiService } from '../../ai/runtime/ai-runtime.js';
import type { AgentPlatform } from '../../bootstrap/agent-platform.js';
import type { DatabasePlatform } from '../../bootstrap/database.js';
import type { FilePlatform } from '../../bootstrap/file.js';
import type { DiagnosticsPlatform } from '../../bootstrap/diagnostics.js';

/**
 * ONB-024 — Extended onboarding context.
 *
 * Contributors receive the context, never reach into globals. The context
 * now includes all platform services needed for the provisioning &
 * composition engine.
 */
export interface OnboardingContext {
  readonly capabilities: CapabilityRegistry;
  readonly configuration: ConfigurationService;
  readonly generators: GeneratorRegistry;
  readonly identities: IdentityService;
  readonly marketplace: MarketplacePlatform | undefined;
  readonly ai: AiService | undefined;
  readonly agents: AgentPlatform | undefined;
  readonly database: DatabasePlatform | undefined;
  readonly file: FilePlatform | undefined;
  readonly diagnostics: DiagnosticsPlatform | undefined;
}
