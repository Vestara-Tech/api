export type { Breakpoint, BindingSource, ComponentReference, PropertyValue, StateBinding, DataBinding, ActionKind, ActionBinding, EventBinding, PermissionBinding, ResponsiveProps, PageNode, LayoutDefinition, PageMetadata, PageResponsiveRule, PageDefinition } from './domain/page-definition.js';
export type { PageValidationIssue, PageValidationResult, ComponentResolver, PageDiffEntry } from './domain/page-validator.js';
export { PageValidator, bumpPageRevision, diffPages } from './domain/page-validator.js';
export type { PageRegistryPort } from './service/page-service.js';
export { PageService, InMemoryPageRegistry } from './service/page-service.js';
export type { PageServiceOptions } from './service/page-service.js';
