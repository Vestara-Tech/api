import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as TypeBox from '@sinclair/typebox';
import {
  ApiDefinitionSchema,
  ApiEndpointSchema,
  ApiEventSchema,
  ApiFieldSchema,
  ApiOperationSchema,
  ApiPolicySchema,
  ApiResourceSchema,
  CompatibilityChangeSchema,
  CompatibilitySchema,
  ContractSchema,
  CreateDefinitionBody,
  ErrorSchema,
  ListDefinitionsResultSchema,
  PreviewResultSchema,
  PublishResultSchema,
  RevisionSchema,
  UpdateDefinitionBody,
  ValidationResultSchema,
} from '../src/builder/contracts.js';
import {
  ArchitectureSchema,
  ApplicationProfileSchema,
  BaseSystemProfileSchema,
  BootProfileSchema,
  BuildRequestSchema,
  DesktopProfileSchema,
  ImageBuildPlanSchema,
  ImageBuildResultSchema,
  ImageBuildStateSchema,
  ImageProfileSchema,
  LoginProfileSchema,
  OnboardingProfileSchema,
  PackageProfileSchema,
  PlanRequestSchema,
  RecoveryProfileSchema,
  SecurityProfileSchema,
  SystemProfileSchema,
  UpdateImageProfileBodySchema,
} from '../src/image/contracts.js';
import {
  AiConsumerSchema,
  AiGenerateRequestSchema,
  AiGenerateResultSchema,
  AiMessageSchema,
  AiStreamEventSchema,
  AiToolCallSchema,
  AiToolDefinitionSchema,
  AiUsageRecordSchema,
  AiUsageSchema,
} from '../src/ai/contracts.js';

const BUILDER_OUTPUT = resolve('vestara-apps', 'api-builder', 'src', 'api', 'contracts.ts');
const IMAGE_OUTPUT = resolve('vestara-apps', 'os-image-builder', 'src', 'api', 'contracts.ts');
const AI_OUTPUT = resolve('packages', 'ai-ui', 'src', 'api', 'contracts.ts');

const BUILDER_SCHEMAS: Record<string, TypeBox.TSchema> = {
  ApiField: ApiFieldSchema,
  ApiResource: ApiResourceSchema,
  ApiEndpoint: ApiEndpointSchema,
  ApiPolicy: ApiPolicySchema,
  ApiOperation: ApiOperationSchema,
  ApiEvent: ApiEventSchema,
  ApiDefinition: ApiDefinitionSchema,
  CreateDefinitionInput: CreateDefinitionBody,
  UpdateDefinitionInput: UpdateDefinitionBody,
  ValidationIssue: (ValidationResultSchema as TypeBox.TObject).properties.issues
    .items as TypeBox.TSchema,
  ValidationResult: ValidationResultSchema,
  Contract: ContractSchema,
  CompatibilityChange: CompatibilityChangeSchema,
  Compatibility: CompatibilitySchema,
  PreviewResult: PreviewResultSchema,
  Revision: RevisionSchema,
  ListDefinitionsResult: ListDefinitionsResultSchema,
  PublishResult: PublishResultSchema,
  Error: ErrorSchema,
};

const IMAGE_SCHEMAS: Record<string, TypeBox.TSchema> = {
  Architecture: ArchitectureSchema,
  BaseSystemProfile: BaseSystemProfileSchema,
  BootProfile: BootProfileSchema,
  SystemProfile: SystemProfileSchema,
  LoginProfile: LoginProfileSchema,
  OnboardingProfile: OnboardingProfileSchema,
  DesktopProfile: DesktopProfileSchema,
  PackageProfile: PackageProfileSchema,
  SecurityProfile: SecurityProfileSchema,
  RecoveryProfile: RecoveryProfileSchema,
  ApplicationProfile: ApplicationProfileSchema,
  ImageProfile: ImageProfileSchema,
  UpdateImageProfileInput: UpdateImageProfileBodySchema,
  ImageBuildPlanItem: (ImageBuildPlanSchema as TypeBox.TObject).properties.items
    .items as TypeBox.TSchema,
  ImageBuildPlan: ImageBuildPlanSchema,
  ImageBuildState: ImageBuildStateSchema,
  ImageBuildResult: ImageBuildResultSchema,
  PlanRequest: PlanRequestSchema,
  BuildRequest: BuildRequestSchema,
};

const AI_SCHEMAS: Record<string, TypeBox.TSchema> = {
  AiConsumer: AiConsumerSchema,
  AiMessage: AiMessageSchema,
  AiToolCall: AiToolCallSchema,
  AiToolDefinition: AiToolDefinitionSchema,
  AiGenerateRequest: AiGenerateRequestSchema,
  AiGenerateResult: AiGenerateResultSchema,
  AiStreamEvent: AiStreamEventSchema,
  AiUsage: AiUsageSchema,
  AiUsageRecord: AiUsageRecordSchema,
};

function typeName(t: TypeBox.TSchema): string {
  switch (t[TypeBox.Kind]) {
    case 'String':
      return 'string';
    case 'Boolean':
      return 'boolean';
    case 'Integer':
    case 'Number':
      return 'number';
    case 'Null':
      return 'null';
    case 'Any':
      return 'unknown';
    case 'Array':
      return `readonly ${typeName((t as TypeBox.TArray).items)}[]`;
    case 'Literal':
      return JSON.stringify((t as TypeBox.TLiteral).const);
    case 'Union': {
      const union = t as TypeBox.TUnion;
      return union.anyOf.map((member) => typeName(member)).join(' | ');
    }
    case 'Object': {
      const obj = t as TypeBox.TObject;
      const required = obj.required ?? [];
      const props = Object.entries(obj.properties).map(([key, value]) => {
        const optional = required.includes(key) ? '' : '?';
        return `  readonly ${key}${optional}: ${typeName(value)};`;
      });
      return `{\n${props.join('\n')}\n}`;
    }
    default:
      return 'unknown';
  }
}

function emitInterface(name: string, schema: TypeBox.TSchema): string {
  const obj = schema as TypeBox.TObject;
  const isObject = obj[TypeBox.Kind] === 'Object' && typeof obj.properties === 'object' && obj.properties !== null;
  if (!isObject) {
    return `export type ${name} = ${typeName(schema)};`;
  }
  const required = obj.required ?? [];
  const props = Object.entries(obj.properties).map(([key, value]) => {
    const optional = required.includes(key) ? '' : '?';
    return `  readonly ${key}${optional}: ${typeName(value)};`;
  });
  return `export interface ${name} {\n${props.join('\n')}\n}`;
}

function emit(schemas: Record<string, TypeBox.TSchema>, source: string): string {
  const lines: string[] = [
    '// AUTO-GENERATED by scripts/generate-frontend-contracts.ts — do not edit.',
    `// Wire contract types derived from ${source} (TypeBox schemas).`,
    '// Regenerate with: pnpm contracts:frontend',
    '',
  ];
  for (const name of Object.keys(schemas)) {
    lines.push(emitInterface(name, schemas[name]!));
    lines.push('');
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  await mkdir(resolve(BUILDER_OUTPUT, '..'), { recursive: true });
  await writeFile(BUILDER_OUTPUT, emit(BUILDER_SCHEMAS, 'src/builder/contracts.ts'), 'utf8');
  await mkdir(resolve(IMAGE_OUTPUT, '..'), { recursive: true });
  await writeFile(IMAGE_OUTPUT, emit(IMAGE_SCHEMAS, 'src/image/contracts.ts'), 'utf8');
  await mkdir(resolve(AI_OUTPUT, '..'), { recursive: true });
  await writeFile(AI_OUTPUT, emit(AI_SCHEMAS, 'src/ai/contracts.ts'), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Frontend contracts generated → ${BUILDER_OUTPUT} + ${IMAGE_OUTPUT} + ${AI_OUTPUT}`);
}

void main();
