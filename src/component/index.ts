export type {
  ComponentCategory,
  ComponentRendererReference,
  ComponentPropertyType,
  ComponentPropertyDefinition,
  ComponentSlotDefinition,
  ComponentEventDefinition,
  ComponentActionKind,
  ComponentActionDefinition,
  ComponentPreviewDefinition,
  ComponentDefinition,
  ComponentBinding,
  ComponentEventBinding,
  VisibilityExpression,
  ComponentInstance,
  ComponentTree,
  ComponentTreeValidationIssue,
  ComponentTreeValidationResult,
} from './contracts.js';
export type { ComponentRegistryOptions } from './registry/component-registry.js';
export { ComponentRegistry } from './registry/component-registry.js';
export { ComponentTreeValidator } from './tree/tree-validator.js';
export type { ComponentServiceOptions } from './service/component-service.js';
export { ComponentService, componentId } from './service/component-service.js';
export { builtinComponents } from './contributions/builtin.js';
