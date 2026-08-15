export type ImageBuildStage =
  | 'resolve-profile'
  | 'validate'
  | 'resolve-packages'
  | 'bootstrap'
  | 'install-kernel'
  | 'install-runtime'
  | 'install-apps'
  | 'configure-systemd'
  | 'configure-login'
  | 'configure-grub'
  | 'install-plymouth'
  | 'configure-ab'
  | 'build-recovery'
  | 'configure-firstboot'
  | 'generate-initramfs'
  | 'install-bootloader'
  | 'sanitize'
  | 'verify'
  | 'generate-sbom'
  | 'generate-evidence'
  | 'seal'
  | 'export';

export type ImageBuildStatus = 'draft' | 'planning' | 'building' | 'verifying' | 'completed' | 'failed';

export interface ImageBuildState {
  readonly buildId: string;
  readonly status: ImageBuildStatus;
  currentStage?: ImageBuildStage;
  readonly completedStages: readonly ImageBuildStage[];
  readonly failedStage?: ImageBuildStage;
  readonly failureMessage?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

const STAGE_ORDER: readonly ImageBuildStage[] = [
  'resolve-profile',
  'validate',
  'resolve-packages',
  'bootstrap',
  'install-kernel',
  'install-runtime',
  'install-apps',
  'configure-systemd',
  'configure-login',
  'configure-grub',
  'install-plymouth',
  'configure-ab',
  'build-recovery',
  'configure-firstboot',
  'generate-initramfs',
  'install-bootloader',
  'sanitize',
  'verify',
  'generate-sbom',
  'generate-evidence',
  'seal',
  'export',
];

export function stageOrder(): readonly ImageBuildStage[] {
  return STAGE_ORDER;
}

export function stageIndex(stage: ImageBuildStage): number {
  return STAGE_ORDER.indexOf(stage);
}
