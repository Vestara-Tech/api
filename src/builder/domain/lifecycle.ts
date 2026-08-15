import type { ApiDefinitionStatus } from './types.js';
import { VestaraError } from '../../core/errors.js';

const TRANSITIONS: Readonly<Record<ApiDefinitionStatus, readonly ApiDefinitionStatus[]>> = {
  draft: ['validating'],
  validating: ['draft', 'ready'],
  ready: ['publishing'],
  publishing: ['published', 'draft'],
  published: ['superseded'],
  superseded: ['publishing'],
};

export function canTransition(from: ApiDefinitionStatus, to: ApiDefinitionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(from: ApiDefinitionStatus, to: ApiDefinitionStatus): ApiDefinitionStatus {
  if (!canTransition(from, to)) {
    throw new VestaraError({
      code: 'CONFLICT',
      message: `Invalid ApiDefinition status transition: ${from} → ${to}`,
      details: { from, to },
    });
  }
  return to;
}

export function isTerminal(status: ApiDefinitionStatus): boolean {
  return status === 'published' || status === 'superseded';
}
