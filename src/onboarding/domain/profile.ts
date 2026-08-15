export type DeploymentProfileId =
  | 'personal'
  | 'developer'
  | 'team'
  | 'server'
  | 'organization'
  | 'custom';

export interface DeploymentProfile {
  readonly id: DeploymentProfileId;
  readonly label: string;
  readonly description: string;
  readonly defaults: {
    readonly auth: readonly string[];
    readonly generatorsEnabled: boolean;
    readonly apiBuilderEnabled: boolean;
    readonly databasePreference?: string;
    readonly serviceIdentities?: boolean;
    readonly aiOptional: boolean;
    readonly hardenedNetworking?: boolean;
  };
}

export const DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = [
  {
    id: 'personal',
    label: 'Personal',
    description: 'Single-user local environment',
    defaults: { auth: ['local'], generatorsEnabled: false, apiBuilderEnabled: false, databasePreference: 'local', aiOptional: true },
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Development and engineering workspace',
    defaults: { auth: ['local'], generatorsEnabled: true, apiBuilderEnabled: true, databasePreference: 'local', aiOptional: true },
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Shared collaborative environment',
    defaults: { auth: ['local'], generatorsEnabled: true, apiBuilderEnabled: true, databasePreference: 'postgres', aiOptional: true },
  },
  {
    id: 'server',
    label: 'Server',
    description: 'Headless/service deployment',
    defaults: { auth: ['local'], generatorsEnabled: false, apiBuilderEnabled: false, databasePreference: 'postgres', serviceIdentities: true, aiOptional: true, hardenedNetworking: true },
  },
  {
    id: 'organization',
    label: 'Organization',
    description: 'Managed multi-user platform',
    defaults: { auth: ['local'], generatorsEnabled: true, apiBuilderEnabled: true, databasePreference: 'postgres', serviceIdentities: true, aiOptional: true, hardenedNetworking: true },
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Configure capabilities manually',
    defaults: { auth: ['local'], generatorsEnabled: true, apiBuilderEnabled: true, aiOptional: true },
  },
];

export function getProfile(id: DeploymentProfileId): DeploymentProfile {
  return DEPLOYMENT_PROFILES.find((p) => p.id === id) ?? DEPLOYMENT_PROFILES[DEPLOYMENT_PROFILES.length - 1]!;
}
