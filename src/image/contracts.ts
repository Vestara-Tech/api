import { Type, type Static } from '@sinclair/typebox';

export const ArchitectureSchema = Type.Union([Type.Literal('amd64'), Type.Literal('arm64')]);

export const BaseSystemProfileSchema = Type.Object({
  distribution: Type.Literal('debian'),
  release: Type.String(),
  kernel: Type.String(),
});

export const BootProfileSchema = Type.Object({
  grub: Type.Object({
    enabled: Type.Boolean(),
    timeout: Type.Integer(),
    theme: Type.Optional(Type.String()),
  }),
  plymouth: Type.Object({
    enabled: Type.Boolean(),
    theme: Type.String(),
  }),
  firmwareLogo: Type.Object({
    mode: Type.Union([Type.Literal('runtime-if-supported'), Type.Literal('none')]),
  }),
});

export const SystemProfileSchema = Type.Object({
  abSlots: Type.Boolean(),
  recovery: Type.Boolean(),
});

export const LoginProfileSchema = Type.Object({
  provider: Type.Literal('vestara'),
  password: Type.Boolean(),
  fingerprint: Type.Union([Type.Literal('auto'), Type.Literal('disabled')]),
  fido2: Type.Union([Type.Literal('auto'), Type.Literal('disabled')]),
});

export const OnboardingProfileSchema = Type.Object({
  firstBoot: Type.Boolean(),
});

export const DesktopProfileSchema = Type.Object({
  session: Type.Union([Type.Literal('vestara'), Type.Literal('fallback')]),
  startupApp: Type.String(),
  desktopApp: Type.String(),
});

export const PackageProfileSchema = Type.Object({
  extraPackages: Type.Readonly(Type.Array(Type.String())),
});

export const SecurityProfileSchema = Type.Object({
  noDefaultOwner: Type.Boolean(),
  sanitizeSecrets: Type.Boolean(),
});

export const RecoveryProfileSchema = Type.Object({
  enabled: Type.Boolean(),
  includes: Type.Readonly(Type.Array(Type.String())),
});

export const ApplicationProfileSchema = Type.Object({
  applications: Type.Readonly(Type.Array(Type.String())),
});

export const ImageProfileSchema = Type.Object({
  id: Type.String(),
  version: Type.String(),
  architecture: ArchitectureSchema,
  base: BaseSystemProfileSchema,
  boot: BootProfileSchema,
  system: SystemProfileSchema,
  applications: ApplicationProfileSchema,
  onboarding: OnboardingProfileSchema,
  login: LoginProfileSchema,
  desktop: DesktopProfileSchema,
  packages: PackageProfileSchema,
  security: SecurityProfileSchema,
  recovery: RecoveryProfileSchema,
  profileHash: Type.String(),
});

export const UpdateImageProfileBodySchema = Type.Partial(
  Type.Omit(ImageProfileSchema, ['id', 'profileHash']),
);

export const ImageBuildTargetSchema = Type.Union([
  Type.Literal('raw'),
  Type.Literal('installer'),
  Type.Literal('virtual'),
]);

export const ImagePlanItemSchema = Type.Object({
  stage: Type.String(),
  description: Type.String(),
  generated: Type.Readonly(Type.Array(Type.String())),
});

export const ImageBuildPlanSchema = Type.Object({
  profileId: Type.String(),
  profileHash: Type.String(),
  target: ImageBuildTargetSchema,
  items: Type.Readonly(Type.Array(ImagePlanItemSchema)),
  planHash: Type.String(),
});

export const ImageBuildStateSchema = Type.Object({
  buildId: Type.String(),
  status: Type.Union([
    Type.Literal('draft'),
    Type.Literal('planning'),
    Type.Literal('building'),
    Type.Literal('verifying'),
    Type.Literal('completed'),
    Type.Literal('failed'),
  ]),
  currentStage: Type.Optional(Type.String()),
  completedStages: Type.Readonly(Type.Array(Type.String())),
  failedStage: Type.Optional(Type.String()),
  failureMessage: Type.Optional(Type.String()),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
});

export const ImageBuildEvidenceSchema = Type.Object({
  planHash: Type.String(),
  artifactPath: Type.String(),
  evidenceHash: Type.String(),
});

export const ImageBuildResultSchema = Type.Object({
  state: ImageBuildStateSchema,
  plan: ImageBuildPlanSchema,
  evidence: ImageBuildEvidenceSchema,
});

export const ImageErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

export const PlanRequestSchema = Type.Object({
  profileId: Type.String(),
  target: ImageBuildTargetSchema,
});

export const BuildRequestSchema = Type.Object({
  profileId: Type.String(),
  target: ImageBuildTargetSchema,
  approved: Type.Boolean(),
});

export type ImageProfileContract = Static<typeof ImageProfileSchema>;
export type UpdateImageProfileBodyContract = Static<typeof UpdateImageProfileBodySchema>;
export type ImageBuildTargetContract = Static<typeof ImageBuildTargetSchema>;
export type ImagePlanItemContract = Static<typeof ImagePlanItemSchema>;
export type ImageBuildPlanContract = Static<typeof ImageBuildPlanSchema>;
export type ImageBuildStateContract = Static<typeof ImageBuildStateSchema>;
export type ImageBuildEvidenceContract = Static<typeof ImageBuildEvidenceSchema>;
export type ImageBuildResultContract = Static<typeof ImageBuildResultSchema>;
